/**
 * Server-persisted reusable Icon Library store.
 *
 * One JSON file per entry under `<STORAGE_PATH>/icon-library/`, so the
 * library lives on the same Docker-persisted volume as diagrams and never in
 * browser-local storage. Writes are atomic (tmp file + rename).
 *
 * Identity and deduplication are based on the SHA-256 of the DECODED asset
 * bytes (never the filename, display name, or data-URL wrapper). Render
 * metadata (isIsometric/scale) intentionally does NOT participate in
 * duplicate equivalence: the same bytes are the same asset, and each project
 * keeps its own copy semantics on copy-on-use.
 *
 * Entry ids are deterministic: `lib_` + first 16 hex chars of the content
 * hash. Re-adding identical bytes resolves to the same entry id.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  MAX_ICON_SOURCE_BYTES,
  canonicalSvgDataUrlFromText
} from './sanitizeSvg.js';

export const LIBRARY_DIR_NAME = 'icon-library';
export const LIBRARY_ID_PREFIX = 'lib_';
export const LIBRARY_ID_PATTERN = /^lib_[0-9a-f]{16}$/;
export const LIBRARY_NAME_MAX_LENGTH = 100;
/**
 * Max decoded asset size per entry (authoritative server cap; the browser
 * applies the same 1 MiB limit to source files for immediate feedback).
 */
export const LIBRARY_MAX_ASSET_BYTES = MAX_ICON_SOURCE_BYTES;

const ALLOWED_DATA_URL_PATTERN =
  /^data:(image\/(svg\+xml|png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

export function isValidLibraryId(id) {
  return typeof id === 'string' && LIBRARY_ID_PATTERN.test(id);
}

export function normalizeLibraryName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim().slice(0, LIBRARY_NAME_MAX_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Parse a data-URL icon asset. Returns decoded bytes + mime, or an error
 * descriptor. Hashing and storage always use the decoded bytes.
 */
export function parseLibraryAsset(url) {
  if (typeof url !== 'string') {
    return { ok: false, error: 'Asset must be a data URL string' };
  }
  const match = url.match(ALLOWED_DATA_URL_PATTERN);
  if (!match) {
    return {
      ok: false,
      error:
        'Unsupported asset: expected base64 data URL for SVG, PNG, JPEG, WebP or GIF'
    };
  }
  let bytes;
  try {
    bytes = Buffer.from(match[3], 'base64');
  } catch {
    return { ok: false, error: 'Asset is not valid base64' };
  }
  if (bytes.length === 0) {
    return { ok: false, error: 'Asset is empty' };
  }
  if (bytes.length > LIBRARY_MAX_ASSET_BYTES) {
    return {
      ok: false,
      error: `Asset exceeds ${LIBRARY_MAX_ASSET_BYTES} decoded bytes`
    };
  }
  return { ok: true, bytes, mime: match[2] };
}

export function sha256Hex(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export function libraryEntryIdForHash(hashHex) {
  return `${LIBRARY_ID_PREFIX}${hashHex.slice(0, 16)}`;
}

function entryFilePath(libraryDir, id) {
  return path.resolve(libraryDir, `${id}.json`);
}

async function writeAtomic(filePath, text) {
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, text);
  await fs.rename(tmpPath, filePath);
}

export function createIconLibraryStore({ storagePath }) {
  const libraryDir = path.resolve(storagePath, LIBRARY_DIR_NAME);

  const ensureDir = async () => {
    await fs.mkdir(libraryDir, { recursive: true });
  };

  const readEntry = async (id) => {
    try {
      const content = await fs.readFile(entryFilePath(libraryDir, id), 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  };

  return {
    libraryDir,

    async list() {
      try {
        await ensureDir();
      } catch {
        return [];
      }
      let files = [];
      try {
        files = await fs.readdir(libraryDir);
      } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
      }
      const entries = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(
            path.resolve(libraryDir, file),
            'utf-8'
          );
          entries.push(JSON.parse(content));
        } catch {
          continue;
        }
      }
      entries.sort((a, b) => String(a.name).localeCompare(String(b.name)));
      return entries;
    },

    /**
     * Add an asset. SVG is independently sanitized here (never trusting the
     * browser); the SHA-256 is computed over the CANONICAL sanitized bytes,
     * so inputs that sanitize identically resolve to the existing entry
     * ({ entry, duplicate: true }) and the stored entry is never modified.
     */
    async create({ name, url, isIsometric, scale }) {
      const displayName = normalizeLibraryName(name);
      if (!displayName) {
        return { ok: false, status: 400, error: 'Library icon needs a name' };
      }
      const parsed = parseLibraryAsset(url);
      if (!parsed.ok) {
        return { ok: false, status: 400, error: parsed.error };
      }
      let storedUrl = url;
      let storedBytes = parsed.bytes;
      if (parsed.mime === 'svg+xml') {
        const canonical = canonicalSvgDataUrlFromText(
          parsed.bytes.toString('utf-8')
        );
        if (!canonical) {
          return { ok: false, status: 400, error: 'Unsafe SVG content' };
        }
        storedUrl = canonical;
        storedBytes = Buffer.from(canonical.split(',')[1], 'base64');
      }
      const hash = sha256Hex(storedBytes);
      const id = libraryEntryIdForHash(hash);

      await ensureDir();
      const existing = await readEntry(id);
      if (existing) {
        return { ok: true, status: 200, entry: existing, duplicate: true };
      }

      const now = new Date().toISOString();
      const entry = {
        id,
        name: displayName,
        url: storedUrl,
        mime: parsed.mime,
        isIsometric: isIsometric ?? true,
        ...(scale !== undefined ? { scale } : {}),
        sha256: hash,
        createdAt: now,
        updatedAt: now
      };
      await writeAtomic(entryFilePath(libraryDir, id), JSON.stringify(entry, null, 2));
      return { ok: true, status: 201, entry, duplicate: false };
    },

    async rename(id, patch) {
      if (!isValidLibraryId(id)) {
        return { ok: false, status: 400, error: 'Invalid library icon ID' };
      }
      if (patch && (patch.url !== undefined || patch.sha256 !== undefined)) {
        return {
          ok: false,
          status: 400,
          error: 'Asset content is immutable: delete and re-add to change it'
        };
      }
      await ensureDir();
      const existing = await readEntry(id);
      if (!existing) {
        return { ok: false, status: 404, error: 'Library icon not found' };
      }
      const next = { ...existing };
      if (patch?.name !== undefined) {
        const displayName = normalizeLibraryName(patch.name);
        if (!displayName) {
          return { ok: false, status: 400, error: 'Library icon needs a name' };
        }
        next.name = displayName;
      }
      if (patch?.isIsometric !== undefined) {
        next.isIsometric = Boolean(patch.isIsometric);
      }
      if (patch?.scale !== undefined) {
        if (typeof patch.scale !== 'number' || patch.scale < 0.1 || patch.scale > 3) {
          return { ok: false, status: 400, error: 'Scale must be between 0.1 and 3' };
        }
        next.scale = patch.scale;
      }
      // Rename is metadata-only: copies already embedded in projects keep
      // their own names and are never touched.
      next.updatedAt = new Date().toISOString();
      await writeAtomic(entryFilePath(libraryDir, id), JSON.stringify(next, null, 2));
      return { ok: true, status: 200, entry: next };
    },

    async remove(id) {
      if (!isValidLibraryId(id)) {
        return { ok: false, status: 400, error: 'Invalid library icon ID' };
      }
      try {
        await fs.unlink(entryFilePath(libraryDir, id));
        return { ok: true, status: 200 };
      } catch (error) {
        if (error?.code === 'ENOENT') {
          return { ok: false, status: 404, error: 'Library icon not found' };
        }
        throw error;
      }
    }
  };
}

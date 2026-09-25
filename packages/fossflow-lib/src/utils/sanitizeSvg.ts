import DOMPurify from 'dompurify';

/**
 * Shared custom-icon ingestion policy for project imports and server
 * Icon Library imports. Both paths MUST use this module so their security
 * behavior is identical.
 *
 * - Max source size: 1 MiB (checked on File.size client-side and on decoded
 *   bytes server-side; the server cap is authoritative).
 * - Supported types: SVG + PNG/JPEG/WebP/GIF raster (whatever the importer
 *   normalizes; the raster path is unchanged).
 * - SVG is sanitized with DOMPurify (SVG profile): scripts, event handlers,
 *   javascript: URLs and foreignObject/active tags are removed; paths,
 *   groups, gradients, masks, clipPaths, fills/strokes, transforms, viewBox,
 *   presentation attributes and <style> blocks (e.g. Illustrator class
 *   fills, as used by a core Isoflow icon) are preserved.
 * - External network references are rejected, whether in href/src
 *   attributes or in CSS (url() targets and any @import in <style> blocks
 *   or style attributes). Internal url(#fragment) and self-contained data:
 *   references pass.
 *   (The mandatory xmlns="http://www.w3.org/..." namespace is not a URL
 *   attribute and is unaffected.)
 * - Deduplication hashes the CANONICAL sanitized bytes (see
 *   canonicalSvgDataUrl), never the raw upload.
 *
 * Existing diagrams are NEVER re-sanitized on load; this applies to new
 * imports only.
 */
export const MAX_ICON_SOURCE_BYTES = 1024 * 1024;

export const SUPPORTED_IMPORT_MIMES = [
  'image/svg+xml',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
] as const;

export type SupportedImportMime =
  (typeof SUPPORTED_IMPORT_MIMES)[number];

export const isSupportedImportMime = (mime: string): boolean => {
  return (SUPPORTED_IMPORT_MIMES as readonly string[]).includes(mime);
};

const EXTERNAL_URL_ATTR_PATTERN =
  /(href|xlink:href|src)\s*=\s*(?:['"]|&(quot|#34|#x22);)?\s*(https?:)?\/\//i;

// External resources referenced from CSS (style blocks and style
// attributes) bypass attribute checks, so they are detected separately.
// Internal fragment refs (url(#id)) and self-contained data: URLs pass;
// any http(s)/protocol-relative target rejects the whole file. @import is
// never legitimate in a self-contained icon and is rejected outright.
// Patterns run against DOMPurify's serialized output, where entity-encoded
// quote tricks are already normalized (quotes may still surface as &quot;).
const EXTERNAL_CSS_URL_PATTERN =
  /url\(\s*(?:['"]|&(quot|#34|#x22);)?\s*(https?:)?\/\//i;
const CSS_IMPORT_PATTERN = /@import/i;

// NOTE: keep FORBID_TAGS, ADD_TAGS and the three detection patterns above
// in sync with packages/fossflow-backend/sanitizeSvg.js (authoritative
// server mirror). Mirror coverage is asserted by backend tests.

export interface SanitizedSvg {
  /** Canonical UTF-8 markup bytes of the stored asset. */
  text: string;
}

/**
 * Sanitize raw SVG markup. Returns null when the input is unsafe in a way
 * sanitization cannot repair (external references) or contains no usable
 * SVG content. Idempotent: sanitizing clean output returns it unchanged.
 */
export const sanitizeSvgText = (rawSvg: string): SanitizedSvg | null => {
  let clean: string;
  try {
    clean = DOMPurify.sanitize(rawSvg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      // 'use' is restored so local symbol refs survive; external hrefs on
      // it are caught by the output checks below.
      ADD_TAGS: ['use'],
      FORBID_TAGS: [
        'foreignObject',
        'script',
        'iframe',
        'object',
        'embed',
        'link',
        'meta',
        'base',
        'form',
        'video',
        'audio',
        'source',
        'canvas',
        'frame',
        'frameset',
        'marquee'
      ]
    });
  } catch {
    return null;
  }
  if (typeof clean !== 'string' || !/<svg[\s>]/i.test(clean)) {
    return null;
  }
  if (
    EXTERNAL_URL_ATTR_PATTERN.test(clean) ||
    EXTERNAL_CSS_URL_PATTERN.test(clean) ||
    CSS_IMPORT_PATTERN.test(clean)
  ) {
    return null;
  }
  return { text: clean };
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

/**
 * Canonical stored form of an SVG data URL: decode → sanitize → re-encode
 * as base64(UTF-8(sanitized markup)). Returns null when rejected.
 */
export const canonicalSvgDataUrl = (dataUrl: string): string | null => {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return null;
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(
      base64ToBytes(dataUrl.slice(comma + 1))
    );
  } catch {
    return null;
  }
  const sanitized = sanitizeSvgText(text);
  if (!sanitized) return null;
  return `data:image/svg+xml;base64,${bytesToBase64(
    new TextEncoder().encode(sanitized.text)
  )}`;
};

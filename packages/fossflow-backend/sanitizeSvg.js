/**
 * Server-side mirror of the shared custom-icon ingestion policy
 * (packages/fossflow-lib/src/utils/sanitizeSvg.ts).
 *
 * The backend NEVER trusts browser sanitization: every SVG submitted to the
 * Icon Library is decoded, size-checked, sanitized here with the same
 * DOMPurify SVG profile, and only the canonical sanitized bytes are hashed
 * and stored. Keep FORBID_TAGS and the external-URL rule in sync with the
 * client module.
 */
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

export const MAX_ICON_SOURCE_BYTES = 1024 * 1024;

const EXTERNAL_URL_ATTR_PATTERN =
  /(href|xlink:href|src)\s*=\s*(?:['"]|&(quot|#34|#x22);)?\s*(https?:)?\/\//i;

// Mirror of the client-side CSS external-resource detection
// (packages/fossflow-lib/src/utils/sanitizeSvg.ts): url() targets and any
// @import reject the file; internal url(#fragment) and data: URLs pass.
// Keep the three patterns and FORBID_TAGS/ADD_TAGS in sync with the client.
const EXTERNAL_CSS_URL_PATTERN =
  /url\(\s*(?:['"]|&(quot|#34|#x22);)?\s*(https?:)?\/\//i;
const CSS_IMPORT_PATTERN = /@import/i;

const purify = createDOMPurify(new JSDOM('').window);

export function sanitizeSvgText(rawSvg) {
  let clean;
  try {
    clean = purify.sanitize(rawSvg, {
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
  return clean;
}

/** Canonical stored form: base64(UTF-8(sanitized markup)). */
export function canonicalSvgDataUrlFromText(decodedText) {
  const sanitized = sanitizeSvgText(decodedText);
  if (!sanitized) return null;
  return `data:image/svg+xml;base64,${Buffer.from(sanitized, 'utf-8').toString('base64')}`;
}

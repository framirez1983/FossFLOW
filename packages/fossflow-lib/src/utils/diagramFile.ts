import { modelSchema } from '../schemas/model';
import type { Model } from '../types';

/**
 * Canonical editable document extension for FossFLOW diagrams.
 * The payload remains plain JSON; the extension is product identity.
 */
export const DIAGRAM_FILE_EXTENSION = 'fossflow';

/** Legacy extension, still accepted on open/import/upload. */
export const LEGACY_DIAGRAM_FILE_EXTENSION = 'json';

/** File-picker accept value covering canonical + legacy formats. */
export const DIAGRAM_FILE_ACCEPT = `.${DIAGRAM_FILE_EXTENSION},.${LEGACY_DIAGRAM_FILE_EXTENSION}`;

export type DiagramFileUploadResult =
  | { ok: true; model: Model }
  | { ok: false; error: string };

const formatIssuePath = (path: Array<string | number>): string => {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return acc.length > 0 ? `${acc}.${segment}` : segment;
  }, '');
};

/**
 * Parse + validate an uploaded Full JSON diagram file (e.g. from Server
 * Storage upload). Accepts only the canonical flat model shape; Compact
 * JSON no longer exists and is rejected like any other invalid payload.
 * Never throws: syntax and schema failures are returned as useful errors.
 */
export const parseDiagramFileUpload = (
  text: string
): DiagramFileUploadResult => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      error: `Invalid JSON: ${
        error instanceof Error ? error.message : 'could not be parsed'
      }`
    };
  }

  const result = modelSchema.safeParse(parsed);

  if (!result.success) {
    const details = result.error.issues
      .slice(0, 3)
      .map((issue) => {
        return `${formatIssuePath([...issue.path])}: ${issue.message}`;
      })
      .join('; ');
    const suffix =
      result.error.issues.length > 3
        ? ` (+${result.error.issues.length - 3} more)`
        : '';
    return { ok: false, error: `Invalid diagram: ${details}${suffix}` };
  }

  return { ok: true, model: result.data };
};

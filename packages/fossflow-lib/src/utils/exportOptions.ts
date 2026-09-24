import domtoimage from 'dom-to-image-more';
import FileSaver from 'file-saver';
import { Model, Size } from '../types';

export interface ExportFilenameContext {
  projectTitle?: string;
  viewName?: string;
  at?: Date;
}

const sanitizeFilenameSegment = (
  value: string | undefined,
  fallback: string
): string => {
  const cleaned = (value ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
};

const toLocalStamp = (at: Date): string => {
  const pad = (value: number): string => {
    return String(value).padStart(2, '0');
  };
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
};

/**
 * Shared export filename builder using the browser's local date/time.
 * - With a view name: `<Project>-<View>-<YYYYMMDD>-<HHmm>.<ext>` (PNG/SVG).
 * - Without one: `<Project>-<YYYYMMDD>-<HHmm>.<ext>` (Full JSON, which
 *   already contains every view).
 * Segments are sanitized for safe filenames while keeping human-readable
 * spaces.
 */
export const generateExportFilename = (
  extension: string,
  context?: ExportFilenameContext
): string => {
  const project = sanitizeFilenameSegment(context?.projectTitle, 'Untitled');
  const stamp = toLocalStamp(context?.at ?? new Date());
  const rawView = context?.viewName;
  if (rawView === undefined) {
    return `${project}-${stamp}.${extension}`;
  }
  const view = sanitizeFilenameSegment(rawView, 'View');
  return `${project}-${view}-${stamp}.${extension}`;
};

/**
 * Wait until the hidden export tree is safe to snapshot: webfonts settled,
 * layout/paint flushed, and the container actually laid out. Every bound is a
 * fallback cap so a stalled resource can delay but never hang an export;
 * the mechanism itself is deterministic (font + paint readiness), not a
 * fixed sleep.
 */
export const ensureExportSnapshotReady = async (
  el: HTMLDivElement,
  timeoutMs: number = 2500
): Promise<void> => {
  const timeout = (ms: number) => {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  };
  const nextFrame = () => {
    return new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  };

  try {
    if (
      typeof document !== 'undefined' &&
      typeof document.fonts !== 'undefined' &&
      document.fonts?.ready
    ) {
      await Promise.race([document.fonts.ready, timeout(timeoutMs)]);
    }
  } catch {
    // Font readiness must never block an export.
  }

  // Flush layout/paint of the freshly mounted tree.
  await nextFrame();
  await nextFrame();

  // The export container has an explicit pixel size: if it still measures
  // zero, layout has not run yet — poll briefly, then proceed regardless.
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) break;
    await timeout(50);
  }
};

export const base64ToBlob = (
  base64: string,
  contentType: string,
  sliceSize = 512
) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);

    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: contentType });

  return blob;
};

export const downloadFile = (data: Blob, filename: string) => {
  FileSaver.saveAs(data, filename);
};

export const exportAsJSON = (model: Model) => {
  const data = new Blob([JSON.stringify(model)], {
    type: 'application/json;charset=utf-8'
  });

  downloadFile(
    data,
    generateExportFilename('json', { projectTitle: model.title })
  );
};

export const exportAsImage = async (
  el: HTMLDivElement,
  size?: Size,
  scale: number = 1,
  bgcolor: string = '#ffffff'
) => {
  // The hidden export tree is freshly mounted: wait until fonts, layout and
  // paint have settled so text metrics match the long-lived editor canvas.
  // Without this, canvas-measured TextBox widths (which carry only ~20px of
  // slack) can disagree with the rendered glyphs and reflow lines.
  await ensureExportSnapshotReady(el);

  // Calculate scaled dimensions
  const width = size ? size.width * scale : el.clientWidth * scale;
  const height = size ? size.height * scale : el.clientHeight * scale;

  // dom-to-image-more is a better maintained fork
  const options = {
    width,
    height,
    cacheBust: true,
    bgcolor,
    quality: 1.0,
    // Apply CSS transform for high-quality scaling
    style: scale !== 1 ? {
      transform: `scale(${scale})`,
      transformOrigin: 'top left'
    } : undefined
  };

  try {
    const imageData = await domtoimage.toPng(el, options);
    return imageData;
  } catch (error) {
    console.error('Export failed, trying fallback method:', error);
    // Fallback: try with minimal options
    return await domtoimage.toPng(el, {
      width,
      height,
      cacheBust: true,
      bgcolor
    });
  }
};

export const exportAsSVG = async (
  el: HTMLDivElement,
  size?: Size,
  bgcolor: string = '#ffffff'
) => {
  // Same readiness gate as PNG: both artifacts derive from one snapshot.
  await ensureExportSnapshotReady(el);

  const width = size ? size.width : el.clientWidth;
  const height = size ? size.height : el.clientHeight;

  const options = {
    width,
    height,
    cacheBust: true,
    bgcolor,
    quality: 1.0
  };

  try {
    const svgData = await domtoimage.toSvg(el, options);
    return svgData;
  } catch (error) {
    console.error('SVG export failed, trying fallback method:', error);
    // Fallback: try with minimal options
    return await domtoimage.toSvg(el, {
      width,
      height,
      cacheBust: true,
      bgcolor
    });
  }
};
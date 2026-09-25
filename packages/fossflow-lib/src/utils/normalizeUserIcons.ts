/**
 * Shared file-import normalization for user icons.
 *
 * Byte-for-byte the same behavior as the historical project import path,
 * plus the shared ingestion policy (see sanitizeSvg.ts), applied identically
 * to project and Icon Library imports:
 * - source files over MAX_ICON_SOURCE_BYTES are skipped with a reason
 * - only SUPPORTED_IMPORT_MIMES are accepted
 * - SVG files are sanitized and stored in canonical form; raster images are
 *   centered into a 128px square PNG (unchanged behavior)
 * - name uniqueness is resolved against caller-provided existing names
 */
import {
  MAX_ICON_SOURCE_BYTES,
  canonicalSvgDataUrl,
  isSupportedImportMime
} from './sanitizeSvg';

export interface NormalizedUserIcon {
  name: string;
  url: string;
  isIsometric: boolean;
}

export interface SkippedUserFile {
  name: string;
  reason: string;
}
export interface NormalizationResult {
  icons: NormalizedUserIcon[];
  skipped: SkippedUserFile[];
}

/** Pure display-name dedup: `pbx`, `pbx_1`, … (case-insensitive). */
export const uniqueIconName = (
  baseName: string,
  existingNames: Set<string>
): string => {
  let finalName = baseName;
  let counter = 1;
  while (existingNames.has(finalName.toLowerCase())) {
    finalName = `${baseName}_${counter}`;
    counter += 1;
  }
  existingNames.add(finalName.toLowerCase());
  return finalName;
};

export const baseNameFromFileName = (fileName: string): string => {
  return fileName.replace(/\.[^/.]+$/, '');
};

const readDataUrl = (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve(e.target?.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const rasterToSquarePng = (
  originalDataUrl: string,
  iconScale: number
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(originalDataUrl); // Fallback to original
        return;
      }
      const TARGET_SIZE = 128;
      const basScale = Math.min(
        TARGET_SIZE / img.width,
        TARGET_SIZE / img.height
      );
      const finalScale = basScale * (iconScale / 100);
      const scaledWidth = img.width * finalScale;
      const scaledHeight = img.height * finalScale;
      canvas.width = TARGET_SIZE;
      canvas.height = TARGET_SIZE;
      ctx.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);
      const x = (TARGET_SIZE - scaledWidth) / 2;
      const y = (TARGET_SIZE - scaledHeight) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = originalDataUrl;
  });
};

export const normalizeUserIconFiles = async (
  files: File[] | FileList,
  options: {
    existingNames?: string[];
    treatAsIsometric?: boolean;
    iconScale?: number;
  } = {}
): Promise<NormalizationResult> => {
  const {
    existingNames = [],
    treatAsIsometric = true,
    iconScale = 100
  } = options;
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  const icons: NormalizedUserIcon[] = [];
  const skipped: SkippedUserFile[] = [];

  const list = Array.from(files);
  for (const file of list) {
    if (!isSupportedImportMime(file.type)) {
      console.warn(`Skipping unsupported file type: ${file.name}`);
      skipped.push({ name: file.name, reason: 'unsupported file type' });
      continue;
    }
    if (file.size > MAX_ICON_SOURCE_BYTES) {
      console.warn(`Skipping oversized file: ${file.name}`);
      skipped.push({
        name: file.name,
        reason: `exceeds the 1 MiB icon size limit`
      });
      continue;
    }
    const name = uniqueIconName(baseNameFromFileName(file.name), taken);
    const originalDataUrl = await readDataUrl(file);
    if (file.type === 'image/svg+xml') {
      // SVGs scale naturally; store the sanitized canonical form.
      const canonical = canonicalSvgDataUrl(originalDataUrl);
      if (!canonical) {
        console.warn(`Skipping unsafe SVG file: ${file.name}`);
        skipped.push({ name: file.name, reason: 'unsafe SVG content' });
        continue;
      }
      icons.push({ name, url: canonical, isIsometric: treatAsIsometric });
      continue;
    }
    const url = await rasterToSquarePng(originalDataUrl, iconScale);
    icons.push({ name, url, isIsometric: treatAsIsometric });
  }
  return { icons, skipped };
};

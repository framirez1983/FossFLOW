import { generateId } from 'src/utils/common';
import type { Icon } from 'src/types/model';
import type { LibraryIcon } from 'src/types/library';

/**
 * COPY-ON-USE: embed a server Library icon into the current project with
 * normal project semantics (fresh project id, `imported` collection).
 *
 * - The Library asset itself is never mutated.
 * - No filesystem path, server URL, or library id is serialized: only the
 *   asset bytes (data URL), name and render flags travel into `Model.icons`.
 * - When the exact same asset bytes are already embedded, the existing
 *   project icon is reused instead of duplicating `model.icons` entries.
 */
export const copyLibraryIconToProject = (
  icons: Icon[],
  libraryIcon: LibraryIcon
): { icons: Icon[]; iconId: string; reused: boolean } => {
  const existing = icons.find((icon) => {
    return icon.url === libraryIcon.url;
  });
  if (existing) {
    return { icons, iconId: existing.id, reused: true };
  }

  const takenNames = new Set(
    icons.map((icon) => {
      return icon.name.toLowerCase();
    })
  );
  let name = libraryIcon.name;
  let counter = 1;
  while (takenNames.has(name.toLowerCase())) {
    name = `${libraryIcon.name}_${counter}`;
    counter += 1;
  }

  const projectIcon: Icon = {
    id: generateId(),
    name,
    url: libraryIcon.url,
    collection: 'imported',
    isIsometric: libraryIcon.isIsometric ?? true,
    ...(libraryIcon.scale !== undefined ? { scale: libraryIcon.scale } : {})
  };
  return { icons: [...icons, projectIcon], iconId: projectIcon.id, reused: false };
};

/** Only user-imported/custom icons can be promoted into the Library. */
export const isPromotableIcon = (icon: Icon): boolean => {
  return icon.collection === 'imported';
};

/** Minimal server payload for promoting a project icon (asset + metadata). */
export const toLibraryPayload = (
  icon: Icon
): { name: string; url: string; isIsometric?: boolean; scale?: number } => {
  return {
    name: icon.name,
    url: icon.url,
    ...(icon.isIsometric !== undefined
      ? { isIsometric: icon.isIsometric }
      : {}),
    ...(icon.scale !== undefined ? { scale: icon.scale } : {})
  };
};

import { Icon, ModelItem } from 'src/types';
import { constrainedStrings } from 'src/schemas/common';

export const ICON_NAME_MAX_LENGTH =
  constrainedStrings.name.maxLength ?? 100;

export const normalizeIconName = (name: string): string | null => {
  const trimmed = name.trim().substring(0, ICON_NAME_MAX_LENGTH);
  return trimmed.length > 0 ? trimmed : null;
};

const findImportedIcon = (
  icons: Icon[],
  id: string
): Icon | undefined => {
  const icon = icons.find((entry) => entry.id === id);
  if (!icon || icon.collection !== 'imported') return undefined;
  return icon;
};

export const renameImportedIcon = (
  icons: Icon[],
  id: string,
  name: string
): { icons: Icon[]; renamed: boolean } => {
  const target = findImportedIcon(icons, id);
  if (!target) return { icons, renamed: false };

  const normalized = normalizeIconName(name);
  if (!normalized || normalized === target.name) {
    return { icons, renamed: false };
  }

  return {
    icons: icons.map((entry) => {
      return entry.id === id ? { ...entry, name: normalized } : entry;
    }),
    renamed: true
  };
};

export const countIconUsage = (
  items: ModelItem[],
  iconId: string
): number => {
  return items.reduce((count, item) => {
    return count + (item.icon === iconId ? 1 : 0);
  }, 0);
};

export const deleteImportedIcon = (
  icons: Icon[],
  id: string
): { icons: Icon[]; deleted: boolean } => {
  if (!findImportedIcon(icons, id)) return { icons, deleted: false };

  return {
    icons: icons.filter((entry) => entry.id !== id),
    deleted: true
  };
};

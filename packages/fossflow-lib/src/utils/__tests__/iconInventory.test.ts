import {
  ICON_NAME_MAX_LENGTH,
  normalizeIconName,
  renameImportedIcon,
  countIconUsage,
  deleteImportedIcon
} from '../iconInventory';
import { Icon, ModelItem } from 'src/types';

const imported = (overrides?: Partial<Icon>): Icon => {
  return {
    id: 'imp1',
    name: 'My Icon',
    url: 'data:image/png;base64,AAA',
    collection: 'imported',
    isIsometric: true,
    ...overrides
  };
};

const builtin = (overrides?: Partial<Icon>): Icon => {
  return {
    id: 'core1',
    name: 'Block',
    url: 'http://example.com/block.svg',
    collection: 'isoflow',
    isIsometric: true,
    ...overrides
  };
};

describe('iconInventory', () => {
  it('exposes the schema name length limit', () => {
    expect(ICON_NAME_MAX_LENGTH).toBe(100);
  });

  it('normalizes names by trimming, truncating and rejecting empties', () => {
    expect(normalizeIconName('  Padded  ')).toBe('Padded');
    expect(normalizeIconName('   ')).toBeNull();
    expect(normalizeIconName('')).toBeNull();
    expect(normalizeIconName('x'.repeat(150))).toHaveLength(100);
  });

  it('rename changes only the display name, preserving id and asset', () => {
    const icons = [imported(), builtin()];
    const { icons: next, renamed } = renameImportedIcon(
      icons,
      'imp1',
      '  Renamed  '
    );

    expect(renamed).toBe(true);
    expect(next[0]).toEqual({ ...icons[0], name: 'Renamed' });
    expect(next[0].id).toBe('imp1');
    expect(next[0].url).toBe('data:image/png;base64,AAA');
    // Unrelated icons keep their object identity.
    expect(next[1]).toBe(icons[1]);
  });

  it('rename is a no-op for empty, unchanged and overlong-trimmed names', () => {
    const icons = [imported()];
    expect(renameImportedIcon(icons, 'imp1', '   ').renamed).toBe(false);
    expect(renameImportedIcon(icons, 'imp1', 'My Icon').renamed).toBe(false);
    const long = renameImportedIcon(icons, 'imp1', 'y'.repeat(150));
    expect(long.renamed).toBe(true);
    expect(long.icons[0].name).toHaveLength(100);
  });

  it('rename refuses built-in and unknown icons', () => {
    const icons = [imported(), builtin()];
    expect(renameImportedIcon(icons, 'core1', 'Hacked').renamed).toBe(false);
    expect(renameImportedIcon(icons, 'missing', 'Hacked').renamed).toBe(false);
    expect(icons[1].name).toBe('Block');
  });

  it('counts usage by stable icon id across model items', () => {
    const items: ModelItem[] = [
      { id: 'a', name: 'A', icon: 'imp1' },
      { id: 'b', name: 'B', icon: 'imp1' },
      { id: 'c', name: 'C', icon: 'core1' },
      { id: 'd', name: 'D' }
    ];

    expect(countIconUsage(items, 'imp1')).toBe(2);
    expect(countIconUsage(items, 'core1')).toBe(1);
    expect(countIconUsage(items, 'missing')).toBe(0);
  });

  it('delete removes only the imported icon, preserving references', () => {
    const icons = [imported(), builtin()];
    const { icons: next, deleted } = deleteImportedIcon(icons, 'imp1');

    expect(deleted).toBe(true);
    expect(next.map((icon) => icon.id)).toEqual(['core1']);
    expect(next[0]).toBe(icons[1]);
  });

  it('delete refuses built-in and unknown icons', () => {
    const icons = [imported(), builtin()];
    expect(deleteImportedIcon(icons, 'core1').deleted).toBe(false);
    expect(deleteImportedIcon(icons, 'missing').deleted).toBe(false);
    expect(icons).toHaveLength(2);
  });
});

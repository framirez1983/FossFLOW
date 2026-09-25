import { modelSchema } from 'src/schemas/model';
import {
  copyLibraryIconToProject,
  isPromotableIcon,
  toLibraryPayload
} from '../iconLibrary';
import type { LibraryIcon } from 'src/types/library';
import type { Icon } from 'src/types/model';

const libraryIcon = (overrides?: Partial<LibraryIcon>): LibraryIcon => {
  return {
    id: 'lib_0123456789abcdef',
    name: 'PBX',
    url: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    mime: 'svg+xml',
    isIsometric: false,
    sha256: 'abc',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
};

describe('copyLibraryIconToProject', () => {
  it('embeds a project-local copy with no library dependency', () => {
    const lib = libraryIcon();
    const { icons, iconId, reused } = copyLibraryIconToProject([], lib);

    expect(reused).toBe(false);
    expect(icons).toHaveLength(1);
    const [projectIcon] = icons;
    expect(projectIcon.id).toBe(iconId);
    // Fresh project id: never the server library id.
    expect(projectIcon.id).not.toBe(lib.id);
    expect(projectIcon.collection).toBe('imported');
    expect(projectIcon.url).toBe(lib.url);
    expect(projectIcon.name).toBe('PBX');
    expect(projectIcon.isIsometric).toBe(false);
  });

  it('reuses the embedded icon when the same asset is used again', () => {
    const lib = libraryIcon();
    const first = copyLibraryIconToProject([], lib);
    const second = copyLibraryIconToProject(first.icons, {
      ...lib,
      // Renamed server-side after the first copy: still the same asset.
      name: 'PBX Phone',
      id: 'lib_ffffffffffffffff'
    });

    expect(second.reused).toBe(true);
    expect(second.iconId).toBe(first.iconId);
    expect(second.icons).toHaveLength(1);
  });

  it('dedupes display names against existing project icons', () => {
    const existing: Icon = {
      id: 'project-1',
      name: 'PBX',
      url: 'data:image/svg+xml;base64,AAAA',
      collection: 'imported'
    };
    const { icons } = copyLibraryIconToProject([existing], libraryIcon());
    expect(icons).toHaveLength(2);
    expect(icons[1].name).toBe('PBX_1');
  });
});

describe('project portability', () => {
  it('exported model parses with the Library entirely absent', () => {
    const lib = libraryIcon();
    const { icons, iconId } = copyLibraryIconToProject([], lib);

    // Simulate a .fossflow document: model + items referencing the copy.
    const exported = JSON.parse(
      JSON.stringify({
        title: 'Portable',
        icons,
        colors: [],
        items: [{ id: 'm1', name: 'Phone', icon: iconId }],
        views: []
      })
    );

    // No library ids, paths, or URLs may leak into the document.
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain('lib_');
    expect(serialized).not.toContain('/api/icon-library');
    expect(serialized).not.toContain('icon-library/');

    // Parses as a valid model with no library context at all.
    const parsed = modelSchema.safeParse(exported);
    expect(parsed.success).toBe(true);
  });
});

describe('isPromotableIcon / toLibraryPayload', () => {
  it('only promotes user-imported icons, with asset + metadata', () => {
    const imported: Icon = {
      id: 'p1',
      name: 'Custom',
      url: 'data:image/svg+xml;base64,AAAA',
      collection: 'imported',
      isIsometric: true
    };
    const core: Icon = {
      id: 'c1',
      name: 'Server',
      url: 'https://example.com/server.svg',
      collection: 'isoflow'
    };
    expect(isPromotableIcon(imported)).toBe(true);
    expect(isPromotableIcon(core)).toBe(false);
    expect(toLibraryPayload(imported)).toEqual({
      name: 'Custom',
      url: 'data:image/svg+xml;base64,AAAA',
      isIsometric: true
    });
  });
});

import {
  uniqueIconName,
  baseNameFromFileName
} from '../normalizeUserIcons';

describe('uniqueIconName', () => {
  it('returns the base name when unused', () => {
    const taken = new Set(['other']);
    expect(uniqueIconName('pbx', taken)).toBe('pbx');
    expect(taken.has('pbx')).toBe(true);
  });

  it('suffixes case-insensitively until unique', () => {
    const taken = new Set(['pbx', 'pbx_1']);
    expect(uniqueIconName('PBX', taken)).toBe('PBX_2');
  });
});

describe('baseNameFromFileName', () => {
  it('strips the final extension only', () => {
    expect(baseNameFromFileName('my-final-pbx.svg')).toBe('my-final-pbx');
    expect(baseNameFromFileName('archive.tar.gz')).toBe('archive.tar');
    expect(baseNameFromFileName('noext')).toBe('noext');
  });
});

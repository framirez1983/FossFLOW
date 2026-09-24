import { generateExportFilename } from '../exportOptions';
import { DIAGRAM_FILE_EXTENSION } from '../diagramFile';

describe('generateExportFilename', () => {
  it('builds Project-View-date filenames with local time', () => {
    // Local-time constructor: deterministic regardless of machine TZ.
    const at = new Date(2026, 8, 24, 9, 10, 45, 757);

    expect(
      generateExportFilename('png', {
        projectTitle: 'S4OPTIK',
        viewName: 'General View',
        at
      })
    ).toBe('S4OPTIK-General View-20260924-0910.png');
  });

  it('pads single-digit months, days, hours and minutes', () => {
    const at = new Date(2026, 0, 5, 7, 4);

    expect(
      generateExportFilename('svg', {
        projectTitle: 'S4OPTIK',
        viewName: 'Main',
        at
      })
    ).toBe('S4OPTIK-Main-20260105-0704.svg');
  });

  it('sanitizes invalid filename characters while keeping spaces readable', () => {
    const at = new Date(2026, 8, 24, 9, 10);

    expect(
      generateExportFilename('png', {
        projectTitle: 'A/B:C*D?E"F<G>H|I',
        viewName: '  spaced   out  ',
        at
      })
    ).toBe('A B C D E F G H I-spaced out-20260924-0910.png');
  });

  it('strips trailing periods', () => {
    const at = new Date(2026, 8, 24, 9, 10);

    expect(
      generateExportFilename('png', {
        projectTitle: 'Project...',
        viewName: 'View.',
        at
      })
    ).toBe('Project-View-20260924-0910.png');
  });

  it('falls back for missing or empty project/view names', () => {
    const at = new Date(2026, 8, 24, 9, 10);

    expect(generateExportFilename('png', { at })).toBe(
      'Untitled-20260924-0910.png'
    );
    expect(
      generateExportFilename('svg', {
        projectTitle: '   ',
        viewName: '',
        at
      })
    ).toBe('Untitled-View-20260924-0910.svg');
    expect(generateExportFilename('png')).toMatch(
      /^Untitled-\d{8}-\d{4}\.png$/
    );
  });

  it('shares one basename scheme across PNG and SVG', () => {
    const context = {
      projectTitle: 'S4OPTIK',
      viewName: 'General View',
      at: new Date(2026, 8, 24, 9, 10)
    };

    const png = generateExportFilename('png', context);
    const svg = generateExportFilename('svg', context);

    expect(png).toBe('S4OPTIK-General View-20260924-0910.png');
    expect(svg).toBe('S4OPTIK-General View-20260924-0910.svg');
    expect(png.replace(/\.png$/, '')).toBe(svg.replace(/\.svg$/, ''));
  });

  it('omits the view segment for Full JSON project exports', () => {
    const at = new Date(2026, 8, 24, 14, 16);

    expect(
      generateExportFilename('json', {
        projectTitle: 'S4OPTIK',
        viewName: 'General View',
        at
      })
    ).toBe('S4OPTIK-General View-20260924-1416.json');
    expect(
      generateExportFilename('json', { projectTitle: 'S4OPTIK', at })
    ).toBe('S4OPTIK-20260924-1416.json');
    expect(generateExportFilename('json', { at })).toBe(
      'Untitled-20260924-1416.json'
    );
    expect(
      generateExportFilename('json', {
        projectTitle: 'A/B Project...',
        at
      })
    ).toBe('A B Project-20260924-1416.json');
  });

  it('uses the canonical project extension for Full JSON exports', () => {
    const at = new Date(2026, 8, 24, 14, 16);

    expect(
      generateExportFilename(DIAGRAM_FILE_EXTENSION, {
        projectTitle: 'S4OPTIK',
        at
      })
    ).toBe('S4OPTIK-20260924-1416.fossflow');
  });

  it('leaves PNG/SVG view naming unchanged', () => {
    const at = new Date(2026, 8, 24, 14, 16);

    expect(
      generateExportFilename('png', {
        projectTitle: 'S4OPTIK',
        viewName: 'General View',
        at
      })
    ).toBe('S4OPTIK-General View-20260924-1416.png');
    expect(
      generateExportFilename('svg', {
        projectTitle: 'S4OPTIK',
        viewName: 'General View',
        at
      })
    ).toBe('S4OPTIK-General View-20260924-1416.svg');
  });
});

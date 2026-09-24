import {
  parseDiagramFileUpload,
  DIAGRAM_FILE_EXTENSION,
  LEGACY_DIAGRAM_FILE_EXTENSION,
  DIAGRAM_FILE_ACCEPT
} from '../diagramFile';

const validModel = {
  title: 'Uploaded',
  items: [],
  icons: [],
  colors: [],
  views: [
    {
      id: 'v1',
      name: 'Main',
      items: [],
      textBoxes: [{ id: 't1', tile: { x: 0, y: 0 }, content: 'Hello' }]
    }
  ]
};

describe('parseDiagramFileUpload', () => {
  it('exposes canonical and legacy extensions with a joint accept value', () => {
    expect(DIAGRAM_FILE_EXTENSION).toBe('fossflow');
    expect(LEGACY_DIAGRAM_FILE_EXTENSION).toBe('json');
    expect(DIAGRAM_FILE_ACCEPT).toBe('.fossflow,.json');
  });
  it('accepts a valid Full JSON model', () => {
    const result = parseDiagramFileUpload(JSON.stringify(validModel));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.model.title).toBe('Uploaded');
    }
  });

  it('rejects invalid JSON syntax with a useful error', () => {
    const result = parseDiagramFileUpload('{not json');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/invalid json/i);
    }
  });

  it('rejects schema-invalid models with field paths', () => {
    const invalid = {
      ...validModel,
      views: [
        {
          id: 'v1',
          name: 'Main',
          items: [],
          textBoxes: [{ id: 't1', tile: { x: 0, y: 0 }, content: 'x'.repeat(501) }]
        }
      ]
    };
    const result = parseDiagramFileUpload(JSON.stringify(invalid));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/views\[0\]\.textBoxes\[0\]\.content/);
      expect(result.error).toMatch(/at most 500/);
    }
  });

  it('rejects non-model payloads such as legacy compact JSON', () => {
    const compactish = {
      t: 'Old',
      i: [],
      v: [],
      _: { f: 'compact', v: '1.0' }
    };
    const result = parseDiagramFileUpload(JSON.stringify(compactish));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/invalid diagram/i);
    }
  });

  it('never throws on hostile input', () => {
    for (const text of ['', 'null', '[]', '42', '"str"']) {
      expect(() => parseDiagramFileUpload(text)).not.toThrow();
      expect(parseDiagramFileUpload(text).ok).toBe(false);
    }
  });
});

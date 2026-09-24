import {
  getTextWidth,
  getTextBoxDimensions,
  getTextBoxEndTile,
  resolveLetterSpacingPx
} from '../renderer';
import { TextBox } from 'src/types';

// Canvas measureText is stubbed: 12px per character, so expectations can be
// derived exactly from the shared sizing formula.
const CHAR_WIDTH = 12;

describe('text box sizing semantics', () => {
  const realCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    jest
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string, ...rest: unknown[]) => {
        if (tagName === 'canvas') {
          return {
            getContext: () => {
              return {
                font: '',
                measureText: (text: string) => {
                  return { width: text.length * CHAR_WIDTH };
                }
              };
            },
            remove: () => {}
          } as unknown as HTMLCanvasElement;
        }
        return (realCreateElement as (...args: unknown[]) => Element)(
          tagName,
          ...rest
        );
      }) as typeof document.createElement);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sizes single-line text from canvas metrics with padding and slack', () => {
    // "Main Office" = 11 chars -> 132px canvas; letter-spacing 0.00938em at
    // 60px = 0.5628px/char -> ~6.2px; padding 2x20px; tile 100px; -0.8 slack.
    const width = getTextWidth('Main Office', {
      fontSize: 0.6,
      fontFamily: 'Roboto, Arial, sans-serif',
      fontWeight: 'bold'
    });

    expect(width).toBeCloseTo((132 + 11 * 0.5628 + 40) / 100 - 0.8, 10);
  });

  it('measures deterministically: same inputs give same editor/export widths', () => {
    const props = {
      fontSize: 0.6,
      fontFamily: 'Roboto, Arial, sans-serif',
      fontWeight: 'bold' as const
    };

    expect(getTextWidth('Second Office', props)).toBe(
      getTextWidth('Second Office', props)
    );
  });

  it('measures explicit newlines as part of the same run (rendering collapses them identically in both trees)', () => {
    // Neither tree sets white-space, so '\n' collapses like a space in both
    // the editor and the export renderer. Sizing must treat them alike.
    expect('a\nb'.length).toBe('a b'.length);
    expect(
      getTextWidth('a\nb', {
        fontSize: 0.6,
        fontFamily: 'x',
        fontWeight: 'bold'
      })
    ).toBe(
      getTextWidth('a b', {
        fontSize: 0.6,
        fontFamily: 'x',
        fontWeight: 'bold'
      })
    );
  });

  it('derives textbox dimensions with unit height', () => {
    const textBox = {
      id: 'tb',
      tile: { x: 0, y: 0 },
      content: 'Main Office',
      fontSize: 0.6
    } as TextBox;

    expect(getTextBoxDimensions(textBox)).toEqual({
      width: getTextWidth('Main Office', {
        fontSize: 0.6,
        fontFamily: expect.any(String),
        fontWeight: expect.anything()
      }),
      height: 1
    });
  });

  it('computes orientation-aware end tiles from the same size', () => {    const size = { width: 3.4, height: 1 };

    expect(
      getTextBoxEndTile(
        { id: 'a', tile: { x: 1, y: 2 }, content: 'x', orientation: 'X' },
        size
      )
    ).toEqual({ x: 4.4, y: 2 });
    expect(
      getTextBoxEndTile(
        { id: 'a', tile: { x: 1, y: 2 }, content: 'x', orientation: 'Y' },
        size
      )
    ).toEqual({ x: 1, y: 2 - 3.4 });
  });

  it('resolves letter-spacing inputs like the rendered Typography', () => {
    expect(resolveLetterSpacingPx('0.00938em', 60)).toBeCloseTo(0.5628, 4);
    expect(resolveLetterSpacingPx('2px', 60)).toBe(2);
    expect(resolveLetterSpacingPx(1.5, 60)).toBe(1.5);
    expect(resolveLetterSpacingPx('normal', 60)).toBe(0);
    expect(resolveLetterSpacingPx(undefined, 60)).toBe(0);
    expect(resolveLetterSpacingPx('bogus', 60)).toBe(0);
  });

  it('adds per-glyph letter-spacing to the measured width', () => {
    // 11 stub-measured chars at 12px = 132px canvas + 11 x 0.5628px spacing.
    const width = getTextWidth('Main Office', {
      fontSize: 0.6,
      fontFamily: 'Roboto, Arial, sans-serif',
      fontWeight: 'bold'
    });
    const withoutSpacing = (132 + 40) / 100 - 0.8;

    expect(width - withoutSpacing).toBeCloseTo((11 * 0.5628) / 100, 10);
  });

  describe('DOM measurement branch', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      window.HTMLElement.prototype,
      'scrollWidth'
    );

    afterEach(() => {
      if (descriptor) {
        Object.defineProperty(
          window.HTMLElement.prototype,
          'scrollWidth',
          descriptor
        );
      }
    });

    const mockScrollWidth = (value: number) => {
      Object.defineProperty(window.HTMLElement.prototype, 'scrollWidth', {
        configurable: true,
        get() {
          return value;
        }
      });
    };

    it('prefers the DOM width when it exceeds the canvas width', () => {
      // Browser DOM shaper reports 500px; stub canvas reports 132px.
      mockScrollWidth(500);

      const width = getTextWidth('Main Office', {
        fontSize: 0.6,
        fontFamily: 'Roboto, Arial, sans-serif',
        fontWeight: 'bold'
      });

      expect(width).toBeCloseTo((500 + 40) / 100 - 0.8, 10);
    });

    it('keeps the canvas width when it exceeds the DOM width', () => {
      mockScrollWidth(10);

      const width = getTextWidth('Main Office', {
        fontSize: 0.6,
        fontFamily: 'Roboto, Arial, sans-serif',
        fontWeight: 'bold'
      });

      // Canvas 132px + 11 x 0.5628px spacing wins over DOM 10px.
      expect(width).toBeCloseTo((132 + 11 * 0.5628 + 40) / 100 - 0.8, 10);
    });

    it('styles the probe exactly like the rendered text', () => {
      mockScrollWidth(500);
      getTextWidth('Main Office', {
        fontSize: 0.6,
        fontFamily: 'Roboto, Arial, sans-serif',
        fontWeight: 'bold'
      });

      const probe = [...document.body.querySelectorAll('div')].find((el) => {
        return (
          el.getAttribute('aria-hidden') === 'true' &&
          el.style.whiteSpace === 'nowrap'
        );
      });
      expect(probe).toBeTruthy();
      expect(probe?.style.display).toBe('inline-block');
      expect(probe?.style.letterSpacing).toBe('0.5628px');
      expect(probe?.textContent).toBe('Main Office');
    });
  });
});

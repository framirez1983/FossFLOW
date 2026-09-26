import { Cursor } from 'src/interaction/modes/Cursor';
import {
  isPanGuardActive,
  PAN_GUARD_CLASS,
  startPanGuard,
  stopPanGuard
} from 'src/utils/panGuard';

type AnyState = Parameters<NonNullable<typeof Cursor.mousedown>>[0];

const makeActions = () => ({
  setMode: jest.fn(),
  setItemControls: jest.fn(),
  setContextMenu: jest.fn()
});

const emptyCanvasState = () => {
  const actions = makeActions();
  return {
    state: {
      uiState: {
        mode: { type: 'CURSOR', showCursor: true, mousedownItem: null },
        mouse: {
          mousedown: null,
          position: { tile: { x: 3, y: 4 }, screen: { x: 0, y: 0 } },
          delta: { tile: { x: 0, y: 0 }, screen: { x: 0, y: 0 } }
        },
        actions
      },
      scene: { rectangles: [], items: [], textBoxes: [], connectors: [] },
      isRendererInteraction: true
    } as unknown as AnyState,
    actions
  };
};

const openMenuState = () => {
  const actions = makeActions();
  return {
    state: {
      uiState: {
        mode: { type: 'CURSOR', showCursor: true, mousedownItem: null },
        mouse: {
          mousedown: null,
          position: { tile: { x: 3, y: 4 }, screen: { x: 0, y: 0 } },
          delta: { tile: { x: 0, y: 0 }, screen: { x: 0, y: 0 } }
        },
        actions
      },
      scene: { rectangles: [], items: [], textBoxes: [], connectors: [] },
      isRendererInteraction: true
    } as unknown as AnyState,
    actions
  };
};

describe('left click on empty canvas', () => {
  it('does not open the creation menu', () => {
    const { state, actions } = emptyCanvasState();

    Cursor.mousedown!(state);

    expect(actions.setContextMenu).toHaveBeenCalledWith(null);
    expect(actions.setContextMenu).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'EMPTY' })
    );
  });

  it('clears any item selection as before', () => {
    const { state, actions } = emptyCanvasState();

    Cursor.mousedown!(state);

    expect(actions.setItemControls).toHaveBeenCalledWith(null);
  });

  it('closes an already-open creation menu', () => {
    const { state, actions } = openMenuState();

    Cursor.mousedown!(state);

    expect(actions.setContextMenu).toHaveBeenCalledWith(null);
  });
});

describe('pan text-selection guard', () => {
  afterEach(() => {
    stopPanGuard();
  });

  it('adds a body class while panning', () => {
    expect(isPanGuardActive()).toBe(false);

    startPanGuard();

    expect(isPanGuardActive()).toBe(true);
    expect(document.body.classList.contains(PAN_GUARD_CLASS)).toBe(true);
  });

  it('removes the class afterwards', () => {
    startPanGuard();
    stopPanGuard();

    expect(isPanGuardActive()).toBe(false);
  });

  it('is idempotent', () => {
    startPanGuard();
    startPanGuard();
    stopPanGuard();

    expect(isPanGuardActive()).toBe(false);
  });

  it('stopping without starting is safe', () => {
    expect(() => stopPanGuard()).not.toThrow();
    expect(isPanGuardActive()).toBe(false);
  });

  it('injects its stylesheet once and exempts form fields', () => {
    startPanGuard();

    const styles = () =>
      document.querySelectorAll('style[id^="fossflow-pan-guard"]');

    expect(styles().length).toBe(1);

    const css = styles()[0].textContent ?? '';
    // Form fields must stay selectable/editable.
    expect(css).toContain(':not(input)');
    expect(css).toContain(':not(textarea)');
    expect(css).toContain('[contenteditable="true"]');
    expect(css).toContain('user-select: none');
    // Native image dragging must not start either.
    expect(css).toContain('-webkit-user-drag: none');

    startPanGuard();
    expect(styles().length).toBe(1);
  });
});

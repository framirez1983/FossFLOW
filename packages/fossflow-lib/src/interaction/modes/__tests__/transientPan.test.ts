import { Cursor } from 'src/interaction/modes/Cursor';
import { Pan } from 'src/interaction/modes/Pan';
import { Coords } from 'src/types';
import { isPanGuardActive, startPanGuard, stopPanGuard } from 'src/utils/panGuard';

/**
 * Transient vs explicit canvas panning.
 *
 * Panning the canvas by dragging empty space with the cursor selected is a
 * convenience, but it must not leave the user stuck in the Hand tool. The
 * `temp` flag on PanMode is the existing discriminator:
 *
 *   - Cursor -> empty drag  : PAN with `temp: true`, Pan.mouseup restores Cursor
 *   - Hand tool / Pan key   : PAN without `temp`, Pan.mouseup leaves it alone
 */

type AnyState = Parameters<NonNullable<typeof Cursor.mousemove>>[0];

const setMode = () => jest.fn();
const setItemControls = () => jest.fn();
const setContextMenu = () => jest.fn();
const setScroll = () => jest.fn();

const cursorMode = (mousedownItem: unknown = null) => ({
  type: 'CURSOR' as const,
  showCursor: true,
  mousedownItem
});

/** Cursor mode with the pointer moved and held down, over empty canvas. */
const cursorDraggingState = (mousedownItem: unknown = null) => {
  const mode = setMode();
  return {
    uiState: {
      mode: cursorMode(mousedownItem),
      mouse: {
        mousedown: { tile: { x: 1, y: 1 } },
        position: { tile: { x: 4, y: 4 }, screen: { x: 40, y: 40 } },
        delta: { tile: { x: 3, y: 3 }, screen: { x: 30, y: 30 } },
        screen: { x: 40, y: 40 }
      },
      actions: { setMode: mode, setItemControls, setContextMenu }
    },
    scene: { rectangles: [], items: [], textBoxes: [], connectors: [] },
    mode
  } as unknown as AnyState & { mode: jest.Mock };
};

/** Cursor mode, pointer held down but NOT yet moved. */
const cursorHeldState = () => {
  const mode = setMode();
  return {
    uiState: {
      mode: cursorMode(),
      mouse: {
        mousedown: { tile: { x: 1, y: 1 } },
        position: { tile: { x: 1, y: 1 }, screen: { x: 10, y: 10 } },
        delta: { tile: { x: 0, y: 0 }, screen: { x: 0, y: 0 } },
        screen: { x: 10, y: 10 }
      },
      actions: { setMode: mode, setItemControls, setContextMenu }
    },
    scene: { rectangles: [], items: [], textBoxes: [], connectors: [] },
    mode
  } as unknown as AnyState & { mode: jest.Mock };
};

const panMode = (temp?: boolean) => {
  const mode = setMode();
  return {
    uiState: {
      mode: { type: 'PAN', showCursor: false, ...(temp === undefined ? {} : { temp }) },
      mouse: { mousedown: null, delta: { screen: { x: 0, y: 0 } } },
      actions: { setMode: mode, setItemControls, setContextMenu, setScroll }
    },
    mode
  } as unknown as AnyState & { mode: jest.Mock };
};

const RECT_REF = { type: 'RECTANGLE', id: 'r1' };
const ITEM_REF = { type: 'ITEM', id: 'i1' };

describe('cursor empty-canvas interaction', () => {
  it('an empty click without meaningful drag stays in Cursor', () => {
    const state = cursorHeldState();

    Cursor.mousemove!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.mode).not.toHaveBeenCalled();
  });

  it('an empty drag enters pan behaviour', () => {
    const state = cursorDraggingState();

    Cursor.mousemove!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.mode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
  });

  it('the automatic pan is marked transient', () => {
    const state = cursorDraggingState();

    Cursor.mousemove!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.mode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN', temp: true })
    );
  });
});

describe('pan persistence', () => {
  it('mouseup after an automatic pan restores Cursor', () => {
    const state = panMode(true);

    Pan.mouseup!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.mode).toHaveBeenCalledWith({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
  });

  it('an explicitly selected Pan persists after mouseup', () => {
    // The Hand tool and the Pan hotkey both set PAN without `temp`.
    const state = panMode(undefined);

    Pan.mouseup!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.mode).not.toHaveBeenCalled();
  });

  it('an explicit Pan flagged temp:false also persists', () => {
    const state = panMode(false);

    Pan.mouseup!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.mode).not.toHaveBeenCalled();
  });

  it('the read-only starting mode (no temp) persists', () => {
    const state = panMode(undefined);

    Pan.mouseup!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.mode).not.toHaveBeenCalled();
  });
});

describe('object drags from Cursor do not trigger canvas panning', () => {
  it('dragging a rectangle starts DRAG_ITEMS, not PAN', () => {
    const state = cursorDraggingState(RECT_REF);

    Cursor.mousemove!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.mode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DRAG_ITEMS' })
    );
    expect(state.mode).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
  });

  it('dragging a node starts DRAG_ITEMS, not PAN', () => {
    const state = cursorDraggingState(ITEM_REF);

    Cursor.mousemove!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.mode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DRAG_ITEMS' })
    );
    expect(state.mode).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
  });
});

describe('locked rectangles are unaffected by the pan change', () => {  it('a locked rectangle drag is ignored, so no mode change at all', () => {
    const mode = setMode();
    const state = {
      uiState: {
        mode: cursorMode(RECT_REF),
        mouse: {
          mousedown: { tile: { x: 1, y: 1 } },
          position: { tile: { x: 4, y: 4 }, screen: { x: 40, y: 40 } },
          delta: { tile: { x: 3, y: 3 }, screen: { x: 30, y: 30 } },
          screen: { x: 40, y: 40 }
        },
        actions: { setMode: mode, setItemControls, setContextMenu }
      },
      // Locked, so Cursor.mousemove bails out before entering any drag mode.
      scene: {
        rectangles: [
          { id: 'r1', from: { x: 0, y: 0 }, to: { x: 4, y: 4 }, locked: true }
        ],
        items: [],
        textBoxes: [],
        connectors: []
      },
      mode
    } as unknown as AnyState & { mode: jest.Mock };

    Cursor.mousemove!({ ...state, isRendererInteraction: true } as AnyState);

    // Neither DRAG_ITEMS nor PAN: the user stays in Cursor and can still select.
    expect(mode).not.toHaveBeenCalled();
  });
});

describe('pan selection guard lifecycle', () => {
  beforeEach(() => {
    stopPanGuard();
  });

  afterEach(() => {
    stopPanGuard();
  });

  const panEntryState = (temp?: boolean) => {
    const mode = setMode();
    return {
      uiState: {
        mode: { type: 'PAN', showCursor: false, ...(temp === undefined ? {} : { temp }) },
        mouse: { mousedown: { tile: { x: 1, y: 1 } }, delta: { screen: { x: 0, y: 0 } } },
        actions: { setMode: mode, setItemControls, setContextMenu, setScroll }
      },
      mode
    } as unknown as AnyState & { mode: jest.Mock };
  };

  it('arms the guard when a transient pan begins', () => {
    Pan.entry!({ ...panEntryState(true) } as AnyState);

    expect(isPanGuardActive()).toBe(true);
  });

  it('does not arm the guard merely for being in explicit Pan mode', () => {
    Pan.entry!({ ...panEntryState(undefined) } as AnyState);

    expect(isPanGuardActive()).toBe(false);
  });

  it('arms the guard when an explicit pan drag actually starts', () => {
    Pan.mousedown!({ ...panEntryState(undefined), isRendererInteraction: true } as AnyState);

    expect(isPanGuardActive()).toBe(true);
  });

  it('does not arm the guard for a mousedown outside the renderer', () => {
    Pan.mousedown!({ ...panEntryState(undefined), isRendererInteraction: false } as AnyState);

    expect(isPanGuardActive()).toBe(false);
  });

  it('releases the guard on mouseup after a transient pan', () => {
    Pan.entry!({ ...panEntryState(true) } as AnyState);
    expect(isPanGuardActive()).toBe(true);

    Pan.mouseup!({ ...panEntryState(true), isRendererInteraction: true } as AnyState);

    expect(isPanGuardActive()).toBe(false);
  });

  it('releases the guard on mouseup after an explicit pan drag', () => {
    Pan.mousedown!({ ...panEntryState(undefined), isRendererInteraction: true } as AnyState);
    expect(isPanGuardActive()).toBe(true);

    Pan.mouseup!({ ...panEntryState(undefined), isRendererInteraction: true } as AnyState);

    expect(isPanGuardActive()).toBe(false);
  });

  it('releases the guard on exit, so it is never left behind', () => {
    startPanGuard();

    Pan.exit!({} as AnyState);

    expect(isPanGuardActive()).toBe(false);
  });
});

import { Cursor } from 'src/interaction/modes/Cursor';
import { DragItems } from 'src/interaction/modes/DragItems';
import { TransformRectangle } from 'src/interaction/modes/Rectangle/TransformRectangle';
import { isRectangleLocked } from 'src/utils/rectangleLock';
import { getItemAtTile } from 'src/utils/renderer';
import { findNearestUnoccupiedTile } from 'src/utils/findNearestUnoccupiedTile';
import { Rectangle } from 'src/types';

type AnyState = Parameters<NonNullable<typeof Cursor.mousemove>>[0];

const buildRectangle = (over: Partial<Rectangle> = {}): Rectangle =>
  ({
    id: 'rect1',
    from: { x: 0, y: 0 },
    to: { x: 4, y: 4 },
    locked: false,
    ...over
  }) as Rectangle;

const buildMouse = ({
  mouseTile = { x: 2, y: 2 },
  mousedownTile = { x: 2, y: 2 },
  moved = false
}: {
  mouseTile?: { x: number; y: number };
  mousedownTile?: { x: number; y: number };
  moved?: boolean;
}) => ({
  mousedown: { tile: mousedownTile },
  position: { tile: mouseTile, screen: { x: 0, y: 0 } },
  // hasMovedTile() keys off delta, so a click without movement needs a zero delta.
  delta: {
    tile: moved
      ? { x: mouseTile.x - mousedownTile.x, y: mouseTile.y - mousedownTile.y }
      : { x: 0, y: 0 },
    screen: { x: 0, y: 0 }
  },
  screen: { x: 0, y: 0 }
});

const buildState = ({
  rectangles = [buildRectangle()],
  items = [],
  textBoxes = [],
  mousedownItem = null,
  mode = 'CURSOR',
  mouseTile = { x: 2, y: 2 },
  mousedownTile = { x: 2, y: 2 },
  moved = false
}: {
  rectangles?: Rectangle[];
  items?: unknown[];
  textBoxes?: unknown[];
  mousedownItem?: unknown;
  mode?: string;
  mouseTile?: { x: number; y: number };
  mousedownTile?: { x: number; y: number };
  moved?: boolean;
} = {}) => {
  const setMode = jest.fn();
  const setItemControls = jest.fn();
  const setContextMenu = jest.fn();

  const uiState = {
    mode:
      mode === 'CURSOR'
        ? { type: 'CURSOR', showCursor: true, mousedownItem }
        : {
            type: mode,
            showCursor: true,
            id: 'rect1',
            selectedAnchor: 'TOP_LEFT',
            mousedownItem
          },
    mouse: buildMouse({ mouseTile, mousedownTile, moved }),
    actions: { setMode, setItemControls, setContextMenu }
  };

  const scene = {
    rectangles,
    items,
    textBoxes,
    connectors: [],
    currentView: { connectors: [] }
  };

  return {
    uiState,
    scene,
    setMode,
    setItemControls,
    setContextMenu
  } as unknown as AnyState & {
    setMode: jest.Mock;
    setItemControls: jest.Mock;
    setContextMenu: jest.Mock;
  };
};

const movedTo = (state: AnyState, x: number, y: number) => {
  const ui = state.uiState as unknown as {
    mouse: {
      mousedown: { tile: { x: number; y: number } };
      position: { tile: { x: number; y: number } };
      delta: { tile: { x: number; y: number } };
    };
  };
  ui.mouse.position.tile = { x, y };
  ui.mouse.delta.tile = {
    x: x - ui.mouse.mousedown.tile.x,
    y: y - ui.mouse.mousedown.tile.y
  };
};

describe('isRectangleLocked', () => {
  it('is false for a legacy rectangle with no locked field', () => {
    const scene = { rectangles: [{ id: 'r' }] };

    expect(isRectangleLocked(scene, 'r')).toBe(false);
  });

  it('is true only for an explicit lock', () => {
    const scene = { rectangles: [{ id: 'a', locked: true }, { id: 'b', locked: false }] };

    expect(isRectangleLocked(scene, 'a')).toBe(true);
    expect(isRectangleLocked(scene, 'b')).toBe(false);
  });

  it('is false for an unknown id', () => {
    expect(isRectangleLocked({ rectangles: [] }, 'missing')).toBe(false);
  });
});

describe('Cursor selection of a locked rectangle', () => {
  it('a locked rectangle still wins the mousedown hit-test', () => {
    const state = buildState({ mousedownItem: null });

    Cursor.mousedown!({
      ...state,
      isRendererInteraction: true
    } as AnyState);

    // mousedownItem is written through immer, so read it off the produced mode.
    const produced = state.setMode.mock.calls[0][0];
    expect(produced.mousedownItem).toEqual({ type: 'RECTANGLE', id: 'rect1' });
  });

  it('clicking a locked rectangle opens its properties panel', () => {
    const state = buildState({
      rectangles: [buildRectangle({ locked: true })],
      mousedownItem: { type: 'RECTANGLE', id: 'rect1' }
    });

    Cursor.mouseup!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.setItemControls).toHaveBeenCalledWith({
      type: 'RECTANGLE',
      id: 'rect1'
    });
  });

  it('clicking an unlocked rectangle opens its properties panel', () => {
    const state = buildState({
      rectangles: [buildRectangle({ locked: false })],
      mousedownItem: { type: 'RECTANGLE', id: 'rect1' }
    });

    Cursor.mouseup!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.setItemControls).toHaveBeenCalledWith({
      type: 'RECTANGLE',
      id: 'rect1'
    });
  });

  it('does not hijack a drag of a locked rectangle into DRAG_ITEMS', () => {
    const state = buildState({
      rectangles: [buildRectangle({ locked: true })],
      mousedownItem: { type: 'RECTANGLE', id: 'rect1' }
    });

    movedTo(state, 9, 9);
    Cursor.mousemove!({ ...state, isRendererInteraction: true } as AnyState);

    // Staying in CURSOR is what keeps mouseup reachable, which is what opens
    // the properties panel. This was the original selection bug.
    expect(state.setMode).not.toHaveBeenCalled();
  });

  it('still starts a drag for an unlocked rectangle', () => {
    const state = buildState({
      rectangles: [buildRectangle({ locked: false })],
      mousedownItem: { type: 'RECTANGLE', id: 'rect1' }
    });

    movedTo(state, 9, 9);
    Cursor.mousemove!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'DRAG_ITEMS' })
    );
  });

  it('a foreground item takes priority over a locked rectangle', () => {
    const state = buildState({
      rectangles: [buildRectangle({ locked: true })],
      items: [{ id: 'item1', tile: { x: 2, y: 2 } }],
      mousedownItem: { type: 'ITEM', id: 'item1' }
    });

    Cursor.mouseup!({ ...state, isRendererInteraction: true } as AnyState);

    expect(state.setItemControls).toHaveBeenCalledWith({
      type: 'ITEM',
      id: 'item1'
    });
  });
});

describe('hit-testing intent', () => {
  const hitScene = (locked: boolean) => ({
    items: [],
    textBoxes: [],
    connectors: [],
    viewOrientation: 'NE' as const,
    rectangles: [buildRectangle({ locked, from: { x: 0, y: 0 }, to: { x: 4, y: 4 } })]
  });

  it('selection mode still hits a locked rectangle', () => {
    // Default (no skip) is what Cursor mode uses.
    expect(
      getItemAtTile({ tile: { x: 2, y: 2 }, scene: hitScene(true) as never })
    ).toEqual({ type: 'RECTANGLE', id: 'rect1' });
  });

  it('placement mode treats a locked rectangle as background', () => {
    expect(
      getItemAtTile({
        tile: { x: 2, y: 2 },
        scene: hitScene(true) as never,
        skipLockedRectangles: true
      })
    ).toBeNull();
  });

  it('placement mode still hits an unlocked rectangle', () => {
    expect(
      getItemAtTile({
        tile: { x: 2, y: 2 },
        scene: hitScene(false) as never,
        skipLockedRectangles: true
      })
    ).toEqual({ type: 'RECTANGLE', id: 'rect1' });
  });

  it('a foreground item wins over a locked rectangle in both modes', () => {
    const scene = {
      ...hitScene(true),
      items: [{ id: 'item1', tile: { x: 2, y: 2 } }]
    };

    expect(getItemAtTile({ tile: { x: 2, y: 2 }, scene: scene as never })).toEqual(
      { type: 'ITEM', id: 'item1' }
    );
    expect(
      getItemAtTile({
        tile: { x: 2, y: 2 },
        scene: scene as never,
        skipLockedRectangles: true
      })
    ).toEqual({ type: 'ITEM', id: 'item1' });
  });

  it('creation tools can place a node over a locked rectangle', () => {
    // findNearestUnoccupiedTile opts out of locked rectangles, so the target
    // tile is returned unchanged instead of being treated as occupied.
    const target = { x: 2, y: 2 };

    expect(
      findNearestUnoccupiedTile(target, hitScene(true) as never)
    ).toEqual(target);
  });
});

describe('DragItems with a locked rectangle', () => {
  const dragState = (locked: boolean) => {
    const updateRectangle = jest.fn();

    return {
      updateRectangle,
      state: {
        uiState: {
          mode: {
            type: 'DRAG_ITEMS',
            showCursor: true,
            items: [{ type: 'RECTANGLE', id: 'rect1' }],
            isInitialMovement: true
          },
          mouse: buildMouse({
            mouseTile: { x: 5, y: 5 },
            mousedownTile: { x: 2, y: 2 },
            moved: true
          }),
          actions: { setMode: jest.fn() }
        },
        scene: {
          rectangles: [buildRectangle({ locked })],
          items: [],
          textBoxes: [],
          connectors: [],
          transaction: (fn: () => void) => fn(),
          updateRectangle
        }
      } as unknown as AnyState
    };
  };

  it('does not move a locked rectangle', () => {
    const { state, updateRectangle } = dragState(true);

    DragItems.mousemove!(state);

    expect(updateRectangle).not.toHaveBeenCalled();
  });

  it('moves an unlocked rectangle', () => {
    const { state, updateRectangle } = dragState(false);

    DragItems.mousemove!(state);

    expect(updateRectangle).toHaveBeenCalledWith(
      'rect1',
      expect.objectContaining({
        from: { x: 3, y: 3 },
        to: { x: 7, y: 7 }
      }),
      undefined
    );
  });
});

describe('TransformRectangle with a locked rectangle', () => {
  const transformState = (locked: boolean, updateRectangle: jest.Mock) =>
    ({
      uiState: {
        mode: {
          type: 'RECTANGLE.TRANSFORM',
          showCursor: true,
          id: 'rect1',
          selectedAnchor: 'TOP_LEFT'
        },
        mouse: buildMouse({
          mouseTile: { x: 9, y: 9 },
          mousedownTile: { x: 2, y: 2 },
          moved: true
        })
      },
      scene: {
        rectangles: [buildRectangle({ locked })],
        updateRectangle
      }
    }) as unknown as AnyState;

  it('does not resize while locked', () => {
    const updateRectangle = jest.fn();

    TransformRectangle.mousemove!(transformState(true, updateRectangle));

    expect(updateRectangle).not.toHaveBeenCalled();
  });

  it('resizes once unlocked', () => {
    const updateRectangle = jest.fn();

    TransformRectangle.mousemove!(transformState(false, updateRectangle));

    expect(updateRectangle).toHaveBeenCalled();
  });
});

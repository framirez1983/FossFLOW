import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useInteractionManager } from 'src/interaction/useInteractionManager';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { ModelProvider } from 'src/stores/modelStore';
import { screenToIso } from 'src/utils/renderer';
import { Rectangle } from 'src/types';

/**
 * Regression tests for the right-click coordinate path.
 *
 * These drive the REAL `onContextMenu` handler through a genuine `contextmenu`
 * DOM event on window, rather than re-implementing its logic. That distinction
 * matters: a helper-level copy of the classification can pass while the actual
 * handler is broken.
 *
 * The bug these pin: mouse state is updated on a RAF throttle, so
 * `uiState.mouse.position.tile` can be stale when `contextmenu` fires. The
 * handler must derive its tile from the event itself.
 */

const RENDERER = { left: 0, top: 0, width: 1000, height: 800 } as DOMRect;

let scene: any;

jest.mock('src/hooks/useScene', () => ({
  useScene: () => scene
}));

jest.mock('src/hooks/useResizeObserver', () => ({
  useResizeObserver: () => ({ size: { width: 1000, height: 800 } })
}));

jest.mock('src/hooks/useHistory', () => ({
  useHistory: () => ({
    undo: jest.fn(),
    redo: jest.fn(),
    canUndo: false,
    canRedo: false
  })
}));

jest.mock('src/interaction/usePanHandlers', () => ({
  usePanHandlers: () => ({
    handleMouseDown: jest.fn(() => false),
    handleMouseUp: jest.fn(() => false)
  })
}));

// One shared tree, so the store API and the interaction manager see the same
// store instance.
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ModelProvider>
    <UiStateProvider>{children}</UiStateProvider>
  </ModelProvider>
);

/** A rectangle guaranteed to cover `tile`, so hit-testing is really exercised. */
const rectCovering = (
  tile: { x: number; y: number },
  over: Partial<Rectangle> = {}
): Rectangle =>
  ({
    id: 'r1',
    from: { x: tile.x - 1, y: tile.y - 1 },
    to: { x: tile.x + 2, y: tile.y + 2 },
    locked: false,
    ...over
  }) as Rectangle;

/** The tile the app derives for a client position, computed independently. */
const expectedTileAt = (clientX: number, clientY: number) =>
  screenToIso({
    mouse: { x: clientX - RENDERER.left, y: clientY - RENDERER.top },
    zoom: 1,
    scroll: { position: { x: 0, y: 0 }, offset: { x: 0, y: 0 } },
    rendererSize: { width: RENDERER.width, height: RENDERER.height },
    viewOrientation: 'NE'
  });

// Deliberately wrong: no processed mousemove has happened at the click point.
const STALE_TILE = { x: 999, y: 999 };

describe('onContextMenu coordinate path', () => {
  let element: HTMLDivElement;

  const setup = () => {
    // Both hooks must share a single provider instance.
    const view = renderHook(
      () => ({ store: useUiStateStoreApi(), manager: useInteractionManager() }),
      { wrapper }
    );
    const store = { result: { current: view.result.current.store } };
    const manager = { result: { current: view.result.current.manager } };

    element = document.createElement('div');
    element.getBoundingClientRect = () => RENDERER;
    document.body.appendChild(element);

    act(() => {
      manager.result.current.setInteractionsElement(
        element as unknown as HTMLElement
      );
      const state = store.result.current.getState();
      state.actions.setZoom(1);
      state.actions.setScroll({
        position: { x: 0, y: 0 },
        offset: { x: 0, y: 0 }
      });
      // Plant a stale mouse position to prove the handler ignores it.
      store.result.current.setState({
        mouse: {
          position: { screen: { x: 0, y: 0 }, tile: STALE_TILE },
          mousedown: null,
          delta: null
        }
      });
    });

    const spy = jest.fn();
    act(() => {
      store.result.current.setState({
        actions: { ...store.result.current.getState().actions, setContextMenu: spy }
      });
    });

    return { store, spy };
  };

  const fireContextMenu = (clientX: number, clientY: number) => {
    act(() => {
      window.dispatchEvent(
        new MouseEvent('contextmenu', {
          clientX,
          clientY,
          bubbles: true,
          cancelable: true
        })
      );
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    scene = { rectangles: [], items: [], textBoxes: [], connectors: [], viewOrientation: 'NE' };
  });

  afterEach(() => {
    element?.remove();
  });

  it('derives the tile from the event, not from stale mouse state', () => {
    const { spy } = setup();

    const clientX = 620;
    const clientY = 380;
    fireContextMenu(clientX, clientY);

    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(arg.type).toBe('EMPTY');
    expect(arg.tile).toEqual(expectedTileAt(clientX, clientY));
    expect(arg.tile).not.toEqual(STALE_TILE);
  });

  it('produces a different tile for a different right-click position', () => {
    const { spy } = setup();

    fireContextMenu(600, 400);
    const first = spy.mock.calls[0][0].tile;
    spy.mockClear();

    fireContextMenu(700, 500);
    const second = spy.mock.calls[0][0].tile;

    expect(second).not.toEqual(first);
  });

  it('a locked rectangle covering the tile is classified as canvas context', () => {
    const { spy } = setup();
    const clientX = 620;
    const clientY = 380;
    const tile = expectedTileAt(clientX, clientY);
    // Sanity: the rectangle must actually cover the clicked tile.
    scene.rectangles = [rectCovering(tile, { locked: true })];

    // Prove the same click without the rectangle is EMPTY too, so the locked
    // case is not passing merely because nothing was hit.
    spy.mockClear();
    scene.rectangles = [];
    fireContextMenu(clientX, clientY);
    const withoutRect = spy.mock.calls[0][0];
    spy.mockClear();

    fireContextMenu(clientX, clientY);
    const withLockedRect = spy.mock.calls[0][0];

    expect(withoutRect.type).toBe('EMPTY');
    expect(withLockedRect.type).toBe('EMPTY');
    expect(withLockedRect.tile).toEqual(tile);
  });

  it('an unlocked rectangle covering the tile keeps its item context', () => {
    const { spy } = setup();
    const clientX = 620;
    const clientY = 380;
    scene.rectangles = [
      rectCovering(expectedTileAt(clientX, clientY), { locked: false })
    ];

    fireContextMenu(clientX, clientY);

    const arg = spy.mock.calls[0][0];
    expect(arg.type).toBe('ITEM');
    expect(arg.item).toEqual({ type: 'RECTANGLE', id: 'r1' });
  });

  it('a legacy rectangle with no locked field keeps its item context', () => {
    const { spy } = setup();
    const clientX = 620;
    const clientY = 380;
    const tile = expectedTileAt(clientX, clientY);
    const legacy = rectCovering(tile);
    delete (legacy as Partial<Rectangle>).locked;
    scene.rectangles = [legacy];

    fireContextMenu(clientX, clientY);

    expect(spy.mock.calls[0][0].type).toBe('ITEM');
  });

  it('a foreground item takes priority and is not fallen through', () => {
    const { spy } = setup();
    const clientX = 620;
    const clientY = 380;
    scene.rectangles = [rectCovering(expectedTileAt(clientX, clientY), { locked: true })];

    // Put a node on the exact tile the event will resolve to.
    scene.items = [{ id: 'item1', tile: expectedTileAt(clientX, clientY) }];

    fireContextMenu(clientX, clientY);

    const arg = spy.mock.calls[0][0];
    expect(arg.type).toBe('ITEM');
    expect(arg.item).toEqual({ type: 'ITEM', id: 'item1' });
  });

  it('does nothing when right-click panning is enabled', () => {
    const { store, spy } = setup();
    act(() => {
      store.result.current.setState({
        panSettings: {
          ...store.result.current.getState().panSettings,
          rightClickPan: true
        }
      });
    });

    fireContextMenu(620, 380);

    expect(spy).not.toHaveBeenCalled();
  });
});

import { produce } from 'immer';
import {
  ConnectorAnchor,
  SceneConnector,
  ModeActions,
  ModeActionsAction,
  Coords,
  View,
  Mode,
  CursorMode
} from 'src/types';
import {
  getItemAtTile,
  getConnectorsAtTile,
  hasMovedTile,
  getAnchorAtTile,
  getItemByIdOrThrow,
  generateId,
  CoordsUtils,
  getAnchorTile,
  connectorPathTileToGlobal,
  isRectangleLocked
} from 'src/utils';
import { useScene } from 'src/hooks/useScene';

const getAnchorOrdering = (
  anchor: ConnectorAnchor,
  connector: SceneConnector,
  view: View
) => {
  const anchorTile = getAnchorTile(anchor, view);
  const index = connector.path.tiles.findIndex((pathTile) => {
    const globalTile = connectorPathTileToGlobal(
      pathTile,
      connector.path.rectangle.from
    );
    return CoordsUtils.isEqual(globalTile, anchorTile);
  });

  if (index === -1) {
    throw new Error(
      `Could not calculate ordering index of anchor [anchorId: ${anchor.id}]`
    );
  }

  return index;
};

const getAnchor = (
  connectorId: string,
  tile: Coords,
  scene: ReturnType<typeof useScene>
) => {
  const connector = getItemByIdOrThrow(scene.connectors, connectorId).value;
  const anchor = getAnchorAtTile(tile, connector.anchors);

  if (!anchor) {
    const newAnchor: ConnectorAnchor = {
      id: generateId(),
      ref: { tile }
    };

    const orderedAnchors = [...connector.anchors, newAnchor]
      .map((anch) => {
        return {
          ...anch,
          ordering: getAnchorOrdering(anch, connector, scene.currentView)
        };
      })
      .sort((a, b) => {
        return a.ordering - b.ordering;
      });

    scene.updateConnector(connector.id, { anchors: orderedAnchors });
    return newAnchor;
  }

  return anchor;
};

const isCursorMode = (mode: Mode): mode is CursorMode => mode.type === 'CURSOR';

const mousedown: ModeActionsAction = ({
  uiState,
  scene,
  isRendererInteraction
}) => {
  if (uiState.mode.type !== 'CURSOR' || !isRendererInteraction) return;

  const itemAtTile = getItemAtTile({
    tile: uiState.mouse.position.tile,
    scene
  });

  if (itemAtTile) {
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = itemAtTile;
      })
    );
  } else {
    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = null;
      })
    );

    uiState.actions.setItemControls(null);

    // Left click on empty canvas is deselect only. The creation menu
    // (Add Node / Add Rectangle) is a right-click action, so any menu that is
    // already open is dismissed rather than re-opened here.
    uiState.actions.setContextMenu(null);
  }
};

export const Cursor: ModeActions = {
  entry: (state) => {
    const { uiState } = state;

    if (uiState.mode.type !== 'CURSOR') return;

    if (uiState.mode.mousedownItem) {
      mousedown(state);
    }
  },
  mousemove: ({ scene, uiState }) => {
    if (uiState.mode.type !== 'CURSOR' || !hasMovedTile(uiState.mouse)) return;

    let item = uiState.mode.mousedownItem;

    if (item?.type === 'CONNECTOR' && uiState.mouse.mousedown) {
      const anchor = getAnchor(item.id, uiState.mouse.mousedown.tile, scene);

      item = {
        type: 'CONNECTOR_ANCHOR',
        id: anchor.id
      };
    }

    // A locked rectangle is a background surface. It stays selectable, but
    // dragging it must not move it, so we deliberately do not enter DRAG_ITEMS.
    // Staying in CURSOR keeps the mouseup handler reachable, which is what
    // actually opens the rectangle's properties panel.
    if (item?.type === 'RECTANGLE' && isRectangleLocked(scene, item.id)) {
      return;
    }

    if (item) {
      uiState.actions.setMode({
        type: 'DRAG_ITEMS',
        showCursor: true,
        items: [item],
        isInitialMovement: true
      });
    } else {
      // If no item is being dragged and the mouse has moved, switch to PAN mode
      // Only do this if the drag started on empty space.
      //
      // `temp` marks this as a transient pan entered automatically from the
      // cursor, so Pan.mouseup restores the cursor afterwards. The Hand tool
      // (and the Pan hotkey / read-only starting mode) deliberately set PAN
      // without `temp`, which is what makes an explicitly selected Pan stick.
      if (uiState.mouse.mousedown) {
        uiState.actions.setMode({
          type: 'PAN',
          showCursor: false,
          temp: true
        });
      }
    }
  },
  mousedown,
  mouseup: ({ uiState, scene, isRendererInteraction }) => {
    if (uiState.mode.type !== 'CURSOR' || !isRendererInteraction) return;

    const hasMoved = uiState.mouse.mousedown && hasMovedTile(uiState.mouse);

    if (isCursorMode(uiState.mode) && uiState.mode.mousedownItem && !hasMoved) {
      if (uiState.mode.mousedownItem.type === 'ITEM') {
        uiState.actions.setItemControls({
          type: 'ITEM',
          id: uiState.mode.mousedownItem.id
        });
      } else if (uiState.mode.mousedownItem.type === 'RECTANGLE') {
        // Locked or not, a rectangle click selects it and opens its properties
        // panel. Geometry mutation is refused separately (see the reducer).
        uiState.actions.setItemControls({
          type: 'RECTANGLE',
          id: uiState.mode.mousedownItem.id
        });
      } else if (uiState.mode.mousedownItem.type === 'CONNECTOR') {
        const clickTile = uiState.mouse.mousedown?.tile ?? uiState.mouse.position.tile;
        const connectorIds = getConnectorsAtTile({ tile: clickTile, scene });

        if (connectorIds.length > 0) {
          uiState.actions.setItemControls({
            type: 'CONNECTOR_GROUP',
            ids: connectorIds,
            focusedId: connectorIds.length === 1 ? connectorIds[0] : null
          });
        }
      } else if (uiState.mode.mousedownItem.type === 'TEXTBOX') {
        uiState.actions.setItemControls({
          type: 'TEXTBOX',
          id: uiState.mode.mousedownItem.id
        });
      }
    } else {
      uiState.actions.setItemControls(null);
    }

    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.mousedownItem = null;
      })
    );
  }
};

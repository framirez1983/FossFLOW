import { produce } from 'immer';
import { ModeActions } from 'src/types';
import { generateId, getItemAtTile, findNearestUnoccupiedTile } from 'src/utils';
import { VIEW_ITEM_DEFAULTS } from 'src/config';

export const PlaceIcon: ModeActions = {
  mousemove: () => {},
  mousedown: ({ uiState, scene, isRendererInteraction }) => {
    if (uiState.mode.type !== 'PLACE_ICON' || !isRendererInteraction) return;

    if (!uiState.mode.id && !uiState.mode.existingModelItemId) {
      const itemAtTile = getItemAtTile({
        tile: uiState.mouse.position.tile,
        scene
      });

      uiState.actions.setMode({
        type: 'CURSOR',
        mousedownItem: itemAtTile,
        showCursor: true
      });

      uiState.actions.setItemControls(null);
    }
  },
  mouseup: ({ uiState, scene }) => {
    if (uiState.mode.type !== 'PLACE_ICON') return;

    if (uiState.mode.existingModelItemId) {
      // Reuse flow: place only a ViewItem for the existing global item,
      // then leave placement mode (a second placement would be a duplicate).
      const targetTile = findNearestUnoccupiedTile(
        uiState.mouse.position.tile,
        scene
      );

      if (targetTile) {
        scene.placeExistingItem(
          uiState.mode.existingModelItemId,
          targetTile
        );
      }

      uiState.actions.setMode({
        type: 'CURSOR',
        mousedownItem: null,
        showCursor: true
      });
      uiState.actions.setItemControls(null);
      return;
    }

    if (uiState.mode.id !== null) {
      // Find the nearest unoccupied tile to the target position
      const targetTile = findNearestUnoccupiedTile(
        uiState.mouse.position.tile,
        scene
      );

      // Place the icon on the nearest unoccupied tile
      if (targetTile) {
        const modelItemId = generateId();

        scene.placeIcon({
          modelItem: {
            id: modelItemId,
            name: 'Untitled',
            icon: uiState.mode.id
          },
          viewItem: {
            ...VIEW_ITEM_DEFAULTS,
            id: modelItemId,
            tile: targetTile
          }
        });
      }
    }

    uiState.actions.setMode(
      produce(uiState.mode, (draft) => {
        draft.id = null;
      })
    );
  }
};

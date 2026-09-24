import { useCallback } from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useSceneStore } from 'src/stores/sceneStore';
import * as reducers from 'src/stores/reducers';
import { Model, Size } from 'src/types';
import { INITIAL_SCENE_STATE } from 'src/config';

export const useView = () => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });

  const sceneActions = useSceneStore((state) => {
    return state.actions;
  });

  const changeView = useCallback(
    (
      viewId: string,
      model: Model,
      textBoxSizes?: {
        [key: string]: Size;
      }
    ) => {
      const newState = reducers.view({
        action: 'SYNC_SCENE',
        payload: undefined,
        ctx: { viewId, state: { model, scene: INITIAL_SCENE_STATE } }
      });

      // Prefer already-resolved TextBox geometry (e.g. from the live editor)
      // over an independent re-measurement. Only ids placed in this view are
      // overlaid; anything missing is measured normally by SYNC_SCENE.
      let scene = newState.scene;
      if (textBoxSizes) {
        const placedIds = new Set(
          (model.views.find((view) => view.id === viewId)?.textBoxes ?? []).map(
            (textBox) => textBox.id
          )
        );
        const overlay: typeof scene.textBoxes = {};
        for (const [id, size] of Object.entries(textBoxSizes)) {
          if (placedIds.has(id)) {
            overlay[id] = { size };
          }
        }
        if (Object.keys(overlay).length > 0) {
          scene = { ...scene, textBoxes: { ...scene.textBoxes, ...overlay } };
        }
      }

      sceneActions.set(scene, true);
      uiStateActions.setView(viewId);
    },
    [uiStateActions, sceneActions]
  );

  return {
    changeView
  };
};

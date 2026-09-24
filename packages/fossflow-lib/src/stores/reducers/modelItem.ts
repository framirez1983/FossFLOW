import { produce } from 'immer';
import { ModelItem } from 'src/types';
import { getConnectorsByViewItem, getItemByIdOrThrow } from 'src/utils';
import { State } from './types';

export const updateModelItem = (
  id: string,
  updates: Partial<ModelItem>,
  state: State
): State => {
  const modelItem = getItemByIdOrThrow(state.model.items, id);

  const newState = produce(state, (draft) => {
    draft.model.items[modelItem.index] = { ...modelItem.value, ...updates };
  });

  return newState;
};

export const createModelItem = (
  newModelItem: ModelItem,
  state: State
): State => {
  const newState = produce(state, (draft) => {
    draft.model.items.push(newModelItem);
  });

  return updateModelItem(newModelItem.id, newModelItem, newState);
};

export const deleteModelItem = (id: string, state: State): State => {
  getItemByIdOrThrow(state.model.items, id);

  return produce(state, (draft) => {
    // Remove the global item itself (filter, not delete: no sparse holes,
    // and this also heals holes left by older saves).
    draft.model.items = draft.model.items.filter(
      (item) => item && item.id !== id
    );

    // Remove every placement of it from every view, plus every connector in
    // those views whose anchors reference it. Unrelated views, placements
    // and connectors are preserved untouched.
    for (const view of draft.model.views) {
      view.items = (view.items ?? []).filter((item) => item.id !== id);

      const connectors = view.connectors ?? [];
      if (connectors.length === 0) continue;

      const removedIds = new Set(
        getConnectorsByViewItem(id, connectors).map(
          (connector) => connector.id
        )
      );

      if (removedIds.size > 0) {
        view.connectors = connectors.filter(
          (connector) => !removedIds.has(connector.id)
        );

        for (const connectorId of removedIds) {
          delete draft.scene.connectors[connectorId];
        }
      }
    }
  });
};

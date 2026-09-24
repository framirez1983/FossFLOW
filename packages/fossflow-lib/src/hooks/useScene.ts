import { useCallback, useMemo, useRef } from 'react';
import { shallow } from 'zustand/shallow';
import {
  ModelItem,
  ViewItem,
  Connector,
  TextBox,
  Rectangle,
  UiStateStore,
  ItemReference,
  Coords
} from 'src/types';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore, useModelStoreApi } from 'src/stores/modelStore';
import { useSceneStore, useSceneStoreApi } from 'src/stores/sceneStore';
import * as reducers from 'src/stores/reducers';
import type { State } from 'src/stores/reducers/types';
import { copyObject, generateId, getItemById, getItemByIdOrThrow, getPastedObject, getTargetTileFunction, isPastedValid } from 'src/utils';
import { constrainedStrings } from 'src/schemas/common';
import {
  CONNECTOR_DEFAULTS,
  RECTANGLE_DEFAULTS,
  TEXTBOX_DEFAULTS,
  VIEW_ITEM_DEFAULTS
} from 'src/config';

export const useScene = () => {
  const { views, colors, icons, items, version, title, description } =
    useModelStore(
      (state) => ({
        views: state.views,
        colors: state.colors,
        icons: state.icons,
        items: state.items,
        version: state.version,
        title: state.title,
        description: state.description
      }),
      shallow
    );
  const { connectors: sceneConnectors, textBoxes: sceneTextBoxes } =
    useSceneStore(
      (state) => ({
        connectors: state.connectors,
        textBoxes: state.textBoxes
      }),
      shallow
    );
  const viewOrientation = useUiStateStore(state => state.viewOrientation);
  const currentViewId = useUiStateStore((state) => state.view);
  const transactionInProgress = useRef(false);

  const modelStoreApi = useModelStoreApi();
  const sceneStoreApi = useSceneStoreApi();

  const currentView = useMemo(() => {
    if (!views || !currentViewId) {
      return {
        id: '',
        name: 'Default View',
        items: [],
        connectors: [],
        rectangles: [],
        textBoxes: []
      };
    }

    try {
      return getItemByIdOrThrow(views, currentViewId).value;
    } catch (error) {
      return (
        views[0] || {
          id: currentViewId,
          name: 'Default View',
          items: [],
          connectors: [],
          rectangles: [],
          textBoxes: []
        }
      );
    }
  }, [currentViewId, views]);

  const itemsList = useMemo(() => {
    return currentView.items ?? [];
  }, [currentView.items]);

  const colorsList = useMemo(() => {
    return colors ?? [];
  }, [colors]);

  const connectorsList = useMemo(() => {
    return (currentView.connectors ?? []).map((connector) => {
      const sceneConnector = sceneConnectors?.[connector.id];

      return {
        ...CONNECTOR_DEFAULTS,
        ...connector,
        ...sceneConnector
      };
    });
  }, [currentView.connectors, sceneConnectors]);

  const rectanglesList = useMemo(() => {
    return (currentView.rectangles ?? []).map((rectangle) => {
      return {
        ...RECTANGLE_DEFAULTS,
        ...rectangle
      };
    });
  }, [currentView.rectangles]);

  const textBoxesList = useMemo(() => {
    return (currentView.textBoxes ?? []).map((textBox) => {
      const sceneTextBox = sceneTextBoxes?.[textBox.id];

      return {
        ...TEXTBOX_DEFAULTS,
        ...textBox,
        ...sceneTextBox
      };
    });
  }, [currentView.textBoxes, sceneTextBoxes]);

  const getState = useCallback((): State => {
    const model = modelStoreApi.getState();
    const scene = sceneStoreApi.getState();
    return {
      model: {
        version: model.version,
        title: model.title,
        description: model.description,
        labelBackgroundOpacity: model.labelBackgroundOpacity,
        colors: model.colors,
        icons: model.icons,
        items: model.items,
        views: model.views
      },
      scene: {
        connectors: scene.connectors,
        textBoxes: scene.textBoxes
      }
    };
  }, [modelStoreApi, sceneStoreApi]);

  const setState = useCallback(
    (newState: State) => {
      modelStoreApi.getState().actions.set(newState.model, true);
      sceneStoreApi.getState().actions.set(newState.scene, true);
    },
    [modelStoreApi, sceneStoreApi]
  );

  const saveToHistoryBeforeChange = useCallback(() => {
    if (transactionInProgress.current) {
      return;
    }

    modelStoreApi.getState().actions.saveToHistory();
    sceneStoreApi.getState().actions.saveToHistory();
  }, [modelStoreApi, sceneStoreApi]);

  const createModelItem = useCallback(
    (newModelItem: ModelItem, state?: State) => {

      if (!transactionInProgress.current) {
        saveToHistoryBeforeChange();
      }

      const newState = reducers.createModelItem(newModelItem, state || getState());
      setState(newState);
      return newState;
    },
    [getState, setState, saveToHistoryBeforeChange]
  );

  const updateModelItem = useCallback(
    (id: string, updates: Partial<ModelItem>) => {
      saveToHistoryBeforeChange();
      const newState = reducers.updateModelItem(id, updates, getState());
      setState(newState);
    },
    [getState, setState, saveToHistoryBeforeChange]
  );

  const deleteModelItem = useCallback(
    (id: string) => {
      if (!transactionInProgress.current) {
        saveToHistoryBeforeChange();
      }
      const newState = reducers.deleteModelItem(id, getState());
      setState(newState);
    },
    [getState, setState, saveToHistoryBeforeChange]
  );

  const createViewItem = useCallback(
    (newViewItem: ViewItem, currentState?: State) => {
      if (!currentViewId) return;

      if (!transactionInProgress.current) {
        saveToHistoryBeforeChange();
      }

      const stateToUse = currentState || getState();

      const newState = reducers.view({
        action: 'CREATE_VIEWITEM',
        payload: newViewItem,
        ctx: { viewId: currentViewId, state: stateToUse }
      });
      setState(newState);
      return newState;
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const updateViewItem = useCallback(
    (id: string, updates: Partial<ViewItem>, currentState?: State) => {
      if (!currentViewId) return getState();

      if (!transactionInProgress.current) {
        saveToHistoryBeforeChange();
      }

      const stateToUse = currentState || getState();
      const newState = reducers.view({
        action: 'UPDATE_VIEWITEM',
        payload: { id, ...updates },
        ctx: { viewId: currentViewId, state: stateToUse }
      });
      setState(newState);
      return newState;
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const deleteViewItem = useCallback(
    (id: string) => {
      if (!currentViewId) return;

      saveToHistoryBeforeChange();
      const newState = reducers.view({
        action: 'DELETE_VIEWITEM',
        payload: id,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const renameView = useCallback(
    (id: string, name: string): boolean => {
      const maxLength = constrainedStrings.name.maxLength ?? 100;
      const trimmed = name.trim().substring(0, maxLength);

      if (!trimmed) return false;

      const existing = getItemById(getState().model.views, id);
      if (!existing || existing.value.name === trimmed) return false;

      if (!transactionInProgress.current) {
        saveToHistoryBeforeChange();
      }

      const newState = reducers.view({
        action: 'UPDATE_VIEW',
        payload: { name: trimmed },
        ctx: { viewId: id, state: getState() }
      });
      setState(newState);
      return true;
    },
    [getState, setState, saveToHistoryBeforeChange]
  );

  const createView = useCallback(
    (name: string): string | null => {
      const maxLength = constrainedStrings.name.maxLength ?? 100;
      const trimmed = name.trim().substring(0, maxLength);

      if (!trimmed) return null;

      if (!transactionInProgress.current) {
        saveToHistoryBeforeChange();
      }

      const id = generateId();
      const newState = reducers.view({
        action: 'CREATE_VIEW',
        payload: { name: trimmed },
        ctx: { viewId: id, state: getState() }
      });
      setState(newState);
      return id;
    },
    [getState, setState, saveToHistoryBeforeChange]
  );

  const placeExistingItem = useCallback(
    (modelItemId: string, tile: Coords): boolean => {
      if (!currentViewId) return false;

      const stateToUse = getState();

      // Guard 1: the global item must exist (never create model data here).
      if (!getItemById(stateToUse.model.items, modelItemId)) return false;

      // Guard 2: no duplicate placement within one view. Cross-view reuse
      // is allowed; each view owns its ViewItem independently.
      const view = getItemById(stateToUse.model.views, currentViewId);
      if (!view) return false;
      if (view.value.items.some((item) => item.id === modelItemId)) {
        return false;
      }

      if (!transactionInProgress.current) {
        saveToHistoryBeforeChange();
      }

      const newState = reducers.view({
        action: 'CREATE_VIEWITEM',
        payload: { ...VIEW_ITEM_DEFAULTS, id: modelItemId, tile },
        ctx: { viewId: currentViewId, state: stateToUse }
      });
      setState(newState);
      return true;
    },
    [currentViewId, getState, setState, saveToHistoryBeforeChange]
  );

  const createConnector = useCallback(
    (newConnector: Connector) => {
      if (!currentViewId) return;

      saveToHistoryBeforeChange();
      const newState = reducers.view({
        action: 'CREATE_CONNECTOR',
        payload: newConnector,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const updateConnector = useCallback(
    (id: string, updates: Partial<Connector>) => {
      if (!currentViewId) return;

      saveToHistoryBeforeChange();
      const newState = reducers.view({
        action: 'UPDATE_CONNECTOR',
        payload: { id, ...updates },
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const deleteConnector = useCallback(
    (id: string) => {
      if (!currentViewId) return;

      saveToHistoryBeforeChange();
      const newState = reducers.view({
        action: 'DELETE_CONNECTOR',
        payload: id,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const createTextBox = useCallback(
    (newTextBox: TextBox, state?: State) => {
      saveToHistoryBeforeChange();
      const newState = reducers.view({
        action: 'CREATE_TEXTBOX',
        payload: newTextBox,
        ctx: { viewId: currentViewId, state: state || getState() }
      });
      setState(newState);
      return newState;
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const updateTextBox = useCallback(
    (id: string, updates: Partial<TextBox>, currentState?: State) => {
      if (!currentViewId) return currentState || getState();

      if (!transactionInProgress.current) {
        saveToHistoryBeforeChange();
      }

      const stateToUse = currentState || getState();
      const newState = reducers.view({
        action: 'UPDATE_TEXTBOX',
        payload: { id, ...updates },
        ctx: { viewId: currentViewId, state: stateToUse }
      });
      setState(newState);
      return newState;
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const deleteTextBox = useCallback(
    (id: string) => {
      if (!currentViewId) return;

      saveToHistoryBeforeChange();
      const newState = reducers.view({
        action: 'DELETE_TEXTBOX',
        payload: id,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const createRectangle = useCallback(
    (newRectangle: Rectangle, state?: State) => {
      if (!currentViewId) return;

      saveToHistoryBeforeChange();
      const newState = reducers.view({
        action: 'CREATE_RECTANGLE',
        payload: newRectangle,
        ctx: { viewId: currentViewId, state: state || getState() }
      });
      setState(newState);
      return newState;
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const updateRectangle = useCallback(
    (id: string, updates: Partial<Rectangle>, currentState?: State) => {
      if (!currentViewId) return currentState || getState();

      if (!transactionInProgress.current) {
        saveToHistoryBeforeChange();
      }

      const stateToUse = currentState || getState();
      const newState = reducers.view({
        action: 'UPDATE_RECTANGLE',
        payload: { id, ...updates },
        ctx: { viewId: currentViewId, state: stateToUse }
      });
      setState(newState);
      return newState;
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const deleteRectangle = useCallback(
    (id: string) => {
      if (!currentViewId) return;

      saveToHistoryBeforeChange();
      const newState = reducers.view({
        action: 'DELETE_RECTANGLE',
        payload: id,
        ctx: { viewId: currentViewId, state: getState() }
      });
      setState(newState);
    },
    [getState, setState, currentViewId, saveToHistoryBeforeChange]
  );

  const transaction = useCallback(
    (operations: () => void) => {
      if (transactionInProgress.current) {
        operations();
        return;
      }

      saveToHistoryBeforeChange();
      transactionInProgress.current = true;

      try {
        operations();
      } finally {
        transactionInProgress.current = false;
      }
    },
    [saveToHistoryBeforeChange]
  );

  const placeIcon = useCallback(
    (params: { modelItem: ModelItem; viewItem: ViewItem }) => {
      saveToHistoryBeforeChange();
      transactionInProgress.current = true;

      try {
        const stateAfterModelItem = createModelItem(params.modelItem);

        if (stateAfterModelItem) {
          createViewItem(params.viewItem, stateAfterModelItem);
        }
      } finally {
        transactionInProgress.current = false;
      }
    },
    [createModelItem, createViewItem, saveToHistoryBeforeChange]
  );

  const copyObjectsToClipboard = (uiState: UiStateStore) => {
    const model = modelStoreApi.getState()
    const selectedObjects = (
      uiState.mode.type === 'LASSO' ||
      uiState.mode.type === 'FREEHAND_LASSO'
    ) && uiState.mode.selection ?
      uiState.mode.selection.items
      :
      [uiState.itemControls && 'id' in uiState.itemControls ? (uiState.itemControls as ItemReference) : null].filter(Boolean) as ItemReference[];

    copyObject(selectedObjects.map((currentItem) => {
      if (!currentItem) return;
      switch (currentItem.type) {
        case 'ITEM': {
          const modelItem = getItemById(model.items, currentItem.id)?.value;
          const viewItem = getItemById(currentView.items, currentItem.id)?.value;
          if (!viewItem || !modelItem) return;

          return { type: currentItem.type, item: { modelItem, viewItem } }
        }
        case 'RECTANGLE': {
          if (!currentView.rectangles) return;
          const item = getItemById(currentView.rectangles, currentItem.id)?.value;
          return { type: currentItem.type, item }
        }
        case 'TEXTBOX': {
          if (!currentView.textBoxes) return;
          const item = getItemById(currentView.textBoxes, currentItem.id)?.value;
          return { type: currentItem.type, item }
        }
      }
    }));
  }

  const pasteObjectsFromClipboard: (uiState: UiStateStore, activeScene: ReturnType<typeof useScene>) => Promise<void> = 
  async (uiState, activeScene) => {
    const pastedArray = await getPastedObject();
    if (!isPastedValid(pastedArray)) return;

    saveToHistoryBeforeChange();
    transactionInProgress.current = true;

    try {
      const mouseTile = uiState.mouse.position.tile;
      const getTargetTile = getTargetTileFunction(pastedArray[0], mouseTile, activeScene);
      let state: State | undefined;
  
      pastedArray.forEach(pastedObject => {
        const newId = generateId();
  
        if (pastedObject.type === 'ITEM') {
          const { viewItem, modelItem } = pastedObject.item;
          const stateWithNewModel = createModelItem({
            ...modelItem,
            id: newId
          }, state)
          
          // Chain updated state from each iteration
          state = createViewItem({
            ...viewItem,
            id: newId,
            tile: getTargetTile(viewItem.tile)
          }, stateWithNewModel)
        } else if (pastedObject.type === 'RECTANGLE') {
          state = createRectangle({
            ...pastedObject.item, 
            id: newId,
            from: getTargetTile(pastedObject.item.from),
            to: getTargetTile(pastedObject.item.to)
          }, state)
        } else if (pastedObject.type === "TEXTBOX") {
          state = createTextBox({
            ...pastedObject.item, 
            id: newId,
            tile: getTargetTile(pastedObject.item.tile)
          }, state);
        }
      })
    } finally {
      transactionInProgress.current = false;
    }
  }

  return {
    viewOrientation,
    items: itemsList,
    connectors: connectorsList,
    colors: colorsList,
    rectangles: rectanglesList,
    textBoxes: textBoxesList,
    currentView,
    createModelItem,
    updateModelItem,
    deleteModelItem,
    renameView,
    createView,
    placeExistingItem,
    createViewItem,
    updateViewItem,
    deleteViewItem,
    createConnector,
    updateConnector,
    deleteConnector,
    createTextBox,
    updateTextBox,
    deleteTextBox,
    createRectangle,
    updateRectangle,
    deleteRectangle,
    transaction,
    placeIcon,
    copyObjectsToClipboard,
    pasteObjectsFromClipboard,
  };
};

import { orientProjected, inverseOrientation, VIEW_ORIENTATIONS } from 'src/utils/viewOrientation';
import { screenToIso } from 'src/utils/renderer';
import React, { createContext, useContext, useRef } from 'react';
import { createStore, useStore } from 'zustand';
import {
  CoordsUtils,
  incrementZoom,
  decrementZoom,
  getStartingMode
} from 'src/utils';
import { UiStateStore } from 'src/types';
import { INITIAL_UI_STATE } from 'src/config';
import { DEFAULT_HOTKEY_PROFILE, HotkeyProfile } from 'src/config/hotkeys';
import { DEFAULT_PAN_SETTINGS } from 'src/config/panSettings';
import { DEFAULT_ZOOM_SETTINGS } from 'src/config/zoomSettings';
import { DEFAULT_LABEL_SETTINGS } from 'src/config/labelSettings';

const initialState = () => {
  return createStore<UiStateStore>((set, get) => {
    return {
      viewOrientation: 'NE',
      zoom: INITIAL_UI_STATE.zoom,
      scroll: INITIAL_UI_STATE.scroll,
      view: '',
      mainMenuOptions: [],
      editorMode: 'EXPLORABLE_READONLY',
      mode: getStartingMode('EXPLORABLE_READONLY'),
      iconCategoriesState: [],
      isMainMenuOpen: false,
      isExistingItemPickerOpen: false,
      dialog: null,
      rendererEl: null,
      contextMenu: null,
      mouse: {
        position: { screen: CoordsUtils.zero(), tile: CoordsUtils.zero() },
        mousedown: null,
        delta: null
      },
      itemControls: null,
      enableDebugTools: false,
      hotkeyProfile: DEFAULT_HOTKEY_PROFILE,
      panSettings: DEFAULT_PAN_SETTINGS,
      zoomSettings: DEFAULT_ZOOM_SETTINGS,
      labelSettings: DEFAULT_LABEL_SETTINGS,
      connectorInteractionMode: 'click', // Default to click mode
      expandLabels: false, // Default to collapsed labels
      iconPackManager: null, // Will be set by Isoflow if provided
      libraryManager: null, // Will be set by Isoflow if provided
      customMenuItems: {},

      actions: {
        rotateView: (clockwise) => {
          const state = get();
          // Do not change the coordinate frame underneath an active gesture.
          if (
            state.mouse.mousedown ||
            state.mode.type === 'DRAG_ITEMS' ||
            state.mode.type === 'RECTANGLE.DRAW' ||
            state.mode.type === 'RECTANGLE.TRANSFORM' ||
            (state.mode.type === 'CONNECTOR' &&
              (state.mode.id || state.mode.isConnecting))
          ) return;

          const index = VIEW_ORIENTATIONS.indexOf(state.viewOrientation);
          const viewOrientation = VIEW_ORIENTATIONS[
            (index + (clockwise ? 3 : 1)) % 4
          ];
          // Reorient the pan vector to keep the same fractional model point centered.
          const reorient = (point: { x: number; y: number }) =>
            orientProjected(
              orientProjected(point, inverseOrientation(state.viewOrientation)),
              viewOrientation
            );
          const scroll = {
            position: reorient(state.scroll.position),
            offset: reorient(state.scroll.offset)
          };
          const rendererSize = state.rendererEl?.getBoundingClientRect();
          const tile = rendererSize
            ? screenToIso({
                mouse: state.mouse.position.screen,
                zoom: state.zoom,
                scroll,
                rendererSize,
                viewOrientation
              })
            : state.mouse.position.tile;

          set({
            viewOrientation,
            scroll,
            mouse: {
              position: { screen: state.mouse.position.screen, tile },
              delta: null,
              mousedown: null
            },
            // The outline is cached in screen coordinates; retain model-space selection.
            ...(state.mode.type === 'FREEHAND_LASSO'
              ? { mode: { ...state.mode, path: [] } }
              : {})
          });
        },
        setView: (view) => {
          set({ view });
        },
        setMainMenuOptions: (mainMenuOptions) => {
          set({ mainMenuOptions });
        },
        setEditorMode: (mode) => {
          set({ editorMode: mode, mode: getStartingMode(mode) });
        },
        setIconCategoriesState: (iconCategoriesState) => {
          set({ iconCategoriesState });
        },
        resetUiState: () => {
          set({
            mode: getStartingMode(get().editorMode),
            scroll: {
              position: CoordsUtils.zero(),
              offset: CoordsUtils.zero()
            },
            itemControls: null,
            zoom: 1,
            viewOrientation: 'NE'
          });
        },
        setMode: (mode) => {
          set({ mode });
        },
        setDialog: (dialog) => {
          set({ dialog });
        },
        setIsMainMenuOpen: (isMainMenuOpen) => {
          set({ isMainMenuOpen, itemControls: null });
        },
        setIsExistingItemPickerOpen: (isExistingItemPickerOpen) => {
          set({ isExistingItemPickerOpen });
        },
        incrementZoom: () => {
          const { zoom } = get();
          set({ zoom: incrementZoom(zoom) });
        },
        decrementZoom: () => {
          const { zoom } = get();
          set({ zoom: decrementZoom(zoom) });
        },
        setZoom: (zoom) => {
          set({ zoom });
        },
        setScroll: ({ position, offset }) => {
          set({ scroll: { position, offset: offset ?? get().scroll.offset } });
        },
        setItemControls: (itemControls) => {
          set({ itemControls });
        },
        setContextMenu: (contextMenu) => {
          set({ contextMenu });
        },
        setMouse: (mouse) => {
          set({ mouse });
        },
        setEnableDebugTools: (enableDebugTools) => {
          set({ enableDebugTools });
        },
        setRendererEl: (el: HTMLDivElement) => {
          set({ rendererEl: el });
        },
        setHotkeyProfile: (hotkeyProfile: HotkeyProfile) => {
          set({ hotkeyProfile });
        },
        setPanSettings: (panSettings) => {
          set({ panSettings });
        },
        setZoomSettings: (zoomSettings) => {
          set({ zoomSettings });
        },
        setLabelSettings: (labelSettings) => {
          set({ labelSettings });
        },
        setConnectorInteractionMode: (connectorInteractionMode) => {
          set({ connectorInteractionMode });
        },
        setExpandLabels: (expandLabels) => {
          set({ expandLabels });
        },
        setIconPackManager: (iconPackManager) => {
          set({ iconPackManager });
        },
        setLibraryManager: (libraryManager) => {
          set({ libraryManager });
        },
        setCustomMenuItems: (customMenuItems) => {
          set({ customMenuItems });
        },
        setViewOrientation: (viewOrientation) => {
          set({ viewOrientation });
        }
      }
    };
  });
};

const UiStateContext = createContext<ReturnType<typeof initialState> | null>(
  null
);

interface ProviderProps {
  children: React.ReactNode;
}

// TODO: Typings below are pretty gnarly due to the way Zustand works.
// see https://github.com/pmndrs/zustand/discussions/1180#discussioncomment-3439061
export const UiStateProvider = ({ children }: ProviderProps) => {
  const storeRef = useRef<ReturnType<typeof initialState> | undefined>(undefined);

  if (!storeRef.current) {
    storeRef.current = initialState();
  }

  return (
    <UiStateContext.Provider value={storeRef.current}>
      {children}
    </UiStateContext.Provider>
  );
};

export function useUiStateStore<T>(
  selector: (state: UiStateStore) => T,
  equalityFn?: (left: T, right: T) => boolean
) {
  const store = useContext(UiStateContext);

  if (store === null) {
    throw new Error('Missing provider in the tree');
  }

  const value = useStore(store, selector, equalityFn);
  return value;
}

// Hook to get store API for imperative access (getState without subscribing)
export function useUiStateStoreApi() {
  const store = useContext(UiStateContext);

  if (store === null) {
    throw new Error('Missing provider in the tree');
  }

  return store;
}

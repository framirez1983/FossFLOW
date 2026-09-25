import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider, useSceneStoreApi } from 'src/stores/sceneStore';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { useView } from 'src/hooks/useView';
import { modelFromModelStore } from 'src/utils';
import { Model } from 'src/types';
import { ItemManager } from '../ItemManager';

const buildModel = (): Model => {
  return {
    title: 'Inventory',
    version: '1.0',
    icons: [],
    colors: [],
    items: [
      { id: 'n1', name: 'First' },
      { id: 'n2', name: 'Second' },
      { id: 'n3', name: 'Third' }
    ],
    views: [
      {
        id: 'v1',
        name: 'Main',
        items: [
          { id: 'n1', tile: { x: 0, y: 0 } },
          { id: 'n2', tile: { x: 2, y: 0 } }
        ],
        connectors: [
          {
            id: 'c1',
            anchors: [
              { id: 'a0', ref: { item: 'n1' } },
              { id: 'a1', ref: { item: 'n2' } }
            ]
          },
          {
            id: 'c2',
            anchors: [
              { id: 'a2', ref: { item: 'n2' } },
              { id: 'a3', ref: { tile: { x: 9, y: 9 } } }
            ]
          },
          {
            id: 'c4',
            anchors: [
              { id: 'a6', ref: { item: 'n1' } },
              { id: 'a7', ref: { tile: { x: 3, y: 3 } } }
            ]
          }
        ]
      },
      {
        id: 'v2',
        name: 'Second view',
        items: [{ id: 'n2', tile: { x: 1, y: 1 } }],
        connectors: [
          {
            id: 'c3',
            anchors: [
              { id: 'a4', ref: { item: 'n2' } },
              { id: 'a5', ref: { tile: { x: 4, y: 4 } } }
            ]
          }
        ]
      }
    ]
  };
};

let sceneProbe: ReturnType<typeof useScene>;
let viewProbe: ReturnType<typeof useView>;

const Probe = () => {
  sceneProbe = useScene();
  viewProbe = useView();
  return null;
};

const renderManager = () => {
  let modelApi!: ReturnType<typeof useModelStoreApi>;
  let sceneApi!: ReturnType<typeof useSceneStoreApi>;
  let uiApi!: ReturnType<typeof useUiStateStoreApi>;
  const Capture = () => {
    modelApi = useModelStoreApi();
    sceneApi = useSceneStoreApi();
    uiApi = useUiStateStoreApi();
    return null;
  };
  const utils = render(
    <ThemeProvider theme={theme}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <Capture />
            <Probe />
            <ItemManager open onClose={() => {}} />
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );

  act(() => {
    modelApi.getState().actions.set(buildModel(), true);
    uiApi.getState().actions.setEditorMode('EDITABLE');
    uiApi.getState().actions.setView('v1');
  });

  return { ...utils, modelApi, sceneApi, uiApi };
};

describe('ItemManager', () => {
  it('lists every global item with usage counts', () => {
    renderManager();

    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.getByText('Third')).toBeTruthy();
    expect(screen.getByText('Used in 1 view')).toBeTruthy();
    expect(screen.getByText('Used in 2 views')).toBeTruthy();
    expect(screen.getByText('Unused')).toBeTruthy();
  });

  it('filters by search', () => {
    renderManager();

    fireEvent.change(screen.getByLabelText('Search items'), {
      target: { value: 'hir' }
    });
    expect(screen.queryByText('First')).toBeNull();
    expect(screen.queryByText('Second')).toBeNull();
    expect(screen.getByText('Third')).toBeTruthy();
  });

  it('canceling the confirmation deletes nothing', () => {
    const { modelApi } = renderManager();
    const before = JSON.stringify({
      items: modelApi.getState().items,
      views: modelApi.getState().views
    });

    fireEvent.click(screen.getByLabelText('Delete Second'));
    fireEvent.click(screen.getByText('Cancel'));

    expect(
      JSON.stringify({
        items: modelApi.getState().items,
        views: modelApi.getState().views
      })
    ).toBe(before);
    expect(modelApi.getState().actions.canUndo()).toBe(false);
  });

  it('deleting an unused item removes only the ModelItem', () => {
    const { modelApi } = renderManager();
    const viewsBefore = JSON.stringify(modelApi.getState().views);

    fireEvent.click(screen.getByLabelText('Delete Third'));
    expect(
      screen.getByText(/Delete "Third" permanently from the inventory\?/)
    ).toBeTruthy();
    fireEvent.click(screen.getByText('Delete', { selector: 'button' }));

    expect(modelApi.getState().items.map((item) => item.id)).toEqual([
      'n1',
      'n2'
    ]);
    expect(JSON.stringify(modelApi.getState().views)).toBe(viewsBefore);
    expect(modelApi.getState().actions.canUndo()).toBe(true);
  });

  it('deleting a used item cleans every view and its connectors in one history entry', () => {
    const { modelApi, sceneApi, uiApi } = renderManager();
    const unrelatedItems = JSON.stringify(
      modelApi
        .getState()
        .items.filter((item) => item.id !== 'n2')
    );

    // Sync the live scene so cache assertions below are meaningful.
    act(() => {
      viewProbe.changeView(
        'v1',
        modelFromModelStore(modelApi.getState())
      );
    });
    expect(Object.keys(sceneApi.getState().connectors)).toEqual(
      expect.arrayContaining(['c1', 'c4'])
    );

    fireEvent.click(screen.getByLabelText('Delete Second'));
    expect(screen.getByText(/used in 2 views/)).toBeTruthy();
    fireEvent.click(
      screen.getAllByText('Delete').find((el) => el.tagName === 'BUTTON')!
    );

    const state = modelApi.getState();
    // Global item gone, no sparse holes.
    expect(state.items.map((item) => item.id)).toEqual(['n1', 'n3']);
    expect(state.items).toHaveLength(2);
    // Placements gone from every view.
    for (const view of state.views) {
      expect(view.items.map((item) => item.id)).not.toContain('n2');
    }
    // Connectors referencing it gone from every affected view (c1, c2, c3);
    // unrelated connectors would remain (none here besides those).
    const connectorIds = (state.views ?? []).flatMap((view) =>
      (view.connectors ?? []).map((connector) => connector.id)
    );
    // Only the unrelated connector survives, in its original view.
    expect(connectorIds).toEqual(['c4']);
    expect(
      state.views
        .find((view) => view.id === 'v1')
        ?.connectors?.map((connector) => connector.id)
    ).toEqual(['c4']);
    // Scene cache cleaned (c1 gone, c4 retained); unrelated model items
    // byte-identical.
    expect(Object.keys(sceneApi.getState().connectors)).not.toContain('c1');
    expect(Object.keys(sceneApi.getState().connectors)).toContain('c4');
    expect(JSON.stringify(state.items.filter((item) => item.id !== 'n2'))).toBe(
      unrelatedItems
    );
    // Exactly one history entry for the whole cascade.
    expect(state.history.past).toHaveLength(1);

    // Other views still switch cleanly with valid scenes.
    act(() => {
      uiApi.getState().actions.setView('v2');
    });
    expect(sceneProbe.items.map((item) => item.id)).toEqual([]);
    act(() => {
      uiApi.getState().actions.setView('v1');
    });
    expect(sceneProbe.items.map((item) => item.id)).toEqual(['n1']);
  });
});

describe('ItemManager Icon Library', () => {
  const LIB_URL = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';

  const buildLibraryModel = (): Model => {
    return {
      ...buildModel(),
      icons: [
        {
          id: 'imported-icon-1',
          name: 'Custom Icon',
          url: LIB_URL,
          collection: 'imported',
          isIsometric: true
        },
        {
          id: 'core-icon-1',
          name: 'Core Server',
          url: 'https://example.com/server.svg',
          collection: 'isoflow',
          isIsometric: true
        }
      ],
      items: [
        { id: 'n1', name: 'Custom Item', icon: 'imported-icon-1' },
        { id: 'n2', name: 'Core Item', icon: 'core-icon-1' },
        { id: 'n3', name: 'Iconless Item' }
      ]
    };
  };

  const renderLibraryManager = (manager: any) => {
    const rendered = renderManager();
    act(() => {
      rendered.modelApi.getState().actions.set(buildLibraryModel(), true);
      rendered.uiApi.getState().actions.setLibraryManager(manager);
    });
    return rendered;
  };

  const makeManager = (overrides?: any) => {
    return {
      icons: [],
      loading: false,
      error: null,
      unavailable: false,
      refresh: jest.fn(),
      addIcon: jest.fn(async () => {
        return { entry: { id: 'lib_x' }, duplicate: false };
      }),
      renameIcon: jest.fn(),
      deleteIcon: jest.fn(),
      isInLibrary: jest.fn(() => false),
      ...overrides
    };
  };

  it('exposes Add to Library only for imported-icon items', () => {
    renderLibraryManager(makeManager());

    expect(
      screen.getByLabelText('Add icon of Custom Item to Library')
    ).toBeTruthy();
    expect(
      screen.queryByLabelText('Add icon of Core Item to Library')
    ).toBeNull();
    expect(
      screen.queryByLabelText('Add icon of Iconless Item to Library')
    ).toBeNull();
  });

  it('adds the icon asset (not the ModelItem) and confirms', async () => {
    const manager = makeManager();
    renderLibraryManager(manager);

    fireEvent.click(
      screen.getByLabelText('Add icon of Custom Item to Library')
    );

    expect(manager.addIcon).toHaveBeenCalledTimes(1);
    expect(manager.addIcon.mock.calls[0][0]).toMatchObject({
      id: 'imported-icon-1',
      url: LIB_URL,
      collection: 'imported'
    });
  });

  it('shows In Library instead of the action when already present', () => {
    renderLibraryManager(makeManager({ isInLibrary: () => true }));

    expect(
      screen.queryByLabelText('Add icon of Custom Item to Library')
    ).toBeNull();
    expect(screen.getByText('In Library')).toBeTruthy();
  });

  it('hides library actions when the server is unavailable', () => {
    renderLibraryManager(makeManager({ unavailable: true }));

    expect(
      screen.queryByLabelText('Add icon of Custom Item to Library')
    ).toBeNull();
    // Delete semantics are unchanged.
    expect(screen.getByLabelText('Delete Custom Item')).toBeTruthy();
  });
});

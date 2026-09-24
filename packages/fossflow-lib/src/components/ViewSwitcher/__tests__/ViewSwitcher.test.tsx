import React from 'react';
import {
  render,
  screen,
  fireEvent,
  within,
  act
} from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider, useSceneStoreApi } from 'src/stores/sceneStore';
import {
  UiStateProvider,
  useUiStateStoreApi
} from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { Model } from 'src/types';
import { modelSchema } from 'src/schemas/model';
import { ViewSwitcher } from '../ViewSwitcher';

const buildModel = (): Model => {  return {
    title: 'S4Optik',
    version: '1.0',
    icons: [],
    colors: [{ id: 'color1', value: '#a5b8f3' }],
    items: [
      { id: 'n1', name: 'First' },
      { id: 'n2', name: 'Second' }
    ],
    views: [
      {
        id: 'v1',
        name: 'Main Network',
        items: [{ id: 'n1', tile: { x: 0, y: 0 } }]
      },
      {
        id: 'v2',
        name: 'Logical Network',
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
          }
        ]
      }
    ]
  };
};

let sceneProbe: ReturnType<typeof useScene>;

const Probe = () => {
  sceneProbe = useScene();
  return null;
};

describe('ViewSwitcher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSwitcher = () => {
    let modelApi!: ReturnType<typeof useModelStoreApi>;
    let uiApi!: ReturnType<typeof useUiStateStoreApi>;
    const Capture = () => {
      modelApi = useModelStoreApi();
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
              <ViewSwitcher />
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

    return { ...utils, modelApi, uiApi };
  };

  it('displays the active view name', () => {
    renderSwitcher();

    expect(
      screen.getByRole('button', { name: /Main Network/ })
    ).toBeTruthy();
  });

  it('lists all views with the active one selected', async () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));

    const menu = await screen.findByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(
      expect.arrayContaining(['Main Network', 'Logical Network', 'Rename view…'])
    );
    expect(items[0].className).toMatch(/Mui-selected/);
  });

  it('switching views updates the rendered scene without touching shared items', async () => {
    const { modelApi, uiApi } = renderSwitcher();
    const itemsBefore = JSON.stringify(
      modelApi.getState().items
    );

    expect(sceneProbe.items).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Logical Network'));

    expect(uiApi.getState().view).toBe('v2');
    expect(sceneProbe.items).toHaveLength(2);
    expect(JSON.stringify(modelApi.getState().items)).toBe(itemsBefore);
    // Switching alone records no history.
    expect(modelApi.getState().actions.canUndo()).toBe(false);
  });

  it('rename trims, persists to model.views and records history', async () => {
    const { modelApi } = renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Rename view…'));

    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText(
      'View name'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  Core  ' } });
    fireEvent.click(within(dialog).getByText('Save'));

    expect(
      modelApi.getState().views.find((view) => view.id === 'v1')?.name
    ).toBe('Core');
    expect(modelApi.getState().actions.canUndo()).toBe(true);
    expect(
      await screen.findByRole('button', { name: /Core/ })
    ).toBeTruthy();
  });

  it('rename rejects empty names and treats the same name as a no-op', async () => {
    const { modelApi } = renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Rename view…'));

    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText(
      'View name'
    ) as HTMLInputElement;

    // Empty (whitespace-only) disables Save.
    fireEvent.change(input, { target: { value: '   ' } });
    expect(
      (within(dialog).getByText('Save').closest('button') as HTMLButtonElement)
        .disabled
    ).toBe(true);

    // Same name is a no-op: no history entry.
    fireEvent.change(input, { target: { value: 'Main Network' } });
    fireEvent.click(within(dialog).getByText('Save'));
    expect(
      modelApi.getState().views.find((view) => view.id === 'v1')?.name
    ).toBe('Main Network');
    expect(modelApi.getState().actions.canUndo()).toBe(false);
  });

  it('hides the rename action outside EDITABLE mode', async () => {
    const { uiApi } = renderSwitcher();

    act(() => {
      uiApi.getState().actions.setEditorMode('EXPLORABLE_READONLY');
    });

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByText('Rename view…')).toBeNull();
  });

  it('creates an empty view with a fresh id and switches to it', async () => {
    const { modelApi, uiApi } = renderSwitcher();
    const itemsBefore = JSON.stringify(modelApi.getState().items);
    const existingIds = modelApi.getState().views.map((view) => view.id);

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('New view…'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('New view')).toBeTruthy();
    const input = within(dialog).getByLabelText(
      'View name'
    ) as HTMLInputElement;
    // Default suggestion follows the project convention.
    expect(input.value).toBe('Untitled view');

    fireEvent.change(input, { target: { value: '  Wi-Fi  ' } });
    fireEvent.click(within(dialog).getByText('Create'));

    const views = modelApi.getState().views;
    expect(views).toHaveLength(3);
    const created = views[2];
    expect(created.name).toBe('Wi-Fi');
    expect(existingIds).not.toContain(created.id);
    expect(created.items).toEqual([]);
    expect(created.connectors ?? []).toEqual([]);
    expect(created.rectangles ?? []).toEqual([]);
    expect(created.textBoxes ?? []).toEqual([]);
    // Shared model inventory untouched.
    expect(JSON.stringify(modelApi.getState().items)).toBe(itemsBefore);
    // The new view becomes active with an empty scene.
    expect(uiApi.getState().view).toBe(created.id);
    expect(sceneProbe.items).toHaveLength(0);
    // Creation is a single undoable model mutation.
    expect(modelApi.getState().history.past).toHaveLength(1);
  });

  it('rejects an empty name when creating a view', async () => {
    const { modelApi } = renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('New view…'));

    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText(
      'View name'
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    expect(
      (within(dialog).getByText('Create').closest('button') as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(modelApi.getState().views).toHaveLength(2);
    expect(modelApi.getState().actions.canUndo()).toBe(false);
  });

  it('switching back to the original view restores its scene', async () => {
    const { modelApi, uiApi } = renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    let menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('New view…'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('View name'), {
      target: { value: 'Wi-Fi' }
    });
    fireEvent.click(within(dialog).getByText('Create'));
    const createdId = modelApi.getState().views[2].id;
    expect(uiApi.getState().view).toBe(createdId);

    // Awaited: the create dialog may still be finishing its close transition.
    fireEvent.click(await screen.findByRole('button', { name: /Wi-Fi/ }));
    menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Main Network'));

    expect(uiApi.getState().view).toBe('v1');
    expect(sceneProbe.items).toHaveLength(1);
  });

  it('save/reload preserves all views including the created one', async () => {
    const { modelApi } = renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('New view…'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('View name'), {
      target: { value: 'Wi-Fi' }
    });
    fireEvent.click(within(dialog).getByText('Create'));

    const saved = JSON.stringify(modelApi.getState());
    const reloaded = modelSchema.parse(JSON.parse(saved));

    expect(reloaded.views.map((view) => view.name)).toEqual([
      'Main Network',
      'Logical Network',
      'Wi-Fi'
    ]);
  });

  it('places an existing item as ViewItem-only with the same id', () => {
    const { modelApi } = renderSwitcher();
    const itemsBefore = JSON.stringify(modelApi.getState().items);
    const otherViewBefore = JSON.stringify(
      modelApi.getState().views.find((view) => view.id === 'v2')
    );

    let placed = false;
    act(() => {
      placed = sceneProbe.placeExistingItem('n2', { x: 5, y: 5 });
    });

    expect(placed).toBe(true);
    const v1 = modelApi.getState().views.find((view) => view.id === 'v1');
    expect(v1?.items).toHaveLength(2);
    expect(v1?.items[0]).toMatchObject({ id: 'n2', tile: { x: 5, y: 5 } });
    // Zero new ModelItems; the other view is byte-identical.
    expect(JSON.stringify(modelApi.getState().items)).toBe(itemsBefore);
    expect(
      JSON.stringify(
        modelApi.getState().views.find((view) => view.id === 'v2')
      )
    ).toBe(otherViewBefore);
    // No connectors copied into the active view.
    expect(v1?.connectors ?? []).toEqual([]);
    // Single undoable mutation.
    expect(modelApi.getState().actions.canUndo()).toBe(true);
  });

  it('rejects duplicate placement and unknown ids defensively', () => {
    const { modelApi } = renderSwitcher();

    let first = false;
    let duplicate = true;
    let unknown = true;
    act(() => {
      first = sceneProbe.placeExistingItem('n2', { x: 5, y: 5 });
    });
    const historyAfterFirst = modelApi.getState().history.past.length;
    act(() => {
      duplicate = sceneProbe.placeExistingItem('n2', { x: 6, y: 6 });
      unknown = sceneProbe.placeExistingItem('nope', { x: 6, y: 6 });
    });

    expect(first).toBe(true);
    expect(duplicate).toBe(false);
    expect(unknown).toBe(false);
    expect(
      modelApi.getState().views.find((view) => view.id === 'v1')?.items
    ).toHaveLength(2);
    expect(modelApi.getState().history.past).toHaveLength(historyAfterFirst);
  });

  it('view menu stays concerned with views only', async () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).queryByText('Add existing item…')).toBeNull();
    expect(within(menu).getByText('New view…')).toBeTruthy();
    expect(within(menu).getByText('Rename view…')).toBeTruthy();
  });
});

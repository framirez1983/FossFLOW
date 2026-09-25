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
        description: 'First view notes',
        items: [{ id: 'n1', tile: { x: 0, y: 0 } }],
        connectors: [
          {
            id: 'c0',
            anchors: [
              { id: 'ax0', ref: { item: 'n1' } },
              { id: 'ax1', ref: { tile: { x: 4, y: 0 } } }
            ],
            labels: [{ id: 'lx1', text: 'Link', position: 50 }]
          }
        ],
        rectangles: [{ id: 'r1', from: { x: 0, y: 0 }, to: { x: 2, y: 2 }, locked: false }],
        textBoxes: [{ id: 'tb1', tile: { x: 3, y: 3 }, content: 'Note' }]
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
  const realCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    jest.restoreAllMocks();
    // Deterministic canvas text measurement for scene syncs involving
    // text boxes (jsdom has no 2d context).
    jest
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string, ...rest: unknown[]) => {
        if (tagName === 'canvas') {
          return {
            getContext: () => {
              return {
                font: '',
                measureText: () => {
                  return { width: 250 };
                }
              };
            },
            remove: () => {}
          } as unknown as HTMLCanvasElement;
        }
        return (realCreateElement as (...args: unknown[]) => Element)(
          tagName,
          ...rest
        );
      }) as typeof document.createElement);
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
    // Existing connectors in the active view are preserved untouched.
    expect(
      modelApi.getState().views.find((view) => view.id === 'v1')?.connectors
    ).toEqual([
      expect.objectContaining({
        id: 'c0',
        labels: [expect.objectContaining({ id: 'lx1', text: 'Link' })]
      })
    ]);
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
    expect(within(menu).getByText('Duplicate view')).toBeTruthy();
    expect(within(menu).getByText('Rename view…')).toBeTruthy();
    expect(within(menu).getByText('Delete view…')).toBeTruthy();
  });

  it('duplicates the active view with independent view-owned identity', async () => {
    const { modelApi, uiApi } = renderSwitcher();
    const itemsBefore = JSON.stringify(modelApi.getState().items);

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Duplicate view'));

    const views = modelApi.getState().views;
    expect(views).toHaveLength(3);
    const source = views.find((view) => view.id === 'v1')!;
    const copy = views[2];
    expect(copy.name).toBe('Main Network Copy');
    expect(copy.description).toBe('First view notes');
    expect(copy.id).not.toBe('v1');

    // Placements reference the same global ids; nothing else is shared.
    expect(copy.items).toEqual(source.items);
    expect(copy.items[0]).not.toBe(source.items[0]);
    expect(JSON.stringify(modelApi.getState().items)).toBe(itemsBefore);

    // View-owned entities: fresh ids, preserved content and topology.
    expect(copy.connectors).toHaveLength(1);
    expect(copy.connectors?.[0].id).not.toBe('c0');
    expect(
      copy.connectors?.[0].anchors.map((anchor) => anchor.ref)
    ).toEqual([{ item: 'n1' }, { tile: { x: 4, y: 0 } }]);
    expect(
      copy.connectors?.[0].anchors.map((anchor) => anchor.id)
    ).not.toEqual(['ax0', 'ax1']);
    expect(copy.connectors?.[0].labels?.[0].text).toBe('Link');
    expect(copy.connectors?.[0].labels?.[0].id).not.toBe('lx1');
    expect(copy.rectangles).toHaveLength(1);
    expect(copy.rectangles?.[0].id).not.toBe('r1');
    expect(copy.rectangles?.[0].from).toEqual({ x: 0, y: 0 });
    expect(copy.textBoxes).toHaveLength(1);
    expect(copy.textBoxes?.[0].id).not.toBe('tb1');
    expect(copy.textBoxes?.[0].content).toBe('Note');

    // Duplicate becomes active with a single history entry.
    expect(uiApi.getState().view).toBe(copy.id);
    expect(modelApi.getState().history.past).toHaveLength(1);
  });

  it('modifying the duplicate leaves the source view unchanged', async () => {
    const { modelApi } = renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Duplicate view'));

    const copy = modelApi.getState().views[2];
    const copyBoxId = copy.textBoxes?.[0].id!;
    act(() => {
      sceneProbe.updateTextBox(copyBoxId, { content: 'Changed' });
    });

    expect(
      modelApi.getState().views
        .find((view) => view.id === 'v1')
        ?.textBoxes?.[0].content
    ).toBe('Note');
    expect(
      modelApi.getState().views
        .find((view) => view.id === copy.id)
        ?.textBoxes?.[0].content
    ).toBe('Changed');
  });

  it('numbers duplicate names Copy, Copy 2, Copy 3', async () => {
    const { modelApi } = renderSwitcher();

    const openMenuAndDuplicate = async (buttonName: RegExp) => {
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
      const menu = await screen.findByRole('menu');
      fireEvent.click(within(menu).getByText('Duplicate view'));
    };

    await openMenuAndDuplicate(/Main Network/);
    expect(
      modelApi.getState().views.map((view) => view.name)
    ).toEqual(['Main Network', 'Logical Network', 'Main Network Copy']);

    await openMenuAndDuplicate(/Main Network Copy/);
    expect(
      modelApi.getState().views.map((view) => view.name)
    ).toEqual([
      'Main Network',
      'Logical Network',
      'Main Network Copy',
      'Main Network Copy 2'
    ]);
  });

  it('deletes a non-active view and keeps the current view', async () => {
    const { modelApi, uiApi } = renderSwitcher();
    const itemsBefore = JSON.stringify(modelApi.getState().items);

    let result!: { deleted: boolean; switchToId: string | null };
    act(() => {
      result = sceneProbe.deleteView('v2');
    });

    expect(result).toEqual({ deleted: true, switchToId: null });
    expect(modelApi.getState().views.map((view) => view.id)).toEqual(['v1']);
    expect(uiApi.getState().view).toBe('v1');
    expect(JSON.stringify(modelApi.getState().items)).toBe(itemsBefore);
    expect(modelApi.getState().history.past).toHaveLength(1);
  });

  it('deletes the active view through the menu and switches deterministically', async () => {
    const { modelApi, uiApi } = renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Delete view…'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Delete view "Main Network"\?/)).toBeTruthy();
    fireEvent.click(within(dialog).getByText('Delete'));

    // v1 (index 0) removed; nearest remaining by array order is old v2.
    expect(modelApi.getState().views.map((view) => view.id)).toEqual(['v2']);
    expect(uiApi.getState().view).toBe('v2');
    expect(
      modelApi.getState().items.map((item) => item.id)
    ).toEqual(['n1', 'n2']);
    expect(modelApi.getState().history.past).toHaveLength(1);
  });

  it('canceling delete confirmation removes nothing', async () => {
    const { modelApi, uiApi } = renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Delete view…'));

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Cancel'));

    expect(modelApi.getState().views).toHaveLength(2);
    expect(uiApi.getState().view).toBe('v1');
    expect(modelApi.getState().actions.canUndo()).toBe(false);
  });

  it('refuses to delete the last view, in UI and defensively', async () => {
    const { modelApi, uiApi } = renderSwitcher();

    // Reduce to a single view first.
    act(() => {
      expect(sceneProbe.deleteView('v2')).toEqual({
        deleted: true,
        switchToId: null
      });
    });

    // UI disables the action.
    fireEvent.click(screen.getByRole('button', { name: /Main Network/ }));
    const menu = await screen.findByRole('menu');
    const deleteItem = within(menu).getByText('Delete view…').closest('li');
    expect(deleteItem?.getAttribute('aria-disabled')).toBe('true');

    // Direct calls are refused without mutating anything.
    const historyLength = modelApi.getState().history.past.length;
    let result!: { deleted: boolean; switchToId: string | null };
    act(() => {
      result = sceneProbe.deleteView('v1');
    });
    expect(result).toEqual({ deleted: false, switchToId: null });
    expect(modelApi.getState().views.map((view) => view.id)).toEqual(['v1']);
    expect(uiApi.getState().view).toBe('v1');
    expect(modelApi.getState().history.past).toHaveLength(historyLength);
  });

  it('undo restores a deleted view with its contents', async () => {
    const { modelApi } = renderSwitcher();

    act(() => {
      sceneProbe.deleteView('v2');
    });
    expect(modelApi.getState().views).toHaveLength(1);

    act(() => {
      expect(modelApi.getState().actions.undo()).toBe(true);
    });

    const views = modelApi.getState().views;
    expect(views).toHaveLength(2);
    expect(views.find((view) => view.id === 'v2')?.name).toBe(
      'Logical Network'
    );
    expect(
      views.find((view) => view.id === 'v2')?.connectors?.[0].id
    ).toBe('c1');
  });
});

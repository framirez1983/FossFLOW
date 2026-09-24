import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import {
  UiStateProvider,
  useUiStateStoreApi
} from 'src/stores/uiStateStore';
import { Model } from 'src/types';
import { modelSchema } from 'src/schemas/model';
import { IconSelectionControls } from '../IconSelectionControls';

const buildModel = (): Model => {
  return {
    title: 'Icons',
    version: '1.0',
    icons: [
      {
        id: 'imp-used',
        name: 'Used Import',
        url: 'data:image/png;base64,AAA',
        collection: 'imported',
        isIsometric: true
      },
      {
        id: 'imp-free',
        name: 'Free Import',
        url: 'data:image/png;base64,BBB',
        collection: 'imported',
        isIsometric: true
      },
      {
        id: 'core1',
        name: 'Core Block',
        url: 'http://example.com/block.svg',
        collection: 'isoflow',
        isIsometric: true
      }
    ],
    colors: [],
    items: [{ id: 'n1', name: 'First', icon: 'imp-used' }],
    views: [
      {
        id: 'v1',
        name: 'Main',
        items: [{ id: 'n1', tile: { x: 0, y: 0 } }]
      }
    ]
  };
};

const renderControls = () => {
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
            <IconSelectionControls />
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );

  act(() => {
    modelApi.getState().actions.set(buildModel(), true);
    uiApi.getState().actions.setEditorMode('EDITABLE');
    uiApi.getState().actions.setIconCategoriesState([
      { id: 'imported', isExpanded: true },
      { id: 'isoflow', isExpanded: true }
    ]);
  });

  return { ...utils, modelApi, uiApi };
};

describe('IconSelectionControls imported icon management', () => {
  it('rename changes the display name while the using item keeps resolving', async () => {
    const { modelApi } = renderControls();

    fireEvent.click(
      screen.getByRole('button', { name: 'Rename Used Import' })
    );

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Icon name'), {
      target: { value: '  Renamed Import  ' }
    });
    fireEvent.click(within(dialog).getByText('Save'));

    const icons = modelApi.getState().icons;
    expect(icons.find((icon) => icon.id === 'imp-used')?.name).toBe(
      'Renamed Import'
    );
    // The ModelItem still references the stable id and resolves.
    const item = modelApi.getState().items.find((entry) => entry.id === 'n1');
    expect(item?.icon).toBe('imp-used');
    // Search uses the new name immediately.
    fireEvent.change(screen.getByPlaceholderText('Search icons'), {
      target: { value: 'Renamed' }
    });
    expect(screen.getByText('Renamed Import')).toBeTruthy();
    // Rename is a single undoable mutation.
    expect(modelApi.getState().actions.canUndo()).toBe(true);
  });

  it('blocks deletion of a used icon without touching icons', async () => {
    const { modelApi } = renderControls();
    const before = JSON.stringify(modelApi.getState().icons);

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Used Import' })
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/used by 1 item\(s\)\. Reassign those items/)
    ).toBeTruthy();
    // No Delete action is offered for used icons.
    expect(within(dialog).queryByText('Delete', { selector: 'button' }));
    fireEvent.click(within(dialog).getByText('Close'));

    expect(JSON.stringify(modelApi.getState().icons)).toBe(before);
    expect(modelApi.getState().actions.canUndo()).toBe(false);
  });

  it('deletes an unused icon after confirmation, leaving others identical', async () => {
    const { modelApi } = renderControls();

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Free Import' })
    );

    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Delete "Free Import" permanently/)
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByText('Delete'));

    const icons = modelApi.getState().icons;
    expect(icons.map((icon) => icon.id).sort()).toEqual(
      ['core1', 'imp-used'].sort()
    );
    expect(modelApi.getState().actions.canUndo()).toBe(true);
  });

  it('canceling the delete confirmation is a no-op', async () => {
    const { modelApi } = renderControls();
    const before = JSON.stringify(modelApi.getState().icons);

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Free Import' })
    );

    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Cancel'));

    expect(JSON.stringify(modelApi.getState().icons)).toBe(before);
    expect(modelApi.getState().actions.canUndo()).toBe(false);
  });

  it('management clicks never arm icon placement', () => {
    const { uiApi } = renderControls();

    act(() => {
      uiApi.getState().actions.setMode({
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null
      });
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Delete Free Import' })
    );
    expect(uiApi.getState().mode.type).toBe('CURSOR');
  });

  it('save/load retains the rename and the deletion', async () => {
    const { modelApi } = renderControls();

    fireEvent.click(
      screen.getByRole('button', { name: 'Rename Used Import' })
    );
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Icon name'), {
      target: { value: 'Renamed Import' }
    });
    fireEvent.click(within(dialog).getByText('Save'));

    fireEvent.click(
      await screen.findByRole('button', { name: 'Delete Free Import' })
    );
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByText('Delete'));

    const saved = JSON.stringify(modelApi.getState());
    const reloaded = modelSchema.parse(JSON.parse(saved));

    expect(
      reloaded.icons.find((icon) => icon.id === 'imp-used')?.name
    ).toBe('Renamed Import');
    expect(reloaded.icons.map((icon) => icon.id).sort()).toEqual(
      ['core1', 'imp-used'].sort()
    );
    expect(
      reloaded.items.find((item) => item.id === 'n1')?.icon
    ).toBe('imp-used');
  });
});

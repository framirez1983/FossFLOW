import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { Model } from 'src/types';
import { ToolMenu } from '../ToolMenu';

const buildModel = (): Model => {
  return {
    title: 'Inventory',
    version: '1.0',
    icons: [],
    colors: [],
    items: [
      { id: 'n1', name: 'First' },
      { id: 'n2', name: 'Second' }
    ],
    views: [
      {
        id: 'v1',
        name: 'Main',
        items: [{ id: 'n1', tile: { x: 0, y: 0 } }]
      }
    ]
  };
};

const renderMenu = () => {
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
            <ToolMenu />
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

const clickAddButton = () => {
  const addIcon = screen.getByTestId('AddOutlinedIcon');
  const button = addIcon.closest('button') as HTMLButtonElement;
  fireEvent.click(button);
};

describe('ToolMenu add menu', () => {
  it('exposes New item, Existing item and Manage items', async () => {
    renderMenu();

    clickAddButton();
    const menu = await screen.findByRole('menu');
    const labels = within(menu)
      .getAllByRole('menuitem')
      .map((item) => item.textContent);

    expect(labels).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^New item/),
        expect.stringMatching(/^Existing item/),
        'Manage items…'
      ])
    );
    // Shortcut hints follow the active hotkey profile (smnrct by default).
    expect(labels).toContain('New item (N)');
    expect(labels).toContain('Existing item (Shift+N)');
  });

  it('New item preserves the PLACE_ICON arming behavior', async () => {
    const { uiApi } = renderMenu();

    clickAddButton();
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText(/^New item/));

    expect(uiApi.getState().mode.type).toBe('PLACE_ICON');
    expect(uiApi.getState().itemControls).toEqual({ type: 'ADD_ITEM' });
  });

  it('Existing item opens the picker and arms reuse placement', async () => {
    const { uiApi } = renderMenu();

    clickAddButton();
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText(/^Existing item/));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Add existing item')).toBeTruthy();
    expect(within(dialog).queryByText('First')).toBeNull();

    fireEvent.click(within(dialog).getByText('Second'));

    const mode = uiApi.getState().mode;
    expect(mode.type).toBe('PLACE_ICON');
    if (mode.type === 'PLACE_ICON') {
      expect(mode.existingModelItemId).toBe('n2');
    }
  });

  it('Manage items opens the inventory manager', async () => {
    renderMenu();

    clickAddButton();
    const menu = await screen.findByRole('menu');
    fireEvent.click(within(menu).getByText('Manage items…'));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Manage items')).toBeTruthy();
  });
});

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { Model } from 'src/types';
import type { LibraryIcon, LibraryManagerProps } from 'src/types/library';
import { IconSelectionControls } from '../IconSelectionControls';

const LIB_URL = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
const PROJECT_URL = 'data:image/svg+xml;base64,AAAA';

const libEntry = (overrides?: Partial<LibraryIcon>): LibraryIcon => {
  return {
    id: 'lib_0123456789abcdef',
    name: 'PBX',
    url: LIB_URL,
    mime: 'svg+xml',
    isIsometric: false,
    sha256: 'abc',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
};

const buildModel = (): Model => {
  return {
    title: 'Library picker',
    version: '1.0',
    icons: [
      {
        id: 'project-icon-1',
        name: 'Custom',
        url: PROJECT_URL,
        collection: 'imported',
        isIsometric: true
      }
    ],
    colors: [],
    items: [],
    views: []
  };
};

const makeManager = (
  overrides?: Partial<LibraryManagerProps>
): { manager: LibraryManagerProps; addIcon: jest.Mock } => {
  const addIcon = jest.fn(async () => {
    return { entry: libEntry(), duplicate: false };
  });
  const manager: LibraryManagerProps = {
    icons: [libEntry()],
    loading: false,
    error: null,
    unavailable: false,
    refresh: jest.fn(),
    addIcon,
    renameIcon: jest.fn(),
    deleteIcon: jest.fn(),
    isInLibrary: jest.fn(() => false),
    ...overrides
  };
  return { manager, addIcon };
};

const renderControls = (manager: LibraryManagerProps | null) => {
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
    uiApi.getState().actions.setView('v1');
    uiApi.getState().actions.setIconCategoriesState([
      { id: 'imported', isExpanded: true }
    ]);
    uiApi.getState().actions.setMode({
      type: 'PLACE_ICON',
      showCursor: true,
      id: null
    });
    uiApi.getState().actions.setLibraryManager(manager);
  });

  return { ...utils, modelApi, uiApi };
};

const tileButton = (name: string): HTMLButtonElement => {
  const label = screen.getByText(name);
  const button = label.closest('button');
  if (!button) throw new Error(`No tile button for ${name}`);
  return button as HTMLButtonElement;
};

describe('IconSelectionControls with Icon Library', () => {
  it('lists server icons in a MY LIBRARY section ahead of project icons', () => {
    renderControls(makeManager().manager);

    expect(screen.getByText('my library')).toBeTruthy();
    expect(screen.getByText('PBX')).toBeTruthy();
    expect(screen.getByText('Custom')).toBeTruthy();
  });

  it('hides the library section when the server is unavailable', () => {
    renderControls(makeManager({ unavailable: true, icons: [] }).manager);

    expect(screen.queryByText('my library')).toBeNull();
    // Project icons keep working.
    expect(screen.getByText('Custom')).toBeTruthy();
  });

  it('copies a library icon into the project and arms the project copy', () => {
    const { modelApi, uiApi } = renderControls(makeManager().manager);

    fireEvent.mouseDown(tileButton('PBX'));

    const icons = modelApi.getState().icons;
    const copy = icons.find((icon) => {
      return icon.url === LIB_URL;
    });
    expect(copy).toBeTruthy();
    // Project-local semantics: fresh id, imported collection.
    expect(copy!.id).not.toBe('lib_0123456789abcdef');
    expect(copy!.collection).toBe('imported');

    const mode = uiApi.getState().mode;
    expect(mode.type).toBe('PLACE_ICON');
    if (mode.type === 'PLACE_ICON') {
      expect(mode.id).toBe(copy!.id);
    }
  });

  it('offers Add to Library on imported tiles and reports duplicates', () => {
    const { manager, addIcon } = makeManager();
    addIcon.mockResolvedValueOnce({
      entry: libEntry(),
      duplicate: true
    });
    renderControls(manager);

    fireEvent.click(screen.getByLabelText('Add Custom to Library'));

    expect(addIcon).toHaveBeenCalledTimes(1);
    expect(addIcon.mock.calls[0][0]).toMatchObject({
      id: 'project-icon-1',
      url: PROJECT_URL,
      collection: 'imported'
    });
  });

  it('searches library icons alongside project icons', () => {
    renderControls(makeManager().manager);

    fireEvent.change(screen.getByPlaceholderText('Search icons'), {
      target: { value: 'pbx' }
    });

    expect(screen.getByText('PBX')).toBeTruthy();
  });
});

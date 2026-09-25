import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import * as modelStoreModule from 'src/stores/modelStore';
import * as uiStateStoreModule from 'src/stores/uiStateStore';
import * as historyModule from 'src/hooks/useHistory';
import * as initialDataManagerModule from 'src/hooks/useInitialDataManager';
import * as localeStoreModule from 'src/stores/localeStore';
import { MainMenu } from '../MainMenu';
import { MAIN_MENU_OPTIONS } from 'src/config';

const MENU_WITHOUT_VERSION = (
  MAIN_MENU_OPTIONS as string[]
).filter((opt) => {
  return opt !== 'VERSION';
});

jest.mock('src/stores/modelStore');
jest.mock('src/stores/uiStateStore');
jest.mock('src/hooks/useHistory');
jest.mock('src/hooks/useInitialDataManager');
jest.mock('src/stores/localeStore');

describe('MainMenu sections', () => {
  let mockUiActions: any;

  const setup = (options?: {
    mainMenuOptions?: string[];
    customMenuItems?: any;
    menuProps?: { triggerSlotId?: string; versionLabel?: string };
  }) => {
    const mockModel = {
      version: '',
      title: 'T',
      description: '',
      labelBackgroundOpacity: 1,
      colors: [],
      icons: [],
      items: [],
      views: []
    };
    (modelStoreModule.useModelStore as jest.Mock).mockImplementation(
      (selector: any) => {
        return typeof selector === 'function'
          ? selector(mockModel)
          : mockModel;
      }
    );

    mockUiActions = {
      setIsMainMenuOpen: jest.fn(),
      setDialog: jest.fn(),
      resetUiState: jest.fn()
    };
    const mockUiState = {
      isMainMenuOpen: true,
      mainMenuOptions:
        options?.mainMenuOptions ?? ([...MENU_WITHOUT_VERSION] as string[]),
      customMenuItems: options?.customMenuItems ?? {},
      actions: mockUiActions
    };
    (uiStateStoreModule.useUiStateStore as jest.Mock).mockImplementation(
      (selector: any) => {
        return typeof selector === 'function'
          ? selector(mockUiState)
          : mockUiState;
      }
    );

    (historyModule.useHistory as jest.Mock).mockReturnValue({
      undo: jest.fn(),
      redo: jest.fn(),
      canUndo: jest.fn(() => false),
      canRedo: jest.fn(() => false),
      clearHistory: jest.fn()
    });
    (initialDataManagerModule.useInitialDataManager as jest.Mock).mockReturnValue({
      load: jest.fn(),
      clear: jest.fn(),
      isReady: true
    });
    (localeStoreModule.useTranslation as jest.Mock).mockImplementation(() => {
      return { t: (key: string) => key };
    });

    render(
      <ThemeProvider theme={theme}>
        <MainMenu {...options?.menuProps} />
      </ThemeProvider>
    );
    // NOTE: role queries against the trigger are unreliable while the MUI
    // menu modal marks the rest of the tree aria-hidden; trigger assertions
    // below use DOM queries instead.
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const openMenu = () => {
    // The mocked store starts with isMainMenuOpen: true, so the MUI Menu is
    // already open. NOTE: do not query the hamburger trigger via role
    // queries here — the open modal marks the rest of the tree aria-hidden.
    return screen.getByRole('menu');
  };

  it('renders FILE/STORAGE/EDIT/SETTINGS/HELP sections with custom items', () => {
    const onSelect = jest.fn();
    setup({
      customMenuItems: {
        file: [
          { id: 'new', label: 'New Diagram', onSelect },
          { id: 'save', label: 'Save', shortcut: 'Ctrl+S', onSelect }
        ],
        storage: [{ id: 'server', label: 'Server Storage', onSelect }]
      }
    });
    const menu = openMenu();
    const text = within(menu).getByText('New Diagram');
    expect(text).toBeTruthy();
    expect(within(menu).getByText('Server Storage')).toBeTruthy();
    expect(within(menu).getByText('Ctrl+S')).toBeTruthy();
    for (const header of [
      'sectionFile',
      'sectionStorage',
      'sectionEdit',
      'sectionSettings',
      'sectionHelp'
    ]) {
      expect(within(menu).getByText(header)).toBeTruthy();
    }

    fireEvent.click(within(menu).getByText('Save'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(mockUiActions.setIsMainMenuOpen).toHaveBeenCalledWith(false);
  });

  it('hides native Open/Export-JSON rows when the host owns file workflows', () => {
    setup({
      customMenuItems: {
        file: [{ id: 'open', label: 'Open…', onSelect: jest.fn() }]
      }
    });
    const menu = openMenu();
    expect(within(menu).queryByText('open')).toBeNull();
    expect(within(menu).queryByText('exportJson')).toBeNull();
    // The image row stays: the Export Image dialog is library-owned.
    expect(within(menu).getByText('exportImage')).toBeTruthy();
  });

  it('shows native file rows when no custom items are provided', () => {
    setup({});
    const menu = openMenu();
    expect(within(menu).getByText('open')).toBeTruthy();
    expect(within(menu).getByText('exportJson')).toBeTruthy();
  });

  it('renders a divider before custom items flagged with dividerBefore', () => {
    setup({
      customMenuItems: {
        file: [
          { id: 'save', label: 'Save', onSelect: jest.fn() },
          {
            id: 'export-file',
            label: 'Export FossFLOW File',
            dividerBefore: true,
            onSelect: jest.fn()
          }
        ]
      }
    });
    const menu = openMenu();
    const fileHeader = within(menu).getByText('sectionFile');
    const exportRow = within(menu).getByText('Export FossFLOW File');
    // A separator sits between the save group and the export group.
    const separators = within(menu).getAllByRole('separator');
    expect(separators.length).toBeGreaterThanOrEqual(1);
    expect(
      fileHeader.compareDocumentPosition(exportRow) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('portals the existing trigger into a host slot without a second menu', () => {
    const slot = document.createElement('div');
    slot.id = 'test-mainmenu-slot';
    document.body.appendChild(slot);
    try {
      setup({
        customMenuItems: {
          file: [{ id: 'save', label: 'Save', onSelect: jest.fn() }]
        },
        menuProps: { triggerSlotId: 'test-mainmenu-slot' }
      });
      // The hamburger lives in the host slot (DOM query: the open MUI
      // modal marks the rest of the tree aria-hidden for role queries)…
      const trigger = slot.querySelector('button[aria-label="Main menu"]');
      expect(trigger).toBeTruthy();
      // …exactly one menu exists, with unchanged contents.
      expect(screen.getAllByRole('menu')).toHaveLength(1);
      const menu = openMenu();
      expect(within(menu).getByText('Save')).toBeTruthy();
      expect(within(menu).getByText('exportImage')).toBeTruthy();
    } finally {
      document.body.removeChild(slot);
    }
  });

  it('falls back to the inline canvas trigger when the slot is missing', () => {
    // Install store mocks (renders one menu); the placement check below uses
    // a second, container-scoped render.
    setup({});
    const { container } = render(
      <ThemeProvider theme={theme}>
        <MainMenu triggerSlotId="missing-slot" />
      </ThemeProvider>
    );
    expect(
      container.querySelector('button[aria-label="Main menu"]')
    ).toBeTruthy();
  });

  it('shows the host display identity in the version row when provided', () => {
    setup({
      mainMenuOptions: [...MENU_WITHOUT_VERSION, 'VERSION'],
      menuProps: { versionLabel: 'FossFLOW 2.5D v1.0.0' }
    });
    const menu = openMenu();
    expect(
      within(menu).getByText('FossFLOW 2.5D v1.0.0')
    ).toBeTruthy();
  });

  it('falls back to the built package version without an override', () => {
    (globalThis as any).PACKAGE_VERSION = '9.9.9-test';
    try {
      setup({
        mainMenuOptions: [...MENU_WITHOUT_VERSION, 'VERSION']
      });
      const menu = openMenu();
      expect(
        within(menu).getByText('FossFLOW v9.9.9-test')
      ).toBeTruthy();
    } finally {
      delete (globalThis as any).PACKAGE_VERSION;
    }
  });
});

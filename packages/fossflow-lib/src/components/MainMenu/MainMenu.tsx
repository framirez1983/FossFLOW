import React, { useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Menu, Typography, Divider, Card, ListSubheader } from '@mui/material';
import {
  Menu as MenuIcon,
  GitHub as GitHubIcon,
  DataObject as ExportJsonIcon,
  ImageOutlined as ExportImageIcon,
  FolderOpen as FolderOpenIcon,
  DeleteOutline as DeleteOutlineIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Settings as SettingsIcon,

} from '@mui/icons-material';
import { UiElement } from 'src/components/UiElement/UiElement';
import { IconButton } from 'src/components/IconButton/IconButton';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { exportAsJSON } from 'src/utils/exportOptions';
import { DIAGRAM_FILE_ACCEPT } from 'src/utils/diagramFile';
import { modelFromModelStore } from 'src/utils';
import { useInitialDataManager } from 'src/hooks/useInitialDataManager';
import { useModelStore } from 'src/stores/modelStore';
import { useHistory } from 'src/hooks/useHistory';
import { DialogTypeEnum } from 'src/types/ui';
import { MenuItem } from './MenuItem';
import { CustomMenuItem } from 'src/types/ui';
import { useTranslation } from 'src/stores/localeStore';

export const MainMenu = ({
  triggerSlotId,
  versionLabel
}: {
  /**
   * Optional DOM id of a host-provided toolbar slot. When the slot exists,
   * the existing trigger button is portaled there while the same menu stays
   * mounted here (MUI renders it in a body portal anchored to the button).
   * No second menu is created. Falls back to the inline trigger otherwise.
   */
  triggerSlotId?: string;
  /**
   * Optional override for the user-visible version row. Host apps pass their
   * display identity here; standalone/lib use falls back to the built
   * package version. Nothing is hardcoded inside the library.
   */
  versionLabel?: string;
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const model = useModelStore((state) => {
    return modelFromModelStore(state);
  });
  const isMainMenuOpen = useUiStateStore((state) => {
    return state.isMainMenuOpen;
  });
  const mainMenuOptions = useUiStateStore((state) => {
    return state.mainMenuOptions;
  });
  const customMenuItems = useUiStateStore((state) => {
    return state.customMenuItems;
  });
  const customFileItems = customMenuItems.file ?? [];
  const customStorageItems = customMenuItems.storage ?? [];
  // When the host app owns file workflows via custom items, the built-in
  // Open/Export-JSON rows step aside to avoid duplicates. Image export rows
  // stay: the export dialog is library-owned.
  const showNativeFileRows = customFileItems.length === 0;
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const initialDataManager = useInitialDataManager();
  const { undo, redo, canUndo, canRedo, clearHistory } = useHistory();

  const { t } = useTranslation('mainMenu');

  const onToggleMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(event.currentTarget);
      uiStateActions.setIsMainMenuOpen(true);
    },
    [uiStateActions]
  );

  const gotoUrl = useCallback((url: string) => {
    window.open(url, '_blank');
  }, []);

  const { load } = initialDataManager;

  const onOpenModel = useCallback(async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = DIAGRAM_FILE_ACCEPT;

    fileInput.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];

      if (!file) {
        throw new Error('No file selected');
      }

      const fileReader = new FileReader();

      fileReader.onload = async (e) => {
        const rawData = JSON.parse(e.target?.result as string);

        load(rawData);
        clearHistory(); // Clear history when loading new model
      };
      fileReader.readAsText(file);

      uiStateActions.resetUiState();
    };

    await fileInput.click();
    uiStateActions.setIsMainMenuOpen(false);
  }, [uiStateActions, load, clearHistory]);

  const onExportAsJSON = useCallback(async () => {
    exportAsJSON(model);
    uiStateActions.setIsMainMenuOpen(false);
  }, [model, uiStateActions]);

  const onExportAsImage = useCallback(() => {
    uiStateActions.setIsMainMenuOpen(false);
    uiStateActions.setDialog(DialogTypeEnum.EXPORT_IMAGE);
  }, [uiStateActions]);

  const { clear } = initialDataManager;

  const onClearCanvas = useCallback(() => {
    clear();
    clearHistory(); // Clear history when clearing canvas
    uiStateActions.setIsMainMenuOpen(false);
  }, [uiStateActions, clear, clearHistory]);

  const handleUndo = useCallback(() => {
    undo();
    uiStateActions.setIsMainMenuOpen(false);
  }, [undo, uiStateActions]);

  const handleRedo = useCallback(() => {
    redo();
    uiStateActions.setIsMainMenuOpen(false);
  }, [redo, uiStateActions]);

  const onOpenSettings = useCallback(() => {
    uiStateActions.setIsMainMenuOpen(false);
    uiStateActions.setDialog(DialogTypeEnum.SETTINGS);
  }, [uiStateActions]);




  const sectionVisibility = useMemo(() => {
    return {
      actions: Boolean(
        mainMenuOptions.find((opt) => {
          return opt.includes('ACTION') || opt.includes('EXPORT');
        })
      ),
      links: Boolean(
        mainMenuOptions.find((opt) => {
          return opt.includes('LINK');
        })
      ),
      version: Boolean(mainMenuOptions.includes('VERSION'))
    };
  }, [mainMenuOptions]);

  if (mainMenuOptions.length === 0) {
    return null;
  }

  const trigger = (
    <IconButton
      Icon={<MenuIcon />}
      name="Main menu"
      onClick={onToggleMenu}
      isActive={isMainMenuOpen}
    />
  );
  const triggerSlot =
    triggerSlotId !== undefined
      ? document.getElementById(triggerSlotId)
      : null;

  return (
    <UiElement sx={triggerSlot ? { display: 'none' } : undefined}>
      {triggerSlot ? createPortal(trigger, triggerSlot) : trigger}

      <Menu
        anchorEl={anchorEl}
        open={isMainMenuOpen}
        onClose={() => {
          uiStateActions.setIsMainMenuOpen(false);
        }}
        elevation={0}
        sx={{
          mt: 2
        }}
        MenuListProps={{
          sx: {
            minWidth: '250px',
            py: 0
          }
        }}
      >
        <Card sx={{ py: 1 }}>
          {/* FILE */}
          {(customFileItems.length > 0 || showNativeFileRows) && (
            <ListSubheader disableSticky>{t('sectionFile')}</ListSubheader>
          )}
          {customFileItems.map((item: CustomMenuItem) => {
            return (
              <React.Fragment key={item.id}>
                {item.dividerBefore && <Divider />}
                <MenuItem
                  disabled={item.disabled}
                  shortcut={item.shortcut}
                  onClick={() => {
                    item.onSelect();
                    uiStateActions.setIsMainMenuOpen(false);
                  }}
                >
                  {item.label}
                </MenuItem>
              </React.Fragment>
            );
          })}

          {/* Built-in file rows (hidden when the host owns file workflows) */}
          {showNativeFileRows && mainMenuOptions.includes('ACTION.OPEN') && (
            <MenuItem onClick={onOpenModel} Icon={<FolderOpenIcon />}>
              {t('open')}
            </MenuItem>
          )}

          {showNativeFileRows && mainMenuOptions.includes('EXPORT.JSON') && (
            <MenuItem onClick={onExportAsJSON} Icon={<ExportJsonIcon />}>
              {t('exportJson')}
            </MenuItem>
          )}

          {mainMenuOptions.includes('EXPORT.PNG') && (
            <MenuItem onClick={onExportAsImage} Icon={<ExportImageIcon />}>
              {t('exportImage')}
            </MenuItem>
          )}

          {/* STORAGE */}
          {customStorageItems.length > 0 && (
            <>
              <Divider />
              <ListSubheader disableSticky>{t('sectionStorage')}</ListSubheader>
              {customStorageItems.map((item: CustomMenuItem) => {
                return (
                  <React.Fragment key={item.id}>
                    {item.dividerBefore && <Divider />}
                    <MenuItem
                      disabled={item.disabled}
                      shortcut={item.shortcut}
                      onClick={() => {
                        item.onSelect();
                        uiStateActions.setIsMainMenuOpen(false);
                      }}
                    >
                      {item.label}
                    </MenuItem>
                  </React.Fragment>
                );
              })}
            </>
          )}

          <Divider />

          {/* EDIT */}
          <ListSubheader disableSticky>{t('sectionEdit')}</ListSubheader>
          <MenuItem
            onClick={handleUndo}
            Icon={<UndoIcon />}
            disabled={!canUndo}
          >
            {t('undo')}
          </MenuItem>

          <MenuItem
            onClick={handleRedo}
            Icon={<RedoIcon />}
            disabled={!canRedo}
          >
            {t('redo')}
          </MenuItem>


          {(canUndo || canRedo) && sectionVisibility.actions && <Divider />}

          {mainMenuOptions.includes('ACTION.CLEAR_CANVAS') && (
            <MenuItem onClick={onClearCanvas} Icon={<DeleteOutlineIcon />}>
              {t('clearCanvas')}
            </MenuItem>
          )}

          <Divider />

          {/* SETTINGS */}
          <ListSubheader disableSticky>{t('sectionSettings')}</ListSubheader>
          <MenuItem onClick={onOpenSettings} Icon={<SettingsIcon />}>
            {t('settings')}
          </MenuItem>

          {sectionVisibility.links && (
            <>
              <Divider />

              {/* HELP */}
              <ListSubheader disableSticky>{t('sectionHelp')}</ListSubheader>
              <MenuItem
                onClick={() => {
                  uiStateActions.setIsMainMenuOpen(false);
                  uiStateActions.setDialog(DialogTypeEnum.WHATS_NEW);
                }}
              >
                {t('whatsNew')}
              </MenuItem>
              {mainMenuOptions.includes('LINK.GITHUB') && (
                <MenuItem
                  onClick={() => {
                    return gotoUrl(`${REPOSITORY_URL}`);
                  }}
                  Icon={<GitHubIcon />}
                >
                  {t('gitHub')}
                </MenuItem>
              )}
            </>
          )}

          {sectionVisibility.version && (
            <>
              <Divider />

              {mainMenuOptions.includes('VERSION') && (
                <MenuItem>
                  <Typography variant="body2" color="text.secondary">
                    {versionLabel ?? `FossFLOW v${PACKAGE_VERSION}`}
                  </Typography>
                </MenuItem>
              )}
            </>
          )}
        </Card>
      </Menu>
    </UiElement>
  );
};

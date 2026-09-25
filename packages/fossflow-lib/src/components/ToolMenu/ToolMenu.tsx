import React, { useCallback, useState } from 'react';
import { Stack, Divider, Menu, MenuItem, ListItemText } from '@mui/material';
import {
  PanToolOutlined as PanToolIcon,
  NearMeOutlined as NearMeIcon,
  AddOutlined as AddIcon,
  EastOutlined as ConnectorIcon,
  CropSquareOutlined as CropSquareIcon,
  Title as TitleIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Help as HelpIcon,
  HighlightAltOutlined as LassoIcon,
  GestureOutlined as FreehandLassoIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { IconButton } from 'src/components/IconButton/IconButton';
import { UiElement } from 'src/components/UiElement/UiElement';
import { useScene } from 'src/hooks/useScene';
import { useHistory } from 'src/hooks/useHistory';
import { useModelStoreApi } from 'src/stores/modelStore';
import { ExistingItemPicker } from 'src/components/ExistingItemPicker/ExistingItemPicker';
import { ItemManager } from 'src/components/ItemManager/ItemManager';
import { TEXTBOX_DEFAULTS } from 'src/config';
import { generateId } from 'src/utils';
import { HOTKEY_PROFILES } from 'src/config/hotkeys';

export const ToolMenu = () => {
  const { createTextBox, currentView } = useScene();
  const { undo, redo, canUndo, canRedo } = useHistory();
  const mode = useUiStateStore((state) => {
    return state.mode;
  });
  const uiStateStoreActions = useUiStateStore((state) => {
    return state.actions;
  });
  const mousePosition = useUiStateStore((state) => {
    return state.mouse.position.tile;
  });
  const hotkeyProfile = useUiStateStore((state) => {
    return state.hotkeyProfile;
  });

  const hotkeys = HOTKEY_PROFILES[hotkeyProfile];

  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [isManageItemsOpen, setIsManageItemsOpen] = useState(false);
  const isExistingItemPickerOpen = useUiStateStore((state) => {
    return state.isExistingItemPickerOpen;
  });
  const modelStoreApi = useModelStoreApi();

  const addItemKey = hotkeys.addItem ? hotkeys.addItem.toUpperCase() : null;

  const handleNewItem = useCallback(() => {
    setAddMenuAnchor(null);
    uiStateStoreActions.setItemControls({
      type: 'ADD_ITEM'
    });
    uiStateStoreActions.setMode({
      type: 'PLACE_ICON',
      showCursor: true,
      id: null
    });
  }, [uiStateStoreActions]);

  const handleExistingItem = useCallback(() => {
    setAddMenuAnchor(null);
    uiStateStoreActions.setIsExistingItemPickerOpen(true);
  }, [uiStateStoreActions]);

  const handleManageItems = useCallback(() => {
    setAddMenuAnchor(null);
    setIsManageItemsOpen(true);
  }, []);

  const handlePickExistingItem = useCallback(
    (modelItemId: string) => {
      const modelItem = modelStoreApi
        .getState()
        .items.find((item) => item.id === modelItemId);

      uiStateStoreActions.setIsExistingItemPickerOpen(false);
      // Arm canvas placement for the existing item (ViewItem only).
      uiStateStoreActions.setMode({
        type: 'PLACE_ICON',
        showCursor: true,
        id: modelItem?.icon ?? null,
        existingModelItemId: modelItemId
      });
      uiStateStoreActions.setItemControls(null);
    },
    [modelStoreApi, uiStateStoreActions]
  );

  const handleUndo = useCallback(() => {
    undo();
  }, [undo]);

  const handleRedo = useCallback(() => {
    redo();
  }, [redo]);

  const createTextBoxProxy = useCallback(() => {
    const textBoxId = generateId();

    createTextBox({
      ...TEXTBOX_DEFAULTS,
      id: textBoxId,
      tile: mousePosition
    });

    uiStateStoreActions.setMode({
      type: 'TEXTBOX',
      showCursor: false,
      id: textBoxId
    });
  }, [uiStateStoreActions, createTextBox, mousePosition]);

  return (
    <UiElement>
      <Stack direction="column" spacing={0.5} alignItems="center">
        {/* Undo/Redo Section */}
        <IconButton
          name="Undo (Ctrl+Z)"
          Icon={<UndoIcon />}
          tooltipPosition="right"
          onClick={handleUndo}
          disabled={!canUndo}
        />
        <IconButton
          name="Redo (Ctrl+Y)"
          Icon={<RedoIcon />}
          tooltipPosition="right"
          onClick={handleRedo}
          disabled={!canRedo}
        />

        {/* Main Tools */}
        <IconButton
          name={`Select${hotkeys.select ? ` (${hotkeys.select.toUpperCase()})` : ''}`}
          Icon={<NearMeIcon />}
          tooltipPosition="right"
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'CURSOR',
              showCursor: true,
              mousedownItem: null
            });
          }}
          isActive={mode.type === 'CURSOR' || mode.type === 'DRAG_ITEMS'}
        />
        <IconButton
          name={`Lasso select${hotkeys.lasso ? ` (${hotkeys.lasso.toUpperCase()})` : ''}`}
          Icon={<LassoIcon />}
          tooltipPosition="right"
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'LASSO',
              showCursor: true,
              selection: null,
              isDragging: false
            });
          }}
          isActive={mode.type === 'LASSO'}
        />
        <IconButton
          name={`Freehand lasso${hotkeys.freehandLasso ? ` (${hotkeys.freehandLasso.toUpperCase()})` : ''}`}
          Icon={<FreehandLassoIcon />}
          tooltipPosition="right"
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'FREEHAND_LASSO',
              showCursor: true,
              path: [],
              selection: null,
              isDragging: false
            });
          }}
          isActive={mode.type === 'FREEHAND_LASSO'}
        />
        <IconButton
          name={`Pan${hotkeys.pan ? ` (${hotkeys.pan.toUpperCase()})` : ''}`}
          Icon={<PanToolIcon />}
          tooltipPosition="right"
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'PAN',
              showCursor: false
            });

            uiStateStoreActions.setItemControls(null);
          }}
          isActive={mode.type === 'PAN'}
        />
        <IconButton
          name={`Add item${addItemKey ? ` (${addItemKey})` : ''}`}
          Icon={<AddIcon />}
          tooltipPosition="right"
          onClick={(event) => {
            setAddMenuAnchor(event.currentTarget);
          }}
          isActive={mode.type === 'PLACE_ICON'}
        />
        <Menu
          anchorEl={addMenuAnchor}
          open={Boolean(addMenuAnchor)}
          onClose={() => {
            setAddMenuAnchor(null);
          }}
        >
          <MenuItem onClick={handleNewItem}>
            <ListItemText>
              {`New item${addItemKey ? ` (${addItemKey})` : ''}`}
            </ListItemText>
          </MenuItem>
          <MenuItem onClick={handleExistingItem}>
            <ListItemText>
              {`Existing item${addItemKey ? ` (Shift+${addItemKey})` : ''}`}
            </ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleManageItems}>
            <ListItemText>Manage items…</ListItemText>
          </MenuItem>
        </Menu>
        <ExistingItemPicker
          open={isExistingItemPickerOpen}
          activeViewItemIds={(currentView?.items ?? []).map((item) => item.id)}
          onPick={handlePickExistingItem}
          onClose={() => {
            uiStateStoreActions.setIsExistingItemPickerOpen(false);
          }}
        />
        <ItemManager
          open={isManageItemsOpen}
          onClose={() => {
            setIsManageItemsOpen(false);
          }}
        />
        <IconButton
          name={`Rectangle${hotkeys.rectangle ? ` (${hotkeys.rectangle.toUpperCase()})` : ''}`}
          Icon={<CropSquareIcon />}
          tooltipPosition="right"
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'RECTANGLE.DRAW',
              showCursor: true,
              id: null
            });
          }}
          isActive={mode.type === 'RECTANGLE.DRAW'}
        />
        <IconButton
          name={`Connector${hotkeys.connector ? ` (${hotkeys.connector.toUpperCase()})` : ''}`}
          Icon={<ConnectorIcon />}
          tooltipPosition="right"
          onClick={() => {
            uiStateStoreActions.setMode({
              type: 'CONNECTOR',
              id: null,
              showCursor: true
            });
          }}
          isActive={mode.type === 'CONNECTOR'}
        />
        <IconButton
          name={`Text${hotkeys.text ? ` (${hotkeys.text.toUpperCase()})` : ''}`}
          Icon={<TitleIcon />}
          tooltipPosition="right"
          onClick={createTextBoxProxy}
          isActive={mode.type === 'TEXTBOX'}
        />
      </Stack>
    </UiElement>
  );
};

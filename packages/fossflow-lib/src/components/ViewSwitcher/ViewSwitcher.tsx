import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography
} from '@mui/material';
import { Check, ExpandMore } from '@mui/icons-material';
import { useModelStore, useModelStoreApi } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { useView } from 'src/hooks/useView';
import { modelFromModelStore } from 'src/utils';
import { constrainedStrings } from 'src/schemas/common';
import { VIEW_DEFAULTS } from 'src/config';

const VIEW_NAME_MAX_LENGTH = constrainedStrings.name.maxLength ?? 100;

type NameDialogMode = 'rename' | 'create';

export const ViewSwitcher = () => {
  const views = useModelStore((state) => state.views);
  const viewId = useUiStateStore((state) => state.view);
  const editorMode = useUiStateStore((state) => state.editorMode);
  const { currentView, renameView, createView, duplicateView, deleteView } = useScene();
  const { changeView } = useView();
  const modelStoreApi = useModelStoreApi();

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dialogMode, setDialogMode] = useState<NameDialogMode | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const activeView = useMemo(() => {
    return (
      views.find((view) => view.id === viewId) ??
      views.find((view) => view.id === currentView.id) ??
      views[0] ??
      null
    );
  }, [views, viewId, currentView.id]);

  const canRename = editorMode === 'EDITABLE';

  const handleSelectView = (id: string) => {
    if (id !== activeView?.id) {
      changeView(id, modelFromModelStore(modelStoreApi.getState()));
    }
    setMenuAnchor(null);
  };

  const handleOpenRename = () => {
    setDraftName(activeView?.name ?? '');
    setRenameError(null);
    setMenuAnchor(null);
    setDialogMode('rename');
  };

  const handleOpenCreate = () => {
    setDraftName(VIEW_DEFAULTS.name);
    setRenameError(null);
    setMenuAnchor(null);
    setDialogMode('create');
  };

  const handleConfirmRename = () => {
    if (!activeView) return;

    if (!draftName.trim()) {
      setRenameError('Name cannot be empty.');
      return;
    }

    renameView(activeView.id, draftName);
    setDialogMode(null);
  };

  const handleConfirmCreate = () => {
    if (!draftName.trim()) {
      setRenameError('Name cannot be empty.');
      return;
    }

    const id = createView(draftName);
    if (!id) {
      setRenameError('Name cannot be empty.');
      return;
    }

    // Switch to the new view via the existing path (scene/UI only, no
    // second model mutation).
    changeView(id, modelFromModelStore(modelStoreApi.getState()));
    setDialogMode(null);
  };

  const handleDuplicateView = () => {
    if (!activeView) return;

    const id = duplicateView(activeView.id);
    setMenuAnchor(null);
    if (id) {
      changeView(id, modelFromModelStore(modelStoreApi.getState()));
    }
  };

  const handleConfirmDeleteView = () => {
    if (!activeView) return;

    const { deleted, switchToId } = deleteView(activeView.id);
    setIsDeleteConfirmOpen(false);
    setMenuAnchor(null);
    if (!deleted) return;
    if (switchToId) {
      changeView(switchToId, modelFromModelStore(modelStoreApi.getState()));
    }
  };

  return (
    <>
      <Button
        size="small"
        endIcon={<ExpandMore fontSize="small" />}
        onClick={(event) => {
          setMenuAnchor(event.currentTarget);
        }}
        disabled={!activeView}
        sx={{
          pointerEvents: 'auto',
          textTransform: 'none',
          fontWeight: 600,
          color: 'text.secondary',
          minWidth: 0,
          py: 0
        }}
      >
        {activeView?.name ?? currentView.name}
      </Button>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => {
          setMenuAnchor(null);
        }}
      >
        {views.map((view) => {
          const isActive = view.id === activeView?.id;
          return (
            <MenuItem
              key={view.id}
              selected={isActive}
              onClick={() => {
                handleSelectView(view.id);
              }}
            >
              <ListItemIcon sx={{ minWidth: 32 }}>
                {isActive ? <Check fontSize="small" /> : <Box width={20} />}
              </ListItemIcon>
              <ListItemText>{view.name}</ListItemText>
            </MenuItem>
          );
        })}
        {canRename && [
          <Divider key="menu-divider" />,
          <MenuItem key="create-view" onClick={handleOpenCreate}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box width={20} />
            </ListItemIcon>
            <ListItemText>New view…</ListItemText>
          </MenuItem>,
          <MenuItem
            key="duplicate-view"
            onClick={handleDuplicateView}
            disabled={!activeView}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>
              <Box width={20} />
            </ListItemIcon>
            <ListItemText>Duplicate view</ListItemText>
          </MenuItem>,
          ...(activeView
            ? [
                <MenuItem key="rename-view" onClick={handleOpenRename}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Box width={20} />
                  </ListItemIcon>
                  <ListItemText>Rename view…</ListItemText>
                </MenuItem>,
                <MenuItem
                  key="delete-view"
                  disabled={views.length <= 1}
                  onClick={() => {
                    setMenuAnchor(null);
                    setIsDeleteConfirmOpen(true);
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Box width={20} />
                  </ListItemIcon>
                  <ListItemText>Delete view…</ListItemText>
                </MenuItem>
              ]
            : [])
        ]}
      </Menu>
      <Dialog
        open={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete view</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {`Delete view "${activeView?.name ?? ''}"? Its placements, connectors, rectangles and text boxes will be removed. Global items are kept.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setIsDeleteConfirmOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmDeleteView}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={dialogMode !== null}
        onClose={() => {
          setDialogMode(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {dialogMode === 'create' ? 'New view' : 'Rename view'}
        </DialogTitle>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (dialogMode === 'create') {
              handleConfirmCreate();
            } else {
              handleConfirmRename();
            }
          }}
        >
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="View name"
              value={draftName}
              error={Boolean(renameError)}
              helperText={renameError ?? undefined}
              inputProps={{ maxLength: VIEW_NAME_MAX_LENGTH }}
              onChange={(event) => {
                setDraftName(event.target.value);
                if (renameError) setRenameError(null);
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setDialogMode(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!draftName.trim()}
            >
              {dialogMode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
};

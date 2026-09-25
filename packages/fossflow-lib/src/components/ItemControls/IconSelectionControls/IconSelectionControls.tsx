import React, { useCallback, useRef, useState } from 'react';
import { Stack, Alert, IconButton as MUIIconButton, Box, Button, FormControlLabel, Checkbox, Typography, Slider, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { ControlsContainer } from 'src/components/ItemControls/components/ControlsContainer';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { Icon } from 'src/types';
import { Section } from 'src/components/ItemControls/components/Section';
import { Searchbox } from 'src/components/ItemControls/IconSelectionControls/Searchbox';
import { useIconFiltering } from 'src/hooks/useIconFiltering';
import { useIconCategories } from 'src/hooks/useIconCategories';
import { Close as CloseIcon, FileUpload as FileUploadIcon } from '@mui/icons-material';
import { Icons } from './Icons';
import { IconGrid } from './IconGrid';
import { IconCollection } from './IconCollection';
import { generateId } from 'src/utils';
import { copyLibraryIconToProject } from 'src/utils/iconLibrary';
import type { LibraryIcon } from 'src/types/library';
import { normalizeUserIconFiles } from 'src/utils/normalizeUserIcons';
import {
  ICON_NAME_MAX_LENGTH,
  countIconUsage,
  deleteImportedIcon,
  renameImportedIcon
} from 'src/utils/iconInventory';

export const IconSelectionControls = () => {
  const uiStateActions = useUiStateStore((state) => {
    return state.actions;
  });
  const mode = useUiStateStore((state) => {
    return state.mode;
  });
  const iconCategoriesState = useUiStateStore((state) => state.iconCategoriesState);
  const libraryManager = useUiStateStore((state) => state.libraryManager);
  const modelActions = useModelStore((state) => state.actions);
  const currentIcons = useModelStore((state) => state.icons);
  const modelItems = useModelStore((state) => state.items);
  const { setFilter, filteredIcons, filter } = useIconFiltering();
  const { iconCategories } = useIconCategories();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [treatAsIsometric, setTreatAsIsometric] = useState(true);
  const [iconScale, setIconScale] = useState(100);
  const [showAlert, setShowAlert] = useState(() => {
    // Check localStorage to see if user has dismissed the alert
    return localStorage.getItem('fossflow-show-drag-hint') !== 'false';
  });


  const onMouseDown = useCallback(
    (icon: Icon) => {
      if (mode.type !== 'PLACE_ICON') return;

      // Library tiles are server assets, not project icons: copy the asset
      // into the project first, then arm placement with the project copy.
      if (icon.collection === 'library' && libraryManager) {
        const entry = libraryManager.icons.find((item) => {
          return item.id === icon.id;
        });
        if (!entry) return;
        const { icons, iconId } = copyLibraryIconToProject(
          currentIcons,
          entry
        );
        modelActions.set({ icons });
        uiStateActions.setMode({
          type: 'PLACE_ICON',
          showCursor: true,
          id: iconId
        });
        return;
      }

      uiStateActions.setMode({
        type: 'PLACE_ICON',
        showCursor: true,
        id: icon.id
      });
    },
    [mode, uiStateActions, libraryManager, currentIcons, modelActions]
  );

  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);

  const handleAddToLibrary = useCallback(
    async (icon: Icon) => {
      if (!libraryManager || icon.collection !== 'imported') return;
      try {
        const { duplicate } = await libraryManager.addIcon(icon);
        setLibraryNotice(
          duplicate
            ? `"${icon.name}" is already in the Library`
            : `"${icon.name}" added to the Library`
        );
      } catch {
        setLibraryNotice(`Could not add "${icon.name}" to the Library`);
      }
    },
    [libraryManager]
  );

  const showLibrarySection =
    libraryManager !== null &&
    !libraryManager.unavailable &&
    libraryManager.icons.length > 0;

  const toLibraryTiles = useCallback((entries: LibraryIcon[]): Icon[] => {
    return entries.map((entry) => {
      return {
        id: entry.id,
        name: entry.name,
        url: entry.url,
        collection: 'library',
        isIsometric: entry.isIsometric,
        ...(entry.scale !== undefined ? { scale: entry.scale } : {})
      };
    });
  }, []);

  const libraryMatches = useCallback(() => {
    if (!libraryManager || filter === '') return [];
    const needle = filter.toLowerCase();
    return toLibraryTiles(
      libraryManager.icons.filter((entry) => {
        return entry.name.toLowerCase().includes(needle);
      })
    );
  }, [libraryManager, filter, toLibraryTiles]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const [renamingIcon, setRenamingIcon] = useState<Icon | null>(null);
  const [draftIconName, setDraftIconName] = useState('');
  const [deletingIcon, setDeletingIcon] = useState<Icon | null>(null);

  const handleRenameIcon = useCallback((icon: Icon) => {
    setDraftIconName(icon.name);
    setRenamingIcon(icon);
  }, []);

  const handleConfirmRenameIcon = useCallback(() => {
    if (!renamingIcon) return;

    const { icons, renamed } = renameImportedIcon(
      currentIcons,
      renamingIcon.id,
      draftIconName
    );
    if (renamed) {
      modelActions.set({ icons });
    }
    setRenamingIcon(null);
  }, [renamingIcon, currentIcons, draftIconName, modelActions]);

  const handleDeleteIcon = useCallback((icon: Icon) => {
    setDeletingIcon(icon);
  }, []);

  const handleConfirmDeleteIcon = useCallback(() => {
    if (!deletingIcon) return;

    const { icons, deleted } = deleteImportedIcon(
      currentIcons,
      deletingIcon.id
    );
    if (deleted) {
      modelActions.set({ icons });
    }
    setDeletingIcon(null);
  }, [deletingIcon, currentIcons, modelActions]);

  const deletingIconUsage = deletingIcon
    ? countIconUsage(modelItems, deletingIcon.id)
    : 0;

  const dismissAlert = useCallback(() => {
    setShowAlert(false);
    localStorage.setItem('fossflow-show-drag-hint', 'false');
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const { icons: normalized, skipped } = await normalizeUserIconFiles(files, {
      existingNames: currentIcons.map((icon) => icon.name),
      treatAsIsometric,
      iconScale
    });
    const newIcons: Icon[] = normalized.map((item) => {
      return {
        id: generateId(),
        name: item.name,
        url: item.url,
        collection: 'imported',
        isIsometric: item.isIsometric
      };
    });

    if (newIcons.length > 0) {
      // Add new icons to the model
      const updatedIcons = [...currentIcons, ...newIcons];
      modelActions.set({ icons: updatedIcons });

      // Update icon categories to include imported collection
      const hasImported = iconCategoriesState.some(cat => cat.id === 'imported');
      if (!hasImported) {
        uiStateActions.setIconCategoriesState([
          ...iconCategoriesState,
          { id: 'imported', isExpanded: true }
        ]);
      }
    }

    // Reset input
    event.target.value = '';
    if (skipped.length > 0) {
      setLibraryNotice(
        skipped.map((item) => `${item.name}: ${item.reason}`).join(' ')
      );
    }
  }, [currentIcons, modelActions, iconCategoriesState, uiStateActions, treatAsIsometric, iconScale]);

  return (
    <ControlsContainer
      header={
        <Section
          sx={{
            top: 0,
            pt: 6,
            pb: 3,
            position: 'relative',
            paddingTop: '32px'
          }}
        >
          {/* Close button */}
          <MUIIconButton
            aria-label="Close"
            onClick={() => {
              return uiStateActions.setItemControls(null);
            }}
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 2,
              padding: 0,
              background: 'none'
            }}
            size="small"
          >
            <CloseIcon />
          </MUIIconButton>
          <Stack spacing={2}>
            <Box sx={{ marginTop: '8px' }}>
              <Searchbox value={filter} onChange={setFilter} />
            </Box>
          </Stack>
        </Section>
      }
    >
      {filteredIcons && (
        <Section>
          <IconGrid
            icons={filteredIcons}
            onMouseDown={onMouseDown}
            onRenameIcon={handleRenameIcon}
            onDeleteIcon={handleDeleteIcon}
            onAddToLibrary={
              libraryManager && !libraryManager.unavailable
                ? handleAddToLibrary
                : undefined
            }
          />
          {libraryMatches().length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                textTransform="uppercase"
                fontWeight={600}
                sx={{ mb: 1 }}
              >
                My Library
              </Typography>
              <IconGrid
                icons={libraryMatches()}
                onMouseDown={onMouseDown}
              />
            </Box>
          )}
        </Section>
      )}
      {!filteredIcons && showLibrarySection && libraryManager && (
        <IconCollection
          id="my library"
          icons={toLibraryTiles(libraryManager.icons)}
          onMouseDown={onMouseDown}
          isExpanded
        />
      )}
      {!filteredIcons && (
        <Icons
          iconCategories={iconCategories}
          onMouseDown={onMouseDown}
          onRenameIcon={handleRenameIcon}
          onDeleteIcon={handleDeleteIcon}
          onAddToLibrary={
              libraryManager && !libraryManager.unavailable
                ? handleAddToLibrary
                : undefined
            }
        />
      )}
      
      <Section>
        <Box sx={{ 
          border: '1px solid #e0e0e0', 
          borderRadius: 1, 
          p: 1.5,
          backgroundColor: '#f5f5f5'
        }}>
          <Button
            variant="outlined"
            startIcon={<FileUploadIcon />}
            onClick={handleImportClick}
            fullWidth
          >
            Import Icons
          </Button>
          <FormControlLabel
            control={
              <Checkbox
                checked={treatAsIsometric}
                onChange={(e) => setTreatAsIsometric(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                Treat as isometric (3D view)
              </Typography>
            }
            sx={{ mt: 1, ml: 0 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Uncheck for flat icons (logos, UI elements)
          </Typography>
        </Box>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        
        {showAlert && (
          <Alert 
            severity="info" 
            onClose={dismissAlert}
            sx={{ cursor: 'pointer', mt: 1 }}
          >
            You can drag and drop any item below onto the canvas.
          </Alert>
        )}
        {libraryNotice && (
          <Alert severity="info" onClose={() => setLibraryNotice(null)} sx={{ mt: 1 }}>
            {libraryNotice}
          </Alert>
        )}
      </Section>

      <Dialog
        open={renamingIcon !== null}
        onClose={() => {
          setRenamingIcon(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Rename icon</DialogTitle>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleConfirmRenameIcon();
          }}
        >
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="Icon name"
              value={draftIconName}
              inputProps={{ maxLength: ICON_NAME_MAX_LENGTH }}
              onChange={(event) => {
                setDraftIconName(event.target.value);
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setRenamingIcon(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={!draftIconName.trim()}
            >
              Save
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog
        open={deletingIcon !== null}
        onClose={() => {
          setDeletingIcon(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {deletingIconUsage > 0 ? 'Cannot delete icon' : 'Delete icon'}
        </DialogTitle>
        <DialogContent>
          {deletingIconUsage > 0 ? (
            <Typography variant="body2">
              {`"${deletingIcon?.name}" is used by ${deletingIconUsage} item(s). Reassign those items before deleting it.`}
            </Typography>
          ) : (
            <Typography variant="body2">
              {`Delete "${deletingIcon?.name}" permanently from the inventory?`}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          {deletingIconUsage > 0 ? (
            <Button
              onClick={() => {
                setDeletingIcon(null);
              }}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                onClick={() => {
                  setDeletingIcon(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={handleConfirmDeleteIcon}
              >
                Delete
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </ControlsContainer>
  );
};

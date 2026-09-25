import React, { useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormLabel,
  FormControlLabel,
  Switch,
  Checkbox,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  ExpandLess as ChevronUpIcon,
  ExpandMore as ChevronDownIcon,
  FileUpload as FileUploadIcon
} from '@mui/icons-material';
import { useTranslation } from 'src/stores/localeStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { normalizeUserIconFiles } from 'src/utils/normalizeUserIcons';
import { IconGrid } from 'src/components/ItemControls/IconSelectionControls/IconGrid';
import { Searchbox } from 'src/components/ItemControls/IconSelectionControls/Searchbox';
import type { Icon } from 'src/types/model';
import type { LibraryIcon } from 'src/types/library';

export interface IconPackSettingsProps {
  lazyLoadingEnabled: boolean;
  onToggleLazyLoading: (enabled: boolean) => void;
  packInfo: Array<{
    name: string;
    displayName: string;
    loaded: boolean;
    loading: boolean;
    error: string | null;
    iconCount: number;
  }>;
  enabledPacks: string[];
  onTogglePack: (packName: string, enabled: boolean) => void;
}

export const IconPackSettings: React.FC<IconPackSettingsProps> = ({
  lazyLoadingEnabled,
  onToggleLazyLoading,
  packInfo,
  enabledPacks,
  onTogglePack
}) => {
  const { t } = useTranslation();
  const libraryManager = useUiStateStore((state) => state.libraryManager);

  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<LibraryIcon | null>(null);
  const [draftLibraryName, setDraftLibraryName] = useState('');
  const [deletingEntry, setDeletingEntry] = useState<LibraryIcon | null>(null);
  const [packsExpanded, setPacksExpanded] = useState(false);
  const libraryFileInputRef = useRef<HTMLInputElement>(null);

  const handleLazyLoadingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onToggleLazyLoading(event.target.checked);
  };

  const handlePackToggle = (packName: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onTogglePack(packName, event.target.checked);
  };

  const toLibraryTiles = (entries: LibraryIcon[]): Icon[] => {
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
  };

  const visibleLibraryEntries = (() => {
    if (!libraryManager) return [];
    const needle = libraryQuery.trim().toLowerCase();
    if (!needle) return libraryManager.icons;
    return libraryManager.icons.filter((entry) => {
      return entry.name.toLowerCase().includes(needle);
    });
  })();

  const handleLibraryImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files || files.length === 0 || !libraryManager) return;
    try {
      const { icons: normalized, skipped } = await normalizeUserIconFiles(files, {
        existingNames: libraryManager.icons.map((entry) => entry.name)
      });
      const skipNote =
        skipped.length > 0
          ? skipped.map((item) => `${item.name}: ${item.reason}`).join(' ')
          : null;
      let added = 0;
      let duplicates = 0;
      for (const item of normalized) {
        const { duplicate } = await libraryManager.addIcon({
          id: `library-import-${Date.now()}-${added + duplicates}`,
          name: item.name,
          url: item.url,
          collection: 'imported',
          isIsometric: item.isIsometric
        });
        if (duplicate) {
          duplicates += 1;
        } else {
          added += 1;
        }
      }
      const outcome =
        duplicates > 0 && added === 0
          ? 'Already in Library: no duplicates were added.'
          : duplicates > 0
            ? `Imported ${added} icon(s); ${duplicates} already in Library.`
            : `Imported ${added} icon(s) into the Library.`;
      setLibraryNotice(skipNote ? `${skipNote} ${outcome}` : outcome);
    } catch {
      setLibraryNotice('Could not import into the Library.');
    }
  };

  const handleConfirmLibraryRename = async () => {
    if (!renamingEntry || !libraryManager) return;
    try {
      await libraryManager.renameIcon(renamingEntry.id, draftLibraryName);
    } catch {
      setLibraryNotice(`Could not rename "${renamingEntry.name}".`);
    }
    setRenamingEntry(null);
  };

  const handleConfirmLibraryDelete = async () => {
    if (!deletingEntry || !libraryManager) return;
    try {
      await libraryManager.deleteIcon(deletingEntry.id);
    } catch {
      setLibraryNotice(`Could not delete "${deletingEntry.name}".`);
    }
    setDeletingEntry(null);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {t('settings.iconPacks.title')}
      </Typography>

      {/* Lazy loading is a general icon-loading behavior: it sits above
          both the server Library and the optional packs. */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <FormControl component="fieldset" fullWidth>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <FormLabel component="legend" sx={{ fontWeight: 600, mb: 0.5 }}>
                {t('settings.iconPacks.lazyLoading')}
              </FormLabel>
              <Typography variant="body2" color="text.secondary">
                {t('settings.iconPacks.lazyLoadingDesc')}
              </Typography>
            </Box>
            <Switch
              checked={lazyLoadingEnabled}
              onChange={handleLazyLoadingChange}
              color="primary"
            />
          </Box>
        </FormControl>
      </Paper>

      {/* Server-backed reusable Icon Library (primary section) */}
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, mt: 3 }}>
        My Library
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Reusable custom icons stored on the server. Using one copies it into
        the current project.
      </Typography>

      {!libraryManager || libraryManager.unavailable ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          The Icon Library is unavailable while server storage is off. Project
          and built-in icons keep working.
        </Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Searchbox value={libraryQuery} onChange={setLibraryQuery} />
            </Box>
            <Button
              variant="outlined"
              startIcon={<FileUploadIcon />}
              onClick={() => {
                libraryFileInputRef.current?.click();
              }}
            >
              Import
            </Button>
          </Box>
          <input
            ref={libraryFileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleLibraryImport}
          />
          {libraryNotice && (
            <Alert
              severity="info"
              onClose={() => setLibraryNotice(null)}
              sx={{ mb: 1 }}
            >
              {libraryNotice}
            </Alert>
          )}
          {libraryManager.loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                Loading Library…
              </Typography>
            </Box>
          ) : visibleLibraryEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              {libraryQuery
                ? 'No Library icons match your search.'
                : 'No reusable icons yet. Import one or add a project icon.'}
            </Typography>
          ) : (
            <IconGrid
              icons={toLibraryTiles(visibleLibraryEntries)}
              onRenameIcon={(tile) => {
                const entry = libraryManager.icons.find((item) => {
                  return item.id === tile.id;
                });
                if (!entry) return;
                setDraftLibraryName(entry.name);
                setRenamingEntry(entry);
              }}
              onDeleteIcon={(tile) => {
                const entry = libraryManager.icons.find((item) => {
                  return item.id === tile.id;
                });
                if (entry) setDeletingEntry(entry);
              }}
            />
          )}

          <Dialog
            open={renamingEntry !== null}
            onClose={() => {
              setRenamingEntry(null);
            }}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Rename Library icon</DialogTitle>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleConfirmLibraryRename();
              }}
            >
              <DialogContent>
                <TextField
                  autoFocus
                  fullWidth
                  label="Icon name"
                  value={draftLibraryName}
                  inputProps={{ maxLength: 100 }}
                  onChange={(event) => {
                    setDraftLibraryName(event.target.value);
                  }}
                />
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => {
                    setRenamingEntry(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={!draftLibraryName.trim()}
                >
                  Save
                </Button>
              </DialogActions>
            </form>
          </Dialog>

          <Dialog
            open={deletingEntry !== null}
            onClose={() => {
              setDeletingEntry(null);
            }}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>Delete Library icon</DialogTitle>
            <DialogContent>
              <Typography variant="body2">
                {`Delete "${deletingEntry?.name}" from the Library? Existing diagrams that already use it are NOT affected.`}
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => {
                  setDeletingEntry(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="error"
                onClick={() => {
                  void handleConfirmLibraryDelete();
                }}
              >
                Delete
              </Button>
            </DialogActions>
          </Dialog>

          <Divider sx={{ my: 3 }} />
        </>
      )}

      {/* Optional 2D icon packs (secondary, demoted section) */}
      <Button
        variant="text"
        fullWidth
        onClick={() => {
          return setPacksExpanded(!packsExpanded);
        }}
      >
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography
            variant="subtitle1"
            color="text.secondary"
            fontWeight={600}
          >
            {t('settings.iconPacks.additionalPacks')}
          </Typography>
          {packsExpanded ? (
            <ChevronUpIcon color="action" />
          ) : (
            <ChevronDownIcon color="action" />
          )}
        </Box>
      </Button>
      {packsExpanded && (
      <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {t('settings.iconPacks.additionalPacksDesc')}
      </Typography>
      {/* Core Isoflow (Always Loaded) */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'action.hover' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {t('settings.iconPacks.coreIsoflow')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('settings.iconPacks.alwaysEnabled')}
            </Typography>
          </Box>
          <Checkbox checked disabled />
        </Box>
      </Paper>

      {/* Available Icon Packs */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          {t('settings.iconPacks.availablePacks')}
        </Typography>

        {!lazyLoadingEnabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('settings.iconPacks.lazyLoadingDisabledNote')}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {packInfo.map((pack) => (
            <Paper key={pack.name} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {pack.displayName}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    {pack.loading && (
                      <>
                        <CircularProgress size={14} />
                        <Typography variant="caption" color="text.secondary">
                          {t('settings.iconPacks.loading')}
                        </Typography>
                      </>
                    )}
                    {pack.loaded && !pack.loading && (
                      <Typography variant="caption" color="success.main">
                        {t('settings.iconPacks.loaded')} • {t('settings.iconPacks.iconCount').replace('{count}', String(pack.iconCount))}
                      </Typography>
                    )}
                    {pack.error && (
                      <Typography variant="caption" color="error">
                        {pack.error}
                      </Typography>
                    )}
                    {!pack.loaded && !pack.loading && !pack.error && (
                      <Typography variant="caption" color="text.secondary">
                        {t('settings.iconPacks.notLoaded')}
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Checkbox
                  checked={enabledPacks.includes(pack.name) || !lazyLoadingEnabled}
                  onChange={handlePackToggle(pack.name)}
                  disabled={!lazyLoadingEnabled || pack.loading}
                />
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="body2" color="text.secondary">
        {t('settings.iconPacks.note')}
      </Typography>
      </Box>
      )}
    </Box>
  );
};

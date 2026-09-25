import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton as MuiIconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { Delete as DeleteIcon, LibraryAdd as LibraryAddIcon } from '@mui/icons-material';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { ItemThumb } from 'src/components/ExistingItemPicker/ExistingItemPicker';

const usageLabel = (viewCount: number): string => {
  if (viewCount === 0) return 'Unused';
  if (viewCount === 1) return 'Used in 1 view';
  return `Used in ${viewCount} views`;
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export const ItemManager = ({ open, onClose }: Props) => {
  const items = useModelStore((state) => state.items);
  const views = useModelStore((state) => state.views);
  const icons = useModelStore((state) => state.icons);
  const itemControls = useUiStateStore((state) => state.itemControls);
  const libraryManager = useUiStateStore((state) => state.libraryManager);
  const uiStateActions = useUiStateStore((state) => state.actions);
  const { deleteModelItem } = useScene();

  const [query, setQuery] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [libraryNotice, setLibraryNotice] = useState<string | null>(null);

  const libraryActive = libraryManager !== null && !libraryManager.unavailable;

  const handleAddItemIconToLibrary = async (iconId: string | undefined) => {
    if (!libraryManager || !iconId) return;
    const icon = icons.find((entry) => {
      return entry.id === iconId;
    });
    // Only the icon asset is promoted, never the ModelItem record.
    if (!icon || icon.collection !== 'imported') return;
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
  };

  const usageById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      counts.set(item.id, 0);
    }
    for (const view of views) {
      for (const placement of view.items ?? []) {
        counts.set(placement.id, (counts.get(placement.id) ?? 0) + 1);
      }
    }
    return counts;
  }, [items, views]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      return item.name.toLowerCase().includes(needle);
    });
  }, [items, query]);

  const pendingItem = pendingDeleteId
    ? (items.find((item) => item.id === pendingDeleteId) ?? null)
    : null;
  const pendingViewCount = pendingDeleteId
    ? (usageById.get(pendingDeleteId) ?? 0)
    : 0;

  const handleConfirmDelete = () => {
    if (!pendingItem) return;

    deleteModelItem(pendingItem.id);

    // Drop canvas selection if it referenced the deleted global item.
    if (
      itemControls &&
      itemControls.type === 'ITEM' &&
      itemControls.id === pendingItem.id
    ) {
      uiStateActions.setItemControls(null);
    }

    setPendingDeleteId(null);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Manage items</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Search items"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          sx={{ mt: 1, mb: 1 }}
        />
        {pendingItem && (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'error.main',
              borderRadius: 1,
              p: 1.5,
              mb: 1
            }}
          >
            <Typography variant="body2" gutterBottom>
              {pendingViewCount === 0
                ? `Delete "${pendingItem.name}" permanently from the inventory?`
                : `Delete "${pendingItem.name}" from the inventory? It is used in ${pendingViewCount} ${pendingViewCount === 1 ? 'view' : 'views'} — its placements and connected links in those views will also be removed.`}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button
                size="small"
                onClick={() => {
                  setPendingDeleteId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </Box>
          </Box>
        )}
        {visibleItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {items.length === 0
              ? 'No items in the inventory yet.'
              : 'No items match your search.'}
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
            <List dense disablePadding>
              {visibleItems.map((item) => {
                const viewCount = usageById.get(item.id) ?? 0;
                const itemIcon = item.icon
                  ? icons.find((entry) => {
                      return entry.id === item.icon;
                    })
                  : undefined;
                const promotableIcon =
                  itemIcon && itemIcon.collection === 'imported'
                    ? itemIcon
                    : undefined;
                const iconInLibrary =
                  libraryManager &&
                  !libraryManager.unavailable &&
                  promotableIcon
                    ? libraryManager.isInLibrary(promotableIcon.url)
                    : false;
                return (
                  <React.Fragment key={item.id}>
                    <ListItem
                      secondaryAction={
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {libraryActive && promotableIcon && (
                            iconInLibrary ? (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                In Library
                              </Typography>
                            ) : (
                              <MuiIconButton
                                edge="end"
                                aria-label={`Add icon of ${item.name} to Library`}
                                onClick={() => {
                                  void handleAddItemIconToLibrary(
                                    promotableIcon.id
                                  );
                                }}
                              >
                                <LibraryAddIcon fontSize="small" />
                              </MuiIconButton>
                            )
                          )}
                          <MuiIconButton
                            edge="end"
                            aria-label={`Delete ${item.name}`}
                            color="error"
                            onClick={() => {
                              setPendingDeleteId(item.id);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </MuiIconButton>
                        </Stack>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: 48 }}>
                        <ItemThumb item={item} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        secondary={usageLabel(viewCount)}
                      />
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </React.Fragment>
                );
              })}
            </List>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          Deleting here removes the item everywhere. Removing a node from the
          canvas only removes that view&apos;s placement.
        </Typography>
        {libraryNotice && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {libraryNotice}
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

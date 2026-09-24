import React, { useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Typography
} from '@mui/material';
import { useModelStore } from 'src/stores/modelStore';
import { useIcon } from 'src/hooks/useIcon';
import { ModelItem } from 'src/types';

const THUMB_SIZE = 40;

interface ThumbProps {
  item: ModelItem;
}

export const ItemThumb = ({ item }: ThumbProps) => {
  const { icon } = useIcon(item.icon);

  return (
    <Box
      data-testid="item-thumb"
      sx={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'grey.100',
        borderRadius: 1
      }}
    >
      {icon.url ? (
        <Box
          component="img"
          src={icon.url}
          alt={item.name}
          draggable={false}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          {(item.name.charAt(0) || '?').toUpperCase()}
        </Typography>
      )}
    </Box>
  );
};

interface RowProps {
  item: ModelItem;
  onPick: (id: string) => void;
}

const ExistingItemRow = ({ item, onPick }: RowProps) => {
  return (
    <ListItemButton
      onClick={() => {
        onPick(item.id);
      }}
    >
      <ListItemIcon sx={{ minWidth: THUMB_SIZE + 8 }}>
        <ItemThumb item={item} />
      </ListItemIcon>
      <ListItemText primary={item.name} />
    </ListItemButton>
  );
};

interface Props {
  open: boolean;
  activeViewItemIds: string[];
  onPick: (modelItemId: string) => void;
  onClose: () => void;
}

export const ExistingItemPicker = ({
  open,
  activeViewItemIds,
  onPick,
  onClose
}: Props) => {
  const items = useModelStore((state) => state.items);
  const [query, setQuery] = useState('');

  const placeableItems = useMemo(() => {
    const placed = new Set(activeViewItemIds);
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (placed.has(item.id)) return false;
      if (needle && !item.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, activeViewItemIds, query]);

  const hasPlaceableItems = useMemo(() => {
    const placed = new Set(activeViewItemIds);
    return items.some((item) => !placed.has(item.id));
  }, [items, activeViewItemIds]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Add existing item</DialogTitle>
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
        {placeableItems.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {hasPlaceableItems
              ? 'No items match your search.'
              : 'All items are already placed in this view.'}
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
            <List dense disablePadding>
              {placeableItems.map((item) => {
                return (
                  <ExistingItemRow
                    key={item.id}
                    item={item}
                    onPick={onPick}
                  />
                );
              })}
            </List>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
          Click an item, then click the canvas to place it. Editing an
          item&apos;s name or description affects all views.
        </Typography>
      </DialogContent>
    </Dialog>
  );
};

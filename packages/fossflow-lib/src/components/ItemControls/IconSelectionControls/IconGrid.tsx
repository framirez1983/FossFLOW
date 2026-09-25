import React from 'react';
import { Icon as IconI } from 'src/types';
import { Grid, Box, IconButton as MuiIconButton } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, LibraryAdd as LibraryAddIcon } from '@mui/icons-material';
import { Icon } from './Icon';

interface Props {
  icons: IconI[];
  onMouseDown?: (icon: IconI) => void;
  onClick?: (icon: IconI) => void;
  onDoubleClick?: (icon: IconI) => void;
  onRenameIcon?: (icon: IconI) => void;
  onDeleteIcon?: (icon: IconI) => void;
  onAddToLibrary?: (icon: IconI) => void;
  hoveredIndex?: number;
  onHover?: (index: number) => void;
}

export const IconGrid = ({ icons, onMouseDown, onClick, onDoubleClick, onRenameIcon, onDeleteIcon, onAddToLibrary, hoveredIndex, onHover }: Props) => {
  return (
    <Grid container>
      {icons.map((icon, index) => {
        const isHovered = hoveredIndex === index;
        return (
          <Grid item xs={3} key={icon.id}>
            <Box
              sx={{
                backgroundColor: isHovered ? 'action.hover' : 'transparent',
                borderRadius: 1,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={() => onHover?.(index)}
            >
              <Icon
                icon={icon}
                onClick={() => {
                  onClick?.(icon);
                }}
                onMouseDown={() => {
                  onMouseDown?.(icon);
                }}
                onDoubleClick={() => {
                  onDoubleClick?.(icon);
                }}
                actions={
                  (icon.collection === 'imported' ||
                    icon.collection === 'library') &&
                  (onRenameIcon || onDeleteIcon || onAddToLibrary) ? (
                    <>
                      {onAddToLibrary && icon.collection === 'imported' && (
                        <MuiIconButton
                          aria-label={`Add ${icon.name} to Library`}
                          size="small"
                          sx={{
                            p: 0.25,
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            boxShadow: 1
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            onAddToLibrary(icon);
                          }}
                        >
                          <LibraryAddIcon fontSize="inherit" />
                        </MuiIconButton>
                      )}
                      {onRenameIcon && onDeleteIcon && (
                        <>
                          <MuiIconButton
                            aria-label={`Rename ${icon.name}`}
                            size="small"
                            sx={{
                              p: 0.25,
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              boxShadow: 1
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              onRenameIcon(icon);
                            }}
                          >
                            <EditIcon fontSize="inherit" />
                          </MuiIconButton>
                          <MuiIconButton
                            aria-label={`Delete ${icon.name}`}
                            size="small"
                            color="error"
                            sx={{
                              p: 0.25,
                              bgcolor: 'background.paper',
                              borderRadius: 1,
                              boxShadow: 1
                            }}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteIcon(icon);
                            }}
                          >
                            <DeleteIcon fontSize="inherit" />
                          </MuiIconButton>
                        </>
                      )}
                    </>
                  ) : undefined
                }
              />
            </Box>
          </Grid>
        );
      })}
    </Grid>
  );
};

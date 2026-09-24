import React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { Button, Typography } from '@mui/material';
import { Icon as IconI } from 'src/types';

const SIZE = 50;

interface Props {
  icon: IconI;
  onClick?: () => void;
  onMouseDown?: () => void;
  onDoubleClick?: () => void;
  actions?: React.ReactNode;
}

export const Icon = ({ icon, onClick, onMouseDown, onDoubleClick, actions }: Props) => {
  return (
    <Box
      sx={{
        position: 'relative',
        width: SIZE,
        '&:hover .icon-tile-actions, &:focus-within .icon-tile-actions': {
          opacity: 1
        }
      }}
    >
      <Button
        variant="text"
        onClick={onClick}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        sx={{
          userSelect: 'none'
        }}
      >
        <Stack
          sx={{ overflow: 'hidden', justifyContent: 'flex-start', width: SIZE }}
          spacing={1}
        >
          <Box sx={{ position: 'relative', width: SIZE, height: SIZE, overflow: 'hidden' }}>
            <Box
              component="img"
              draggable={false}
              src={icon.url}
              alt={`Icon ${icon.name}`}
              sx={{ width: SIZE, height: SIZE }}
            />
            {icon.isIsometric === false && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  padding: '1px 4px',
                  borderRadius: '4px',
                  backgroundColor: '#eeeb',
                  color: '#000'
                }}
              >
                <Typography variant='body2'>
                  flat
                </Typography>
              </Box>
            )}
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            textOverflow="ellipsis"
          >
            {icon.name}
          </Typography>
        </Stack>
      </Button>
      {actions && (
        <Box
          className="icon-tile-actions"
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            display: 'flex',
            gap: 0.5,
            opacity: 0,
            transition: 'opacity 0.15s',
            zIndex: 1
          }}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onDoubleClick={(event) => {
            event.stopPropagation();
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
};

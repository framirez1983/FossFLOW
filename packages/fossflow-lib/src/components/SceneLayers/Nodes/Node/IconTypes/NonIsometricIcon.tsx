import React from 'react';
import { ViewOrientation } from 'src/types/ui';
import { orientProjected, orientationCss } from 'src/utils/viewOrientation';
import { Box } from '@mui/material';
import { Icon } from 'src/types';
import { PROJECTED_TILE_SIZE } from 'src/config';
import { getIsoProjectionCss } from 'src/utils';

interface Props {
  icon: Icon;
  viewOrientation?: ViewOrientation;
}

export const NonIsometricIcon = ({ icon, viewOrientation = 'NE' }: Props) => {
  const position = orientProjected({ x: -PROJECTED_TILE_SIZE.width / 2, y: -PROJECTED_TILE_SIZE.height / 2 }, viewOrientation);
  return (
    <Box sx={{ pointerEvents: 'none' }}>
      <Box
        sx={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transformOrigin: 'top left',
          transform: viewOrientation === 'NE' ? getIsoProjectionCss() : `${orientationCss(viewOrientation)} ${getIsoProjectionCss()}`
        }}
      >
        <Box
          component="img"
          src={icon.url}
          alt={`icon-${icon.id}`}
          sx={{ width: PROJECTED_TILE_SIZE.width * 0.7 * (icon.scale || 1) }}
        />
      </Box>
    </Box>
  );
};

import React from 'react';
import { Box, SxProps } from '@mui/material';
import { clampLabelBackgroundOpacity } from 'src/utils/labelOpacity';

interface Props {
  sx?: SxProps;
  backgroundOpacity?: number;
}

export const Gradient = ({ sx, backgroundOpacity = 1 }: Props) => {
  const fillOpacity = clampLabelBackgroundOpacity(backgroundOpacity);
  return (
    <Box
      sx={{
        background: `linear-gradient(0deg, rgba(255,255,255,${fillOpacity}) 0%, rgba(255,255,255,${fillOpacity}) 5%, rgba(255,255,255,0) 100%)`,
        ...sx
      }}
    />
  );
};

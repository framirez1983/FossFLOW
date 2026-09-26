import React, { useState } from 'react';
import { Coords } from 'src/types';
import { useTheme, Box } from '@mui/material';
import { getIsoProjectionCss } from 'src/utils';
import { Svg } from 'src/components/Svg/Svg';
import { TRANSFORM_ANCHOR_SIZE, TRANSFORM_CONTROLS_COLOR } from 'src/config';

interface Props {
  position: Coords;
  onMouseDown: () => void;
  /** Dimmed and inert, for selections that cannot be transformed. */
  disabled?: boolean;
}

const strokeWidth = 2;

export const TransformAnchor = ({ position, onMouseDown, disabled = false }: Props) => {
  const [isHovered, setIsHovered] = useState(false);
  const theme = useTheme();

  return (
    <Box
      onMouseOver={() => {
        if (disabled) return;
        setIsHovered(true);
      }}
      onMouseOut={() => {
        setIsHovered(false);
      }}
      onMouseDown={() => {
        if (disabled) return;
        onMouseDown();
      }}
      sx={{
        position: 'absolute',
        transform: getIsoProjectionCss(),
        width: TRANSFORM_ANCHOR_SIZE,
        height: TRANSFORM_ANCHOR_SIZE,
        cursor: disabled ? 'not-allowed' : undefined,
        opacity: disabled ? 0.4 : 1
      }}
      style={{
        left: position.x - TRANSFORM_ANCHOR_SIZE / 2,
        top: position.y - TRANSFORM_ANCHOR_SIZE / 2
      }}
    >
      <Svg
        style={{
          width: TRANSFORM_ANCHOR_SIZE,
          height: TRANSFORM_ANCHOR_SIZE
        }}
      >
        <g transform={`translate(${strokeWidth}, ${strokeWidth})`}>
          <rect
            fill={
              isHovered && !disabled
                ? theme.palette.primary.dark
                : theme.palette.common.white
            }
            width={TRANSFORM_ANCHOR_SIZE - strokeWidth * 2}
            height={TRANSFORM_ANCHOR_SIZE - strokeWidth * 2}
            stroke={TRANSFORM_CONTROLS_COLOR}
            strokeWidth={strokeWidth}
            rx={3}
          />
        </g>
      </Svg>
    </Box>
  );
};

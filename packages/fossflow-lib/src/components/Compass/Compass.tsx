import React from 'react';
import { Box } from '@mui/material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { Svg } from 'src/components/Svg/Svg';
import { getCompassNeedleBearing } from 'src/utils/compass';

const SIZE = 34;
const CENTER = SIZE / 2;
const NEEDLE_HALF = 11;
const LABEL_RADIUS = 15;

/**
 * Small compass rose showing where geographic North lies relative to the
 * currently rotated isometric view. UI-only: nothing here is serialized,
 * exported, or written to history.
 *
 * The needle is two-ended so it reads as a direction rather than an arrow.
 * The red half always points along the derived world-North screen vector; the
 * neutral half points the opposite way. The "N" glyph stays upright (so it is
 * always legible) but is positioned at the needle's north tip.
 */
export const Compass = () => {
  const orientation = useUiStateStore((state) => state.viewOrientation);

  const rotation = getCompassNeedleBearing(orientation);
  const radians = (rotation * Math.PI) / 180;

  // Tip of the red (north) half, used to park the upright "N" just beyond it.
  const labelX = CENTER + LABEL_RADIUS * Math.sin(radians);
  const labelY = CENTER - LABEL_RADIUS * Math.cos(radians);

  return (
    <Box
      title={`North (view orientation ${orientation})`}
      aria-label={`Compass showing north, view orientation ${orientation}`}
      sx={{
        width: SIZE,
        height: SIZE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.secondary',
        userSelect: 'none'
      }}
    >
      <Svg
        viewboxSize={{ width: SIZE, height: SIZE }}
        style={{ width: SIZE, height: SIZE, overflow: 'visible' }}
      >
        <g
          style={{ transition: 'transform 0.2s ease-out' }}
          transform={`rotate(${rotation} ${CENTER} ${CENTER})`}
        >
          {/* South half - neutral, theme-aware */}
          <polygon
            points={`${CENTER},${CENTER + NEEDLE_HALF} ${CENTER + 3.2},${CENTER} ${
              CENTER - 3.2
            },${CENTER}`}
            fill="currentColor"
            opacity={0.55}
          />
          {/* North half - red, points at real geographic North */}
          <polygon
            points={`${CENTER},${CENTER - NEEDLE_HALF} ${CENTER + 3.2},${CENTER} ${
              CENTER - 3.2
            },${CENTER}`}
            fill="#e53935"
          />
        </g>

        {/* Upright "N", parked just past the north tip */}
        <text
          x={labelX}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={9}
          fontWeight={700}
          fill="currentColor"
        >
          N
        </text>
      </Svg>
    </Box>
  );
};

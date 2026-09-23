import { useUiStateStore } from 'src/stores/uiStateStore';
import { orientProjected } from 'src/utils/viewOrientation';
import React, { useMemo } from 'react';
import { Coords, AnchorPosition } from 'src/types';
import { Svg } from 'src/components/Svg/Svg';
import { TRANSFORM_CONTROLS_COLOR } from 'src/config';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import {
  getBoundingBox,
  outermostCornerPositions,
  getTilePosition,
  convertBoundsToNamedAnchors
} from 'src/utils';
import { TransformAnchor } from './TransformAnchor';

interface Props {
  keepUpright?: boolean;
  from: Coords;
  to: Coords;
  onAnchorMouseDown?: (anchorPosition: AnchorPosition) => void;
}

const strokeWidth = 2;

export const TransformControls = ({ from, to, onAnchorMouseDown, keepUpright = false }: Props) => {
  const viewOrientation = useUiStateStore(state => state.viewOrientation);
  const { css, pxSize } = useIsoProjection({
    from,
    to,
    keepUpright
  });

  const anchors = useMemo(() => {
    if (!onAnchorMouseDown) return [];

    const corners = getBoundingBox([from, to]);
    const namedCorners = convertBoundsToNamedAnchors(corners);
    const cornerPositions = Object.entries(namedCorners).map(
      ([key, value], i) => {
        const position = getTilePosition({
          tile: value,
          origin: outermostCornerPositions[i]
        });

        return {
          position: orientProjected(position, viewOrientation),
          onMouseDown: () => {
            onAnchorMouseDown(key as AnchorPosition);
          }
        };
      }
    );

    return cornerPositions;
  }, [onAnchorMouseDown, from, to, viewOrientation]);

  return (
    <>
      <Svg
        style={{
          ...css,
          pointerEvents: 'none'
        }}
      >
        <g transform={`translate(${strokeWidth}, ${strokeWidth})`}>
          <rect
            width={pxSize.width - strokeWidth * 2}
            height={pxSize.height - strokeWidth * 2}
            fill="none"
            stroke={TRANSFORM_CONTROLS_COLOR}
            strokeDasharray={`${strokeWidth * 2} ${strokeWidth * 2}`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        </g>
      </Svg>

      {anchors.map(({ position, onMouseDown }) => {
        return (
          <TransformAnchor position={position} onMouseDown={onMouseDown} />
        );
      })}
    </>
  );
};

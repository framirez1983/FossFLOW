import { useMemo } from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { orientProjected, orientationCss } from 'src/utils/viewOrientation';
import { Coords, Size, ProjectionOrientationEnum } from 'src/types';
import {
  getBoundingBox,
  getIsoProjectionCss,
  getTilePosition
} from 'src/utils';
import { UNPROJECTED_TILE_SIZE } from 'src/config';

interface Props {
  from: Coords;
  to: Coords;
  originOverride?: Coords;
  orientation?: keyof typeof ProjectionOrientationEnum;
  keepUpright?: boolean;
}

export const useIsoProjection = ({
  from,
  to,
  originOverride,
  orientation,
  keepUpright = false
}: Props): {
  css: React.CSSProperties;
  position: Coords;
  gridSize: Size;
  pxSize: Size;
} => {
  const viewOrientation = useUiStateStore(state => state.viewOrientation);
  const gridSize = useMemo(() => {
    return {
      width: Math.abs(from.x - to.x) + 1,
      height: Math.abs(from.y - to.y) + 1
    };
  }, [from, to]);

  const origin = useMemo(() => {
    if (originOverride) return originOverride;

    const boundingBox = getBoundingBox([from, to]);

    return boundingBox[3];
  }, [from, to, originOverride]);

  const position = useMemo(() => {
    const pos = getTilePosition({
      tile: origin,
      origin: orientation === 'Y' ? 'TOP' : 'LEFT',
      viewOrientation: keepUpright ? viewOrientation : 'NE'
    });

    return keepUpright ? pos : orientProjected(pos, viewOrientation);
  }, [origin, orientation, viewOrientation, keepUpright]);

  const pxSize = useMemo(() => {
    return {
      width: gridSize.width * UNPROJECTED_TILE_SIZE,
      height: gridSize.height * UNPROJECTED_TILE_SIZE
    };
  }, [gridSize]);

  return useMemo(() => ({
    css: {
      position: 'absolute' as const,
      left: position.x,
      top: position.y,
      width: `${pxSize.width}px`,
      height: `${pxSize.height}px`,
      transform: viewOrientation === 'NE' || keepUpright
        ? getIsoProjectionCss(orientation)
        : `${orientationCss(viewOrientation)} ${getIsoProjectionCss(orientation)}`,
      transformOrigin: 'top left'
    },
    position,
    gridSize,
    pxSize
  }), [position, pxSize, gridSize, orientation, viewOrientation, keepUpright]);
};

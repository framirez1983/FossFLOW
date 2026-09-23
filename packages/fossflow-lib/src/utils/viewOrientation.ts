import { Coords } from 'src/types/common';
import { ViewOrientation } from 'src/types/ui';
import { PROJECTED_TILE_SIZE } from 'src/config';

// Compass names describe the intercardinal direction toward the top of the
// screen; SE is a counter-clockwise visual turn.
export const VIEW_ORIENTATIONS: readonly ViewOrientation[] = ['NE', 'SE', 'SW', 'NW'];

/** Exact model-plane quarter turns. Never writes back to model coordinates. */
export const orientTile = (
  point: Coords,
  orientation: ViewOrientation
): Coords => {
  switch (orientation) {
    case 'SE':
      return { x: -point.y, y: point.x };
    case 'SW':
      return { x: -point.x, y: -point.y };
    case 'NW':
      return { x: point.y, y: -point.x };
    default:
      return point;
  }
};

export const inverseOrientation = (
  orientation: ViewOrientation
): ViewOrientation =>
  VIEW_ORIENTATIONS[(4 - VIEW_ORIENTATIONS.indexOf(orientation)) % 4];

/** P R P^-1: rotate already projected geometry, before viewport pan/zoom. */
export const orientProjected = (
  point: Coords,
  orientation: ViewOrientation
): Coords => {
  const ratio = PROJECTED_TILE_SIZE.width / PROJECTED_TILE_SIZE.height;
  switch (orientation) {
    case 'SE':
      return { x: ratio * point.y, y: -point.x / ratio };
    case 'SW':
      return { x: -point.x, y: -point.y };
    case 'NW':
      return { x: -ratio * point.y, y: point.x / ratio };
    default:
      return point;
  }
};

export const orientationCss = (orientation: ViewOrientation): string => {
  const x = orientProjected({ x: 1, y: 0 }, orientation);
  const y = orientProjected({ x: 0, y: 1 }, orientation);
  return `matrix(${x.x}, ${x.y}, ${y.x}, ${y.y}, 0, 0)`;
};

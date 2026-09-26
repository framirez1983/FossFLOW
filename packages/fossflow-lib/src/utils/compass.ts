import { Coords } from 'src/types/common';
import { ViewOrientation } from 'src/types/ui';
import { getTilePosition } from 'src/utils/renderer';

/**
 * Compass / north indicator helpers.
 *
 * World axes (derived from the renderer, not assumed):
 * the model's +x axis points East and its +y axis points North.
 *
 * Proof, using `getTilePosition` and the documented meaning of ViewOrientation
 * ("the direction pointing toward the top of the screen"): for each orientation
 * we search the 8 neighbouring tile directions for the one that projects
 * straight up on screen, and read off its compass name.
 *
 *   orientation NE -> tile ( 1,  1) -> East+North = NE
 *   orientation SE -> tile ( 1, -1) -> East-South = SE
 *   orientation SW -> tile (-1, -1) -> West-South = SW
 *   orientation NW -> tile (-1,  1) -> West+North = NW
 *
 * This holds only under the assignment above; swapping the axes (x = North)
 * yields SE -> NW and NW -> SE, which contradicts the orientation names.
 *
 * So geographic North is the tile direction (0, +1). It is NOT simply
 * "45 degrees off the orientation label": the isometric projection is squashed
 * (PROJECTED_TILE_SIZE is 141.5 x 81.9, a 1.7277:1 ratio), so North lands on a
 * screen vector that is steeper than a 45 degree diagonal. In the default NE
 * view that vector points up and to the LEFT.
 */

/** The world-space direction of geographic North, in tile coordinates. */
export const WORLD_NORTH: Coords = { x: 0, y: 1 };

/**
 * Screen-space vector (renderer units, y grows downward) pointing from the
 * centre of a tile toward geographic North for the given view orientation.
 */
export const getCompassNorthVector = (orientation: ViewOrientation): Coords => {
  const from = getTilePosition({ tile: { x: 0, y: 0 }, viewOrientation: orientation });
  const north = getTilePosition({
    tile: WORLD_NORTH,
    viewOrientation: orientation
  });

  return { x: north.x - from.x, y: north.y - from.y };
};

/**
 * CSS rotation in degrees for a north-pointing needle.
 * Zero means "up" (12 o'clock) and positive values rotate clockwise, matching
 * the screen coordinate system where y grows downward.
 *
 * Derived results: NE -59.938, NW +59.938, SW +120.062, SE -120.062.
 */
export const getCompassNeedleRotation = (orientation: ViewOrientation): number => {
  const north = getCompassNorthVector(orientation);

  return (Math.atan2(north.x, -north.y) * 180) / Math.PI;
};

/**
 * Compass bearing of geographic North, where 0 is up (screen top) and 90 is
 * right. Identical to the needle rotation, but named for callers that place an
 * upright label at the north tip rather than rotating a needle.
 */
export const getCompassNeedleBearing = (orientation: ViewOrientation): number =>
  getCompassNeedleRotation(orientation);

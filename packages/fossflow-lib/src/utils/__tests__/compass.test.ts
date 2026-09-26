import { ViewOrientation } from 'src/types/ui';
import { getTilePosition } from 'src/utils/renderer';
import { PROJECTED_TILE_SIZE } from 'src/config';
import {
  WORLD_NORTH,
  getCompassNeedleBearing,
  getCompassNeedleRotation,
  getCompassNorthVector
} from '../compass';

const ORIENTATIONS: ViewOrientation[] = ['NE', 'NW', 'SW', 'SE'];

/** Screen-space direction of a world tile direction, relative to the origin. */
const screenVector = (tile: { x: number; y: number }, orientation: ViewOrientation) => {
  const from = getTilePosition({ tile: { x: 0, y: 0 }, viewOrientation: orientation });
  const to = getTilePosition({ tile, viewOrientation: orientation });

  return { x: to.x - from.x, y: to.y - from.y };
};

const COMPASS_NAMES: Record<string, string> = {
  '1,0': 'E',
  '0,1': 'N',
  '1,1': 'NE',
  '1,-1': 'SE',
  '-1,0': 'W',
  '0,-1': 'S',
  '-1,-1': 'SW',
  '-1,1': 'NW'
};

const EIGHT_DIRECTIONS = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: -1 },
  { x: -1, y: 1 }
];

const directionKey = (d: { x: number; y: number }) => `${d.x},${d.y}`;

describe('compass orientation', () => {
  it('treats the world +y tile axis as geographic North', () => {
    expect(WORLD_NORTH).toEqual({ x: 0, y: 1 });
  });

  describe('world-axis derivation', () => {
    // Guards the assumption the whole compass rests on: the model's +x axis is
    // East and +y is North. Verified by checking that, for every orientation,
    // the tile direction projecting straight up is the compass name that
    // orientation claims. Swapping the axes would break SE and NW.
    it.each(ORIENTATIONS)(
      'orientation %s points the named world direction at the top of the screen',
      (orientation) => {
        const up = EIGHT_DIRECTIONS.filter((tile) => {
          const vector = screenVector(tile, orientation);
          return Math.abs(vector.x) < 1e-9 && vector.y < 0;
        });

        expect(up).toHaveLength(1);
        expect(COMPASS_NAMES[directionKey(up[0])]).toBe(orientation);
      }
    );
  });

  describe('getCompassNorthVector', () => {
    it('points North up-and-left in the default NE view', () => {
      const vector = getCompassNorthVector('NE');

      expect(vector.x).toBeLessThan(0);
      expect(vector.y).toBeLessThan(0);
    });

    it.each([
      ['NE', -1, -1],
      ['NW', 1, -1],
      ['SW', 1, 1],
      ['SE', -1, 1]
    ] as [ViewOrientation, number, number][])(
      'for %s the North vector has signs x=%i, y=%i',
      (orientation, xSign, ySign) => {
        const vector = getCompassNorthVector(orientation);

        expect(Math.sign(vector.x)).toBe(xSign);
        expect(Math.sign(vector.y)).toBe(ySign);
      }
    );

    it('is symmetric about the vertical axis', () => {
      const ne = getCompassNorthVector('NE');
      const nw = getCompassNorthVector('NW');

      expect(nw.x).toBeCloseTo(-ne.x, 6);
      expect(nw.y).toBeCloseTo(ne.y, 6);
    });
  });

  describe('getCompassNeedleRotation', () => {
    // The isometric projection is squashed (141.5 x 81.9), so North is NOT on
    // a 45 degree diagonal. These values are derived, not chosen.
    const EXPECTED: Record<ViewOrientation, number> = {
      NE: -59.9378,
      NW: 59.9378,
      SW: 120.0622,
      SE: -120.0622
    };

    it.each(ORIENTATIONS)('maps %s to the derived rotation', (orientation) => {
      expect(getCompassNeedleRotation(orientation)).toBeCloseTo(
        EXPECTED[orientation],
        3
      );
    });

    it('agrees with the expected atan2 of the real projection', () => {
      ORIENTATIONS.forEach((orientation) => {
        const north = getCompassNorthVector(orientation);
        const expected = (Math.atan2(north.x, -north.y) * 180) / Math.PI;

        expect(getCompassNeedleRotation(orientation)).toBeCloseTo(expected, 9);
      });
    });

    it('is never 45 degrees off vertical, which the old hardcoding assumed', () => {
      ORIENTATIONS.forEach((orientation) => {
        expect(Math.abs(getCompassNeedleRotation(orientation))).not.toBeCloseTo(
          45,
          3
        );
      });
    });

    it('completes exactly one full turn walking the view rotations in order', () => {
      // Rotating the view is a quarter turn in model space, but the squashed
      // isometric projection maps those to unequal screen rotations (the steps
      // alternate ~60.1 and ~119.9 degrees). Walking the cycle must still sum
      // to a full turn.
      const order: ViewOrientation[] = ['NE', 'SE', 'SW', 'NW'];

      let total = 0;
      order.forEach((orientation, index) => {
        const current = getCompassNeedleRotation(orientation);
        const previous = getCompassNeedleRotation(order[(index + 3) % 4]);

        // Unwrap to the shortest signed step.
        let step = current - previous;
        while (step > 180) step -= 360;
        while (step < -180) step += 360;

        total += step;
      });

      expect(total).toBeCloseTo(-360, 3);
    });

    it('keeps NE/NW and SE/SW mirror-symmetric about vertical', () => {
      expect(getCompassNeedleRotation('NW')).toBeCloseTo(
        -getCompassNeedleRotation('NE'),
        6
      );
      expect(getCompassNeedleRotation('SW')).toBeCloseTo(
        -getCompassNeedleRotation('SE'),
        6
      );
    });
  });

  describe('getCompassNeedleBearing', () => {
    it.each(ORIENTATIONS)('matches the needle rotation for %s', (orientation) => {
      expect(getCompassNeedleBearing(orientation)).toBe(
        getCompassNeedleRotation(orientation)
      );
    });
  });

  it('uses the real projected tile aspect ratio', () => {
    // Sanity check that the derivation is not accidentally using a 1:1 square.
    expect(PROJECTED_TILE_SIZE.width / PROJECTED_TILE_SIZE.height).toBeCloseTo(
      1.7277,
      3
    );
  });
});

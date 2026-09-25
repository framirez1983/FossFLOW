import { ViewOrientation } from 'src/types/ui';

/**
 * Compass heading mapping:
 * ViewOrientation = the direction pointing toward the TOP of the screen.
 * 
 * NE (default): top of screen points Northeast → North is at 45° clockwise from top
 * SE: top points Southeast → North is at 135° clockwise from top (or -225°)
 * SW: top points Southwest → North is at 225° clockwise from top (or -135°)
 * NW: top points Northwest → North is at 315° clockwise from top (or -45°)
 * 
 * Since the compass shows where North is relative to screen top,
 * the needle rotation = -orientationAngle (counter-clockwise)
 * 
 * NE: orientation=45° → needle at -45° (or 315°) 
 * SE: orientation=135° → needle at -135° (or 225°)
 * SW: orientation=225° → needle at -225° (or 135°)
 * NW: orientation=315° → needle at -315° (or 45°)
 */

export const getCompassNeedleRotation = (orientation: ViewOrientation): number => {
  // ViewOrientation = direction pointing to TOP of screen
  // Compass needle should point to geographic North
  // Needle rotation = -(orientation angle from North)
  switch (orientation) {
    case 'NE':
      return -45;   // or 315
    case 'SE':
      return -135;  // or 225
    case 'SW':
      return 135;   // or -225
    case 'NW':
      return 45;    // or -315
    default:
      return 0;
  }
};

export const getCompassLabel = (): string => 'N';
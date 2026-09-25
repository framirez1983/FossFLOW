import { getCompassNeedleRotation, getCompassLabel } from '../compass';

describe('compass', () => {
  it('returns correct needle rotation for each ViewOrientation', () => {
    expect(getCompassNeedleRotation('NE')).toBe(-45);
    expect(getCompassNeedleRotation('SE')).toBe(-135);
    expect(getCompassNeedleRotation('SW')).toBe(135);
    expect(getCompassNeedleRotation('NW')).toBe(45);
  });

  it('returns N as label', () => {
    expect(getCompassLabel()).toBe('N');
  });
});
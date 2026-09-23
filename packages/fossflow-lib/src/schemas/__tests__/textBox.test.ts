import { textBoxSchema } from '../textBox';

describe('textBoxSchema', () => {
  it('validates a correct text box', () => {
    const valid = { id: 'tb1', tile: { x: 0, y: 0 }, content: 'Text' };
    expect(textBoxSchema.safeParse(valid).success).toBe(true);
  });
  it('fails if content is missing', () => {
    const invalid = { id: 'tb1', tile: { x: 0, y: 0 } };
    const result = textBoxSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue: any) => {
          return issue.path.includes('content');
        })
      ).toBe(true);
    }
  });
  it('accepts a missing textOrientation (behaves as SCREEN)', () => {
    const legacy = { id: 'tb1', tile: { x: 0, y: 0 }, content: 'Text' };
    const result = textBoxSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.textOrientation).toBeUndefined();
    }
  });
  it('accepts SCREEN and FOLLOW_PLANE and rejects other values', () => {
    const base = { id: 'tb1', tile: { x: 0, y: 0 }, content: 'Text' };
    expect(
      textBoxSchema.safeParse({ ...base, textOrientation: 'SCREEN' }).success
    ).toBe(true);
    expect(
      textBoxSchema.safeParse({ ...base, textOrientation: 'FOLLOW_PLANE' })
        .success
    ).toBe(true);
    expect(
      textBoxSchema.safeParse({ ...base, textOrientation: 'SIDEWAYS' }).success
    ).toBe(false);
  });
});

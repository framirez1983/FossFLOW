import {
  clampLabelBackgroundOpacity,
  resolveLabelBackgroundOpacity,
  resolveConnectorLabelBackgroundOpacity,
  labelOpacityToPercent,
  labelPercentToOpacity,
  DEFAULT_LABEL_BACKGROUND_OPACITY,
  CONNECTOR_LABEL_DEFAULT_BACKGROUND_OPACITY
} from '../labelOpacity';
import { viewItemSchema } from 'src/schemas/views';
import { connectorLabelSchema } from 'src/schemas/connector';
import { modelSchema } from 'src/schemas/model';

describe('labelOpacity', () => {
  it('defaults to fully opaque', () => {
    expect(DEFAULT_LABEL_BACKGROUND_OPACITY).toBe(1);
    expect(resolveLabelBackgroundOpacity(undefined, undefined)).toBe(1);
  });

  it('per-label override takes precedence over global', () => {
    expect(resolveLabelBackgroundOpacity(0.25, 0.9)).toBe(0.25);
    expect(resolveLabelBackgroundOpacity(0, 1)).toBe(0);
    expect(resolveLabelBackgroundOpacity(undefined, 0.5)).toBe(0.5);
  });

  it('clamps out-of-range values', () => {
    expect(clampLabelBackgroundOpacity(-1)).toBe(0);
    expect(clampLabelBackgroundOpacity(2)).toBe(1);
    expect(resolveLabelBackgroundOpacity(99, 1)).toBe(1);
  });

  it('connector labels fall back to legacy 0.95 only when no values set', () => {
    expect(CONNECTOR_LABEL_DEFAULT_BACKGROUND_OPACITY).toBe(0.95);
    expect(
      resolveConnectorLabelBackgroundOpacity(undefined, undefined)
    ).toBe(0.95);
    expect(resolveConnectorLabelBackgroundOpacity(0.3, 1)).toBe(0.3);
    expect(resolveConnectorLabelBackgroundOpacity(undefined, 1)).toBe(1);
  });

  it('converts between opacity values and percentages', () => {
    expect(labelOpacityToPercent(1)).toBe(100);
    expect(labelOpacityToPercent(0)).toBe(0);
    expect(labelOpacityToPercent(undefined)).toBe(100);
    expect(labelPercentToOpacity(50)).toBe(0.5);
    expect(labelPercentToOpacity(0)).toBe(0);
  });

  it('existing diagrams without opacity fields still validate', () => {
    expect(
      viewItemSchema.safeParse({ id: 'a', tile: { x: 1, y: 2 } }).success
    ).toBe(true);
    expect(
      connectorLabelSchema.safeParse({
        id: 'l1',
        text: 'hello',
        position: 50
      }).success
    ).toBe(true);
  });

  it('accepts new optional opacity fields and rejects out-of-range', () => {
    expect(
      viewItemSchema.safeParse({
        id: 'a',
        tile: { x: 1, y: 2 },
        labelBackgroundOpacity: 0.5
      }).success
    ).toBe(true);
    expect(
      viewItemSchema.safeParse({
        id: 'a',
        tile: { x: 1, y: 2 },
        labelBackgroundOpacity: 2
      }).success
    ).toBe(false);
    expect(
      connectorLabelSchema.safeParse({
        id: 'l1',
        text: 'hello',
        position: 50,
        backgroundOpacity: 0
      }).success
    ).toBe(true);
    expect(
      connectorLabelSchema.safeParse({
        id: 'l1',
        text: 'hello',
        position: 50,
        backgroundOpacity: -0.1
      }).success
    ).toBe(false);
  });

  it('persists the diagram-wide global opacity on the model', () => {
    const base = {
      title: 'Opacity diagram',
      items: [],
      views: [],
      icons: [],
      colors: []
    };
    expect(
      modelSchema.safeParse({ ...base, labelBackgroundOpacity: 0.6 }).success
    ).toBe(true);
    expect(
      modelSchema.safeParse({ ...base, labelBackgroundOpacity: 2 }).success
    ).toBe(false);
    // Old diagrams without the field remain valid (default to 1.0).
    const legacy = modelSchema.safeParse(base);
    expect(legacy.success).toBe(true);
    if (legacy.success) {
      expect(legacy.data.labelBackgroundOpacity).toBeUndefined();
      expect(
        resolveLabelBackgroundOpacity(
          undefined,
          legacy.data.labelBackgroundOpacity ?? 1
        )
      ).toBe(1);
    }
  });

  it('survives a JSON save/load round trip at non-default opacity', () => {
    const saved = JSON.stringify({
      title: 'Opacity diagram',
      labelBackgroundOpacity: 0.6,
      items: [],
      views: [],
      icons: [],
      colors: []
    });
    const reloaded = modelSchema.parse(JSON.parse(saved));

    expect(reloaded.labelBackgroundOpacity).toBe(0.6);
    // Per-label override still wins over the persisted global.
    expect(resolveLabelBackgroundOpacity(0.25, reloaded.labelBackgroundOpacity)).toBe(
      0.25
    );
    expect(
      resolveLabelBackgroundOpacity(undefined, reloaded.labelBackgroundOpacity)
    ).toBe(0.6);
  });
});

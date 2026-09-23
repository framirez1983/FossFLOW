export const DEFAULT_LABEL_BACKGROUND_OPACITY = 1;

// Preserves the legacy connector label look (previously `opacity: 0.95`
// on the whole card). Used only when neither a per-label override nor a
// global value is available.
export const CONNECTOR_LABEL_DEFAULT_BACKGROUND_OPACITY = 0.95;

export const clampLabelBackgroundOpacity = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_LABEL_BACKGROUND_OPACITY;
  return Math.min(1, Math.max(0, value));
};

export const resolveLabelBackgroundOpacity = (
  perLabelOverride?: number,
  globalOpacity?: number
): number => {
  if (perLabelOverride !== undefined) {
    return clampLabelBackgroundOpacity(perLabelOverride);
  }

  if (globalOpacity !== undefined) {
    return clampLabelBackgroundOpacity(globalOpacity);
  }

  return DEFAULT_LABEL_BACKGROUND_OPACITY;
};

export const resolveConnectorLabelBackgroundOpacity = (
  perLabelOverride?: number,
  globalOpacity?: number
): number => {
  if (perLabelOverride !== undefined) {
    return clampLabelBackgroundOpacity(perLabelOverride);
  }

  if (globalOpacity !== undefined) {
    return clampLabelBackgroundOpacity(globalOpacity);
  }

  return CONNECTOR_LABEL_DEFAULT_BACKGROUND_OPACITY;
};

export const labelOpacityToPercent = (value?: number): number => {
  return Math.round(clampLabelBackgroundOpacity(value ?? DEFAULT_LABEL_BACKGROUND_OPACITY) * 100);
};

export const labelPercentToOpacity = (percent: number): number => {
  return clampLabelBackgroundOpacity(percent / 100);
};

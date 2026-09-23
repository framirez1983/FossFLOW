export interface LabelSettings {
  expandButtonPadding: number; // Padding in theme units when expand button is visible
  backgroundOpacity?: number; // Label background fill opacity 0-1 (text/border stay opaque). Undefined = 1.
}

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  expandButtonPadding: 0, // Default 0 theme units (no extra padding)
  backgroundOpacity: 1 // Default fully opaque background so existing diagrams are unchanged
};

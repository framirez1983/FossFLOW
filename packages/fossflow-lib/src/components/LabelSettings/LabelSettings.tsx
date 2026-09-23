import React from 'react';
import {
  Box,
  Typography,
  Slider
} from '@mui/material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import {
  labelOpacityToPercent,
  labelPercentToOpacity
} from 'src/utils/labelOpacity';

export const LabelSettings = () => {
  const labelSettings = useUiStateStore((state) => state.labelSettings);
  const setLabelSettings = useUiStateStore((state) => state.actions.setLabelSettings);

  const handlePaddingChange = (_event: Event, value: number | number[]) => {
    setLabelSettings({
      ...labelSettings,
      expandButtonPadding: value as number
    });
  };

  const handleBackgroundOpacityChange = (
    _event: Event,
    value: number | number[]
  ) => {
    setLabelSettings({
      ...labelSettings,
      backgroundOpacity: labelPercentToOpacity(value as number)
    });
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Configure label display settings
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" gutterBottom>
          Expand Button Padding
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Bottom padding when expand button is visible (prevents text overlap)
        </Typography>
        <Slider
          value={labelSettings.expandButtonPadding}
          onChange={handlePaddingChange}
          min={0}
          max={8}
          step={0.5}
          marks
          valueLabelDisplay="auto"
          sx={{ mt: 2 }}
        />
        <Typography variant="caption" color="text.secondary">
          Current: {labelSettings.expandButtonPadding} theme units
        </Typography>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="body1" gutterBottom>
          Label background opacity
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Background fill transparency (text, borders and connector lines stay opaque)
        </Typography>
        <Slider
          value={labelOpacityToPercent(labelSettings.backgroundOpacity)}
          onChange={handleBackgroundOpacityChange}
          min={0}
          max={100}
          step={1}
          marks
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}%`}
          sx={{ mt: 2 }}
        />
        <Typography variant="caption" color="text.secondary">
          Current: {labelOpacityToPercent(labelSettings.backgroundOpacity)}%
        </Typography>
      </Box>
    </Box>
  );
};

import React from 'react';
import {
  RotateLeft,
  RotateRight,
  Add as ZoomInIcon,
  Remove as ZoomOutIcon,
  CropFreeOutlined as FitToScreenIcon,
  Help as HelpIcon,
  Explore as CompassIcon
} from '@mui/icons-material';
import { Stack, Box, Typography, Divider } from '@mui/material';
import { toPx } from 'src/utils';
import { UiElement } from 'src/components/UiElement/UiElement';
import { IconButton } from 'src/components/IconButton/IconButton';
import { MAX_ZOOM, MIN_ZOOM } from 'src/config';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useDiagramUtils } from 'src/hooks/useDiagramUtils';
import { DialogTypeEnum } from 'src/types/ui';
import { getCompassNeedleRotation, getCompassLabel } from 'src/utils/compass';

export const ZoomControls = () => {
  const uiStateStoreActions = useUiStateStore((state) => {
    return state.actions;
  });
  const zoom = useUiStateStore((state) => {
    return state.zoom;
  });
  const orientation = useUiStateStore(state => state.viewOrientation);
  const { fitToView } = useDiagramUtils();

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <UiElement>
        <Stack direction="row">
          <IconButton
            name="Zoom out"
            Icon={<ZoomOutIcon />}
            onClick={uiStateStoreActions.decrementZoom}
            disabled={zoom >= MAX_ZOOM}
          />
          <Divider orientation="vertical" flexItem />
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minWidth: toPx(60)
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {Math.ceil(zoom * 100)}%
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          <IconButton
            name="Zoom in"
            Icon={<ZoomInIcon />}
            onClick={uiStateStoreActions.incrementZoom}
            disabled={zoom <= MIN_ZOOM}
          />
        </Stack>
      </UiElement>
      <UiElement>
        <Stack direction="row" alignItems="center">
          <IconButton name="Rotate view counter-clockwise" Icon={<RotateLeft />}
            onClick={() => uiStateStoreActions.rotateView(false)} />
          <Typography variant="body2" color="text.secondary">{orientation}</Typography>
          <IconButton name="Rotate view clockwise" Icon={<RotateRight />}
            onClick={() => uiStateStoreActions.rotateView(true)} />
        </Stack>
      </UiElement>
      <UiElement sx={{ ml: 1 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 40,
            minHeight: 40
          }}
          title="Compass: North indicator"
        >
          <Box
            sx={{
              transform: `rotate(${getCompassNeedleRotation(orientation)}deg)`,
              transition: 'transform 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CompassIcon sx={{ fontSize: 20, color: 'primary.main' }} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'nowrap' }}>
            {getCompassLabel()}
          </Typography>
        </Box>
      </UiElement>
      <UiElement>
        <IconButton
          name="Fit to screen"
          Icon={<FitToScreenIcon />}
          onClick={fitToView}
        />
      </UiElement>
      <UiElement>
        <IconButton
          name="Help (F1)"
          Icon={<HelpIcon />}
          onClick={() => {
            return uiStateStoreActions.setDialog(DialogTypeEnum.HELP);
          }}
        />
      </UiElement>
    </Stack>
  );
};

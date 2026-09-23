import { useUiStateStore } from 'src/stores/uiStateStore';
import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { Coords } from 'src/types';
import { getTilePosition } from 'src/utils';
import { useIcon } from 'src/hooks/useIcon';

interface Props {
  iconId: string;
  tile: Coords;
}

export const DragAndDrop = ({ iconId, tile }: Props) => {
  const viewOrientation = useUiStateStore(state => state.viewOrientation);
  const { iconComponent } = useIcon(iconId, viewOrientation);

  const tilePosition = useMemo(() => {
    return getTilePosition({ tile, origin: 'BOTTOM', viewOrientation });
  }, [tile, viewOrientation]);

  return (
    <Box
      sx={{
        position: 'absolute'
      }}
      style={{ left: tilePosition.x, top: tilePosition.y }}
    >
      {iconComponent}
    </Box>
  );
};

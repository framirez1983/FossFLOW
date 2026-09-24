import React, { useMemo, memo } from 'react';
import { Box, Typography } from '@mui/material';
import { toPx, CoordsUtils } from 'src/utils';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import { useTextBoxProps } from 'src/hooks/useTextBoxProps';
import { useScene } from 'src/hooks/useScene';

interface Props {
  textBox: ReturnType<typeof useScene>['textBoxes'][0];
}

export const TextBox = memo(({ textBox }: Props) => {
  const { paddingX, fontProps } = useTextBoxProps(textBox);

  const to = useMemo(() => {
    return CoordsUtils.add(textBox.tile, {
      x: textBox.size.width,
      y: 0
    });
  }, [textBox.tile, textBox.size.width]);

  const { css } = useIsoProjection({
    from: textBox.tile,
    to,
    orientation: textBox.orientation,
    keepUpright: textBox.textOrientation !== 'FOLLOW_PLANE'
  });

  return (
    <Box style={css}>
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          px: toPx(paddingX)
        }}
      >
        <Typography
          sx={{
            ...fontProps,
            // Free TextBox content is single-line by authoring (single-line
            // TextField; explicit \n is unsupported and collapses). Prevent
            // automatic whitespace wrapping so a tight box overflows instead
            // of inventing lines the editor never showed. Node and connector
            // labels are untouched.
            whiteSpace: 'nowrap'
          }}
        >
          {textBox.content}
        </Typography>
      </Box>
    </Box>
  );
});

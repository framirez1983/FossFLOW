import React from 'react';
import { GlobalStyles as MUIGlobalStyles } from '@mui/material';
import 'react-quill-new/dist/quill.snow.css';
// Bundle the Roboto faces the diagram font stack ('Roboto, Arial,
// sans-serif') resolves to. This makes text metrics identical in the editor,
// canvas measurement, export renderer, PNG rasterizer and standalone SVG
// viewers on every machine, and lets dom-to-image-more embed the faces as
// data URLs so artifacts are self-contained (system stacks cannot embed).
// Latin subsets only: other scripts fall back identically everywhere.
import '@fontsource/roboto/latin-400.css';
import '@fontsource/roboto/latin-500.css';
import '@fontsource/roboto/latin-600.css';
import '@fontsource/roboto/latin-700.css';

export const GlobalStyles = () => {
  return (
    <MUIGlobalStyles
      styles={{
        div: {
          boxSizing: 'border-box'
        }
      }}
    />
  );
};

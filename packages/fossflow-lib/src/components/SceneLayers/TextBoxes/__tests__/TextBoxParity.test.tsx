import React from 'react';
import { render, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import {
  UiStateProvider,
  useUiStateStoreApi
} from 'src/stores/uiStateStore';
import { TextBox } from '../TextBox';

const textBoxProps = {
  id: 'tb1',
  tile: { x: 2, y: 2 },
  content: 'Main Office',
  fontSize: 0.6,
  orientation: 'X' as const,
  textOrientation: 'SCREEN' as const,
  size: { width: 3.4, height: 1 }
};

const renderInMode = (
  editorMode: 'EDITABLE' | 'NON_INTERACTIVE'
): string => {
  let uiApi!: ReturnType<typeof useUiStateStoreApi>;
  const Capture = () => {
    uiApi = useUiStateStoreApi();
    return null;
  };
  const { container, unmount } = render(
    <ThemeProvider theme={theme}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <Capture />
            <TextBox textBox={textBoxProps} />
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );

  act(() => {
    uiApi.getState().actions.setEditorMode(editorMode);
  });

  const html = container.innerHTML;
  unmount();
  return html;
};

describe('TextBox editor/export parity', () => {
  it('renders identical markup in EDITABLE and NON_INTERACTIVE modes', () => {
    // There must be no mode-dependent branches in TextBox markup or styles:
    // parity between the trees then reduces to identical geometry inputs.
    expect(renderInMode('NON_INTERACTIVE')).toBe(renderInMode('EDITABLE'));
  });

  it('renders explicit newlines exactly as the shared CSS dictates', () => {    let uiApi!: ReturnType<typeof useUiStateStoreApi>;
    const Capture = () => {
      uiApi = useUiStateStoreApi();
      return null;
    };
    const { container, unmount } = render(
      <ThemeProvider theme={theme}>
        <ModelProvider>
          <SceneProvider>
            <UiStateProvider>
              <Capture />
              <TextBox
                textBox={{ ...textBoxProps, content: 'Line1\nLine2' }}
              />
            </UiStateProvider>
          </SceneProvider>
        </ModelProvider>
      </ThemeProvider>
    );

    act(() => {
      uiApi.getState().actions.setEditorMode('EDITABLE');
    });

    // Single-line white-space (nowrap) collapses the newline like normal
    // did: documents that explicit breaks are NOT lines under the shared
    // single-line TextBox semantics.
    expect(container.textContent).toContain('Line1');
    expect(container.querySelector('p')?.textContent).toBe('Line1\nLine2');
    unmount();
  });

  it('pins the single-line TextBox semantic: no automatic whitespace wrapping', () => {
    const { container, unmount } = render(
      <ThemeProvider theme={theme}>
        <ModelProvider>
          <SceneProvider>
            <UiStateProvider>
              <TextBox textBox={textBoxProps} />
            </UiStateProvider>
          </SceneProvider>
        </ModelProvider>
      </ThemeProvider>
    );

    // Free TextBox content is single-line by authoring: the renderer must
    // not invent line breaks at whitespace, in any mode or engine.
    const paragraph = container.querySelector('p') as HTMLElement;
    expect(window.getComputedStyle(paragraph).whiteSpace).toBe('nowrap');
    unmount();
  });
});

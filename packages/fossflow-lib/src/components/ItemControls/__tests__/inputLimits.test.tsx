import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import {
  UiStateProvider,
  useUiStateStoreApi
} from 'src/stores/uiStateStore';
import { Model } from 'src/types';
import { TextBoxControls } from '../TextBoxControls/TextBoxControls';
import { NodeSettings } from '../NodeControls/NodeSettings/NodeSettings';

jest.mock('src/components/RichTextEditor/RichTextEditor', () => {
  return {
    RichTextEditor: () => null
  };
});

const buildModel = (): Model => {
  return {
    title: 'Limits',
    version: '1.0',
    icons: [],
    colors: [],
    items: [{ id: 'n1', name: 'Node' }],
    views: [
      {
        id: 'v1',
        name: 'Main',
        items: [{ id: 'n1', tile: { x: 0, y: 0 } }],
        textBoxes: [{ id: 'tb1', tile: { x: 1, y: 1 }, content: 'Text' }]
      }
    ]
  };
};

const seed = (children?: React.ReactNode) => {
  let modelApi!: ReturnType<typeof useModelStoreApi>;
  let uiApi!: ReturnType<typeof useUiStateStoreApi>;
  const Capture = () => {
    modelApi = useModelStoreApi();
    uiApi = useUiStateStoreApi();
    return null;
  };
  const utils = render(
    <ThemeProvider theme={theme}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <Capture />
            {children}
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );
  act(() => {
    modelApi.getState().actions.set(buildModel(), true);
    uiApi.getState().actions.setEditorMode('EDITABLE');
    uiApi.getState().actions.setView('v1');
  });
  return { ...utils, modelApi, uiApi, Capture };
};

describe('input length guards', () => {
  it('TextBox content field caps at 500 characters', () => {
    seed(<TextBoxControls id="tb1" />);

    const input = document.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.getAttribute('maxlength')).toBe('500');
  });

  it('Node name field caps at 100 characters', () => {
    const noop = () => {};
    seed(
      <NodeSettings
        node={{ id: 'n1', tile: { x: 0, y: 0 } }}
        onModelItemUpdated={noop}
        onViewItemUpdated={noop}
        onDeleted={noop}
      />
    );

    const input = document.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe('Node');
    expect(input.getAttribute('maxlength')).toBe('100');
  });
});

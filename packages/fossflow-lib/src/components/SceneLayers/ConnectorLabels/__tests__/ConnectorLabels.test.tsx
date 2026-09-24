import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider, useSceneStoreApi } from 'src/stores/sceneStore';
import {
  UiStateProvider,
  useUiStateStoreApi
} from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { Model } from 'src/types';
import { ConnectorLabels } from '../ConnectorLabels';

const buildModel = (): Model => {
  return {
    title: 'Labels',
    version: '1.0',
    icons: [],
    colors: [],
    items: [
      { id: 'n1', name: 'Test Node' },
      { id: 'n2', name: 'Other' }
    ],
    views: [
      {
        id: 'v1',
        name: 'Main',
        items: [
          { id: 'n1', tile: { x: 0, y: 0 } },
          { id: 'n2', tile: { x: 6, y: 0 } }
        ],
        connectors: [
          {
            id: 'c1',
            anchors: [
              { id: 'a0', ref: { item: 'n1' } },
              { id: 'a1', ref: { item: 'n2' } }
            ],
            labels: [{ id: 'l1', text: 'Fiber Optics', position: 50 }]
          }
        ]
      }
    ]
  };
};

const renderLabels = () => {
  let modelApi!: ReturnType<typeof useModelStoreApi>;
  let sceneApi!: ReturnType<typeof useSceneStoreApi>;
  let uiApi!: ReturnType<typeof useUiStateStoreApi>;
  let connectors!: ReturnType<typeof useScene>['connectors'];
  const Capture = () => {
    modelApi = useModelStoreApi();
    sceneApi = useSceneStoreApi();
    uiApi = useUiStateStoreApi();
    connectors = useScene().connectors;
    return null;
  };
  const { rerender } = render(
    <ThemeProvider theme={theme}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <Capture />
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );

  act(() => {
    modelApi.getState().actions.set(buildModel(), true);
    sceneApi.getState().actions.set(
      {
        connectors: {
          c1: {
            path: {
              tiles: [{ x: 0, y: 0 }],
              rectangle: { from: { x: 0, y: 0 }, to: { x: 6, y: 0 } }
            }
          }
        },
        textBoxes: {}
      },
      true
    );
    uiApi.getState().actions.setEditorMode('EDITABLE');
    uiApi.getState().actions.setView('v1');
  });

  rerender(
    <ThemeProvider theme={theme}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <Capture />
            <ConnectorLabels connectors={connectors} />
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );

  return { modelApi, sceneApi, uiApi };
};

describe('ConnectorLabels single-line semantic', () => {
  it('renders connector label text without automatic whitespace wrapping', () => {
    renderLabels();

    const label = screen.getByText('Fiber Optics');
    expect(window.getComputedStyle(label).whiteSpace).toBe('nowrap');
  });

  it('renders legacy description labels through the same single-line path', () => {
    const { modelApi } = renderLabels();

    act(() => {
      const state = modelApi.getState();
      const views = state.views.map((view) => {
        if (view.id !== 'v1') return view;
        return {
          ...view,
          connectors: (view.connectors ?? []).map((connector) => {
            if (connector.id !== 'c1') return connector;
            const { labels, ...rest } = connector;
            return { ...rest, description: 'Legacy label text' };
          })
        };
      });
      modelApi.getState().actions.set({ views }, true);
    });

    const label = screen.getByText('Legacy label text');
    expect(window.getComputedStyle(label).whiteSpace).toBe('nowrap');
  });
});

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider, useSceneStoreApi } from 'src/stores/sceneStore';
import {
  UiStateProvider,
  useUiStateStoreApi
} from 'src/stores/uiStateStore';
import { useView } from '../useView';
import { Model } from 'src/types';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <ModelProvider>
      <SceneProvider>
        <UiStateProvider>{children}</UiStateProvider>
      </SceneProvider>
    </ModelProvider>
  );
};

const buildModel = (): Model => {
  return {
    title: 'Snapshot',
    version: '1.0',
    icons: [],
    colors: [],
    items: [],
    views: [
      {
        id: 'v1',
        name: 'Main',
        items: [],
        textBoxes: [{ id: 'tb1', tile: { x: 0, y: 0 }, content: 'abc' }]
      }
    ]
  };
};

describe('useView.changeView text box snapshot', () => {
  const realCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    // Canvas always measures 777px here so a resolved snapshot (123.456)
    // is unambiguously distinguishable from a fresh measurement.
    jest
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string, ...rest: unknown[]) => {
        if (tagName === 'canvas') {
          return {
            getContext: () => {
              return {
                font: '',
                measureText: () => {
                  return { width: 777 };
                }
              };
            },
            remove: () => {}
          } as unknown as HTMLCanvasElement;
        }
        return (realCreateElement as (...args: unknown[]) => Element)(
          tagName,
          ...rest
        );
      }) as typeof document.createElement);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setup = () => {
    const hook = renderHook(
      () => {
        return {
          view: useView(),
          modelApi: useModelStoreApi(),
          sceneApi: useSceneStoreApi(),
          uiApi: useUiStateStoreApi()
        };
      },
      { wrapper }
    );
    const api = hook.result.current;
    act(() => {
      api.modelApi.getState().actions.set(buildModel(), true);
    });
    return api;
  };

  it('measures text boxes independently when no snapshot is given', () => {
    const api = setup();

    act(() => {
      api.view.changeView(
        'v1',
        api.modelApi.getState() as unknown as Model
      );
    });

    const size = api.sceneApi.getState().textBoxes['tb1']?.size;
    // (777 canvas + 3 x 0.5628 letter-spacing + 40 padding) / 100 - 0.8
    expect(size?.width).toBeCloseTo((777 + 3 * 0.5628 + 40) / 100 - 0.8, 8);
    expect(api.uiApi.getState().view).toBe('v1');
  });

  it('reuses resolved editor geometry instead of re-measuring', () => {
    const api = setup();
    const snapshot = { tb1: { width: 123.456, height: 1 } };

    act(() => {
      api.view.changeView(
        'v1',
        api.modelApi.getState() as unknown as Model,
        snapshot
      );
    });

    // Exact snapshot values: no canvas measurement took place.
    expect(api.sceneApi.getState().textBoxes['tb1']?.size).toEqual({
      width: 123.456,
      height: 1
    });
    expect(api.uiApi.getState().view).toBe('v1');
  });

  it('ignores snapshot entries for text boxes not placed in the view', () => {
    const api = setup();

    act(() => {
      api.view.changeView(
        'v1',
        api.modelApi.getState() as unknown as Model,
        {
          tb1: { width: 123.456, height: 1 },
          ghost: { width: 1, height: 1 }
        }
      );
    });

    const textBoxes = api.sceneApi.getState().textBoxes;
    expect(textBoxes['tb1']?.size).toEqual({ width: 123.456, height: 1 });
    expect(textBoxes['ghost']).toBeUndefined();
  });

  it('does not touch the model store', () => {
    const api = setup();
    const before = JSON.stringify({
      items: api.modelApi.getState().items,
      views: api.modelApi.getState().views
    });

    act(() => {
      api.view.changeView(
        'v1',
        api.modelApi.getState() as unknown as Model,
        { tb1: { width: 1, height: 1 } }
      );
    });

    expect(
      JSON.stringify({
        items: api.modelApi.getState().items,
        views: api.modelApi.getState().views
      })
    ).toBe(before);
    expect(api.modelApi.getState().actions.canUndo()).toBe(false);
  });
});

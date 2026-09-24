import React from 'react';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { useInteractionManager } from '../useInteractionManager';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import {
  UiStateProvider,
  useUiStateStoreApi
} from 'src/stores/uiStateStore';

const wrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <ModelProvider>
      <SceneProvider>
        <UiStateProvider>{children}</UiStateProvider>
      </SceneProvider>
    </ModelProvider>
  );
};

const setup = () => {
  const { result } = renderHook(
    () => {
      useInteractionManager();
      return useUiStateStoreApi();
    },
    { wrapper }
  );

  act(() => {
    result.current.getState().actions.setEditorMode('EDITABLE');
  });

  return result.current;
};

describe('add-item hotkeys', () => {
  it('N arms new-item placement', () => {
    const uiApi = setup();

    act(() => {
      fireEvent.keyDown(document.body, { key: 'n' });
    });

    const state = uiApi.getState();
    expect(state.mode.type).toBe('PLACE_ICON');
    expect(state.itemControls).toEqual({ type: 'ADD_ITEM' });
    expect(state.isExistingItemPickerOpen).toBe(false);
  });

  it('Shift+N opens the existing-item picker without arming placement', () => {
    const uiApi = setup();

    act(() => {
      fireEvent.keyDown(document.body, { key: 'N', shiftKey: true });
    });

    const state = uiApi.getState();
    expect(state.isExistingItemPickerOpen).toBe(true);
    expect(state.mode.type).not.toBe('PLACE_ICON');
    expect(state.itemControls).toBeNull();
  });

  it('no shortcut fires while typing into an input', () => {
    const uiApi = setup();
    render(<input data-testid="typing" />, { wrapper });

    const input = screen.getByTestId('typing');
    act(() => {
      fireEvent.keyDown(input, { key: 'n' });
      fireEvent.keyDown(input, { key: 'N', shiftKey: true });
    });

    const state = uiApi.getState();
    expect(state.mode.type).not.toBe('PLACE_ICON');
    expect(state.isExistingItemPickerOpen).toBe(false);
    expect(state.itemControls).toBeNull();
  });
});

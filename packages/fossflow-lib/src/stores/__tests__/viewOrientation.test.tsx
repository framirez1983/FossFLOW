import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { UiStateProvider, useUiStateStoreApi } from '../uiStateStore';
import { getTilePosition } from 'src/utils/renderer';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UiStateProvider>{children}</UiStateProvider>
);

test('rotation preserves zoom and the fractional model point at viewport center', () => {
  const { result } = renderHook(() => useUiStateStoreApi(), { wrapper });
  const center = { x: 3.25, y: -5.5 };
  const zoom = 0.4;
  const p = getTilePosition({ tile: center });
  act(() => {
    result.current.getState().actions.setZoom(zoom);
    result.current
      .getState()
      .actions.setScroll({
        position: { x: -p.x * zoom, y: -p.y * zoom },
        offset: { x: 0, y: 0 }
      });
  });
  expect(result.current.getState().viewOrientation).toBe('NE');
  for (const orientation of ['NW', 'SW', 'SE', 'NE'] as const) {
    act(() => result.current.getState().actions.rotateView(true));
    const state = result.current.getState();
    const point = getTilePosition({
      tile: center,
      viewOrientation: orientation
    });
    expect(state.viewOrientation).toBe(orientation);
    expect(state.zoom).toBe(zoom);
    expect(state.scroll.position.x + point.x * zoom).toBeCloseTo(0, 10);
    expect(state.scroll.position.y + point.y * zoom).toBeCloseTo(0, 10);
  }
  act(() => result.current.getState().actions.rotateView(false));
  expect(result.current.getState().viewOrientation).toBe('SE');
});

test('rotation is ignored during a pointer gesture and reset restores NE', () => {
  const { result } = renderHook(() => useUiStateStoreApi(), { wrapper });
  act(() =>
    result.current.setState({
      mouse: {
        position: { screen: { x: 0, y: 0 }, tile: { x: 0, y: 0 } },
        delta: null,
        mousedown: { screen: { x: 0, y: 0 }, tile: { x: 0, y: 0 } }
      }
    })
  );
  act(() => result.current.getState().actions.rotateView(true));
  expect(result.current.getState().viewOrientation).toBe('NE');
  act(() => {
    result.current.setState({
      mouse: { ...result.current.getState().mouse, mousedown: null }
    });
    result.current.getState().actions.rotateView(true);
    result.current.getState().actions.resetUiState();
  });
  expect(result.current.getState().viewOrientation).toBe('NE');
});

test('setViewOrientation sets the orientation directly without rotating', () => {
  const { result } = renderHook(() => useUiStateStoreApi(), { wrapper });
  act(() => {
    result.current.getState().actions.setViewOrientation('SW');
  });
  expect(result.current.getState().viewOrientation).toBe('SW');
  act(() => {
    result.current.getState().actions.setViewOrientation('NE');
  });
  expect(result.current.getState().viewOrientation).toBe('NE');
});

import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import {
  getConnectorPath,
  getIsoProjectionCss,
  getTilePosition
} from 'src/utils/renderer';
import { orientProjected, VIEW_ORIENTATIONS } from 'src/utils/viewOrientation';
import { View } from 'src/types';
import { useIsoProjection } from '../useIsoProjection';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <UiStateProvider>{children}</UiStateProvider>
);
// CSS applies the rightmost matrix first.
const transformPoint = (css: string, point: { x: number; y: number }) => {
  const matrices = [...css.matchAll(/matrix\(([^)]+)\)/g)].map((match) =>
    match[1].split(',').map(Number)
  );
  return matrices
    .reverse()
    .reduce(
      (p, [a, b, c, d, e, f]) => ({
        x: a * p.x + c * p.y + e,
        y: b * p.x + d * p.y + f
      }),
      point
    );
};

test('surface rotation preserves the legacy CSS matrix, origin and routed connector geometry', () => {
  const view: View = {
    id: 'v',
    name: 'v',
    items: [
      { id: 'a', tile: { x: -4, y: 3 } },
      { id: 'b', tile: { x: 6, y: -2 } }
    ]
  };
  const path = getConnectorPath({
    view,
    anchors: [
      { id: 'a1', ref: { item: 'a' } },
      { id: 'b1', ref: { item: 'b' } }
    ]
  });
  const before = JSON.stringify(path);
  const { result } = renderHook(
    () => ({
      projection: useIsoProjection(path.rectangle),
      store: useUiStateStoreApi()
    }),
    { wrapper }
  );
  const baseline = result.current.projection;
  expect(baseline.css.transform).toBe(getIsoProjectionCss());
  expect(baseline.position).toEqual(
    getTilePosition({
      tile: { x: path.rectangle.to.x, y: path.rectangle.from.y },
      origin: 'LEFT'
    })
  );
  for (const orientation of VIEW_ORIENTATIONS) {
    act(() => result.current.store.setState({ viewOrientation: orientation }));
    const rotated = result.current.projection;
    for (const tile of path.tiles) {
      // Existing connector SVG mirror, around the SVG center, remains inside the projected surface.
      const local = {
        x: baseline.pxSize.width - (tile.x * 100 + 50),
        y: tile.y * 100 + 50
      };
      const p = transformPoint(baseline.css.transform!, local);
      const expected = orientProjected(
        { x: p.x + baseline.position.x, y: p.y + baseline.position.y },
        orientation
      );
      const actual = transformPoint(rotated.css.transform!, local);
      expect(actual.x + rotated.position.x).toBeCloseTo(expected.x, 8);
      expect(actual.y + rotated.position.y).toBeCloseTo(expected.y, 8);
    }
    expect(rotated.pxSize).toEqual(baseline.pxSize);
    expect(JSON.stringify(path)).toBe(before);
  }
});

test('upright text keeps its legacy surface angle and rotates only its model attachment', () => {
  const tile = { x: 3, y: -2 };
  const { result } = renderHook(
    () => ({
      projection: useIsoProjection({
        from: tile,
        to: { x: 8, y: -2 },
        orientation: 'Y',
        keepUpright: true
      }),
      store: useUiStateStoreApi()
    }),
    { wrapper }
  );
  const baseline = result.current.projection;
  const baselineCenter = getTilePosition({ tile });
  for (const orientation of VIEW_ORIENTATIONS) {
    act(() => result.current.store.setState({ viewOrientation: orientation }));
    const center = getTilePosition({ tile, viewOrientation: orientation });
    expect(result.current.projection.css.transform).toBe(
      baseline.css.transform
    );
    expect(result.current.projection.position.x - center.x).toBeCloseTo(
      baseline.position.x - baselineCenter.x
    );
    expect(result.current.projection.position.y - center.y).toBeCloseTo(
      baseline.position.y - baselineCenter.y
    );
  }
});

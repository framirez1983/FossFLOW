import { Coords, View } from 'src/types';
import { ViewOrientation } from 'src/types/ui';
import {
  orientTile,
  orientProjected,
  inverseOrientation,
  VIEW_ORIENTATIONS
} from '../viewOrientation';
import {
  getTilePosition,
  screenToIso,
  getMouse,
  getFitToViewParams,
  getProjectBounds,
  getItemAtTile
} from '../renderer';

const expectPoint = (actual: Coords, expected: Coords) => {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
};

const rendererSize = { width: 937, height: 641 };
const scroll = { position: { x: 127, y: -83 }, offset: { x: 0, y: 0 } };
const screenPoint = (
  tile: Coords,
  viewOrientation: ViewOrientation,
  zoom: number
) => {
  const point = getTilePosition({ tile, viewOrientation });
  return {
    x: rendererSize.width / 2 + scroll.position.x + point.x * zoom,
    y: rendererSize.height / 2 + scroll.position.y + point.y * zoom
  };
};

describe('view-only quarter turns', () => {
  test.each([
    ['NE', { x: 2, y: -3 }],
    ['SE', { x: 3, y: 2 }],
    ['SW', { x: -2, y: 3 }],
    ['NW', { x: -3, y: -2 }]
  ] as [ViewOrientation, Coords][])(
    '%s has the documented basis',
    (orientation, expected) => {
      const point = Object.freeze({ x: 2, y: -3 });
      expect(orientTile(point, orientation)).toEqual(expected);
      expectPoint(
        orientTile(
          orientTile(point, orientation),
          inverseOrientation(orientation)
        ),
        point
      );
      expectPoint(
        getTilePosition({ tile: point, viewOrientation: orientation }),
        getTilePosition({ tile: expected })
      );
    }
  );

  test('NE preserves exact legacy point and CSS-origin offsets', () => {
    const tile = { x: 4, y: -7 };
    expect(getTilePosition({ tile })).toEqual({ x: 778.25, y: 122.85 });
    for (const origin of [
      'CENTER',
      'TOP',
      'BOTTOM',
      'LEFT',
      'RIGHT'
    ] as const) {
      expect(getTilePosition({ tile, origin, viewOrientation: 'NE' })).toEqual(
        getTilePosition({ tile, origin })
      );
    }
  });

  test('four projected quarter turns return the original geometry', () => {
    const initial = Object.freeze({ x: -275.25, y: 54.125 });
    let point: Coords = initial;
    for (let i = 0; i < 4; i++) point = orientProjected(point, 'NE');
    expectPoint(point, initial);
  });

  test.each(VIEW_ORIENTATIONS)(
    '%s inverse preserves snapped model coordinates, zoom and pan',
    (viewOrientation) => {
      for (const zoom of [0.1, 0.5, 1]) {
        for (const tile of [
          { x: -7, y: 3 },
          { x: 4, y: -9 },
          { x: 0, y: 0 }
        ]) {
          const mouse = screenPoint(tile, viewOrientation, zoom);
          expectPoint(
            screenToIso({ mouse, zoom, scroll, rendererSize, viewOrientation }),
            tile
          );
        }
        // Both sides of a tile boundary, including negative coordinates.
        for (const x of [-2.501, -2.499, 0.499, 0.501]) {
          const tile = { x, y: 3.1 };
          const legacy = screenToIso({
            mouse: screenPoint(tile, 'NE', zoom),
            zoom,
            scroll,
            rendererSize
          });
          expectPoint(
            screenToIso({
              mouse: screenPoint(tile, viewOrientation, zoom),
              zoom,
              scroll,
              rendererSize,
              viewOrientation
            }),
            legacy
          );
        }
      }
    }
  );

  test.each(VIEW_ORIENTATIONS)(
    '%s pointer delta is in model space',
    (viewOrientation) => {
      const zoom = 0.5;
      const from = { x: -2, y: 4 };
      const to = { x: -1, y: 3 };
      const position = {
        tile: from,
        screen: screenPoint(from, viewOrientation, zoom)
      };
      const screen = screenPoint(to, viewOrientation, zoom);
      const element = document.createElement('div');
      element.getBoundingClientRect = () => ({ left: 30, top: 60 }) as DOMRect;
      const mouse = getMouse({
        interactiveElement: element,
        zoom,
        scroll,
        rendererSize,
        viewOrientation,
        lastMouse: { position, delta: null, mousedown: position },
        mouseEvent: {
          type: 'mousemove',
          clientX: screen.x + 30,
          clientY: screen.y + 60
        } as Parameters<typeof getMouse>[0]['mouseEvent']
      });
      expectPoint(mouse.position.tile, to);
      expectPoint(mouse.delta!.tile, { x: 1, y: -1 });
      expect(mouse.mousedown).toEqual(position);
    }
  );

  test.each(VIEW_ORIENTATIONS)(
    '%s projected inverse preserves fractional viewport center',
    (orientation) => {
      const center = { x: 1.25, y: -8.75 };
      const initial = getTilePosition({ tile: center });
      const rotated = orientProjected(initial, orientation);
      expectPoint(
        orientProjected(rotated, inverseOrientation(orientation)),
        initial
      );
      expectPoint(
        rotated,
        getTilePosition({ tile: center, viewOrientation: orientation })
      );
    }
  );

  test.each(VIEW_ORIENTATIONS)(
    '%s fit contains model bounds without mutating the view',
    (orientation) => {
      const view: View = {
        id: 'test',
        name: 'test',
        items: [
          { id: 'a', tile: { x: -12, y: 2 } },
          { id: 'b', tile: { x: 8, y: 4 } }
        ]
      };
      const before = JSON.stringify(view);
      const fit = getFitToViewParams(view, rendererSize, orientation);
      for (const corner of getProjectBounds(view)) {
        const p = getTilePosition({
          tile: corner,
          viewOrientation: orientation
        });
        expect(Math.abs(fit.scroll.x + p.x * fit.zoom)).toBeLessThanOrEqual(
          rendererSize.width / 2
        );
        expect(Math.abs(fit.scroll.y + p.y * fit.zoom)).toBeLessThanOrEqual(
          rendererSize.height / 2
        );
      }
      expect(JSON.stringify(view)).toBe(before);
    }
  );
});

test.each(VIEW_ORIENTATIONS)(
  '%s hits the readable text footprint after rotation',
  (viewOrientation) => {
    const tile = { x: 5, y: -3 };
    const scene = {
      viewOrientation,
      items: [],
      connectors: [],
      rectangles: [],
      textBoxes: [
        {
          id: 'text',
          tile,
          content: 'text',
          orientation: 'X',
          size: { width: 4, height: 1 }
        }
      ]
    } as unknown as Parameters<typeof getItemAtTile>[0]['scene'];
    const offset = orientTile(
      { x: 3, y: 0 },
      inverseOrientation(viewOrientation)
    );
    expect(
      getItemAtTile({
        tile: { x: tile.x + offset.x, y: tile.y + offset.y },
        scene
      })
    ).toEqual({ type: 'TEXTBOX', id: 'text' });
    const outside = orientTile(
      { x: 6, y: 0 },
      inverseOrientation(viewOrientation)
    );
    expect(
      getItemAtTile({
        tile: { x: tile.x + outside.x, y: tile.y + outside.y },
        scene
      })
    ).toBeNull();
  }
);

test.each(VIEW_ORIENTATIONS)(
  '%s hits plane-following text after rotation',
  (viewOrientation) => {
    const tile = { x: 5, y: -3 };
    const scene = {
      viewOrientation,
      items: [],
      connectors: [],
      rectangles: [],
      textBoxes: [
        {
          id: 'text',
          tile,
          content: 'text',
          orientation: 'X',
          textOrientation: 'FOLLOW_PLANE',
          size: { width: 4, height: 1 }
        }
      ]
    } as unknown as Parameters<typeof getItemAtTile>[0]['scene'];
    // Follow-plane text rotates with the view, so the in-footprint offset is
    // mapped with the orientation itself (mirror of the upright case).
    // Note: the pre-existing upright test above already covers a text box
    // without textOrientation, proving missing/undefined behaves as SCREEN.
    const offset = orientTile({ x: 3, y: 0 }, viewOrientation);
    expect(
      getItemAtTile({
        tile: { x: tile.x + offset.x, y: tile.y + offset.y },
        scene
      })
    ).toEqual({ type: 'TEXTBOX', id: 'text' });
    const outside = orientTile({ x: 6, y: 0 }, viewOrientation);
    expect(
      getItemAtTile({
        tile: { x: tile.x + outside.x, y: tile.y + outside.y },
        scene
      })
    ).toBeNull();
  }
);

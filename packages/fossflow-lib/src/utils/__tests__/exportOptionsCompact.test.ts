import {
  transformToCompactFormat,
  transformFromCompactFormat
} from '../exportOptions';
import { modelSchema } from 'src/schemas/model';
import type { Model } from 'src/types';

const buildModel = (): Model => {
  return {
    title: 'Opacity round trip',
    version: '1.0',
    icons: [],
    colors: [{ id: 'color1', value: '#a5b8f3' }],
    items: [
      { id: 'n1', name: 'First', icon: 'block', description: 'desc' },
      { id: 'n2', name: 'Second', icon: 'block' }
    ],
    views: [
      {
        id: 'view1',
        name: 'View 1',
        items: [
          { id: 'n1', tile: { x: 1, y: 2 }, labelBackgroundOpacity: 0.4 },
          { id: 'n2', tile: { x: 3, y: 4 } }
        ],
        connectors: [
          {
            id: 'c1',
            anchors: [
              { id: 'a0', ref: { item: 'n1' } },
              { id: 'a1', ref: { item: 'n2' } }
            ],
            labels: [
              {
                id: 'l1',
                text: 'link label',
                position: 50,
                height: 10,
                backgroundOpacity: 0.25
              },
              { id: 'l2', text: 'plain label', position: 75 }
            ]
          }
        ]
      }
    ]
  };
};

describe('compact JSON label opacity round trip', () => {
  it('preserves node-label opacity overrides', () => {
    const compact = transformToCompactFormat(buildModel());
    const restored = transformFromCompactFormat(
      JSON.parse(JSON.stringify(compact))
    );
    const [withOverride, useGlobal] = restored.views[0].items;

    expect(withOverride.labelBackgroundOpacity).toBe(0.4);
    expect(useGlobal.labelBackgroundOpacity).toBeUndefined();
  });

  it('preserves connector-label opacity overrides with their host labels', () => {
    const compact = transformToCompactFormat(buildModel());
    const restored = transformFromCompactFormat(
      JSON.parse(JSON.stringify(compact))
    );
    const labels = restored.views[0].connectors?.[0].labels ?? [];

    expect(labels).toHaveLength(2);
    expect(labels[0].text).toBe('link label');
    expect(labels[0].position).toBe(50);
    expect(labels[0].height).toBe(10);
    expect(labels[0].backgroundOpacity).toBe(0.25);
    expect(labels[1].text).toBe('plain label');
    expect(labels[1].backgroundOpacity).toBeUndefined();
  });

  it('restored model still validates against the full model schema', () => {
    const compact = transformToCompactFormat(buildModel());
    const restored = transformFromCompactFormat(
      JSON.parse(JSON.stringify(compact))
    );

    expect(modelSchema.safeParse(restored).success).toBe(true);
  });

  it('does not persist any global label opacity in compact JSON', () => {
    const compact = transformToCompactFormat(buildModel());
    const raw = JSON.stringify(compact);

    expect(raw).not.toContain('labelBackgroundOpacity');
    expect(raw).not.toContain('backgroundOpacity');
    expect((compact as Record<string, unknown>).labelBackgroundOpacity).toBeUndefined();
  });

  it('existing compact JSON without opacity slots still imports as Use global', () => {
    const legacyCompact = {
      t: 'Legacy',
      i: [
        ['First', 'block', ''],
        ['Second', 'block', '']
      ],
      v: [
        [
          [
            [0, 1, 2],
            [1, 3, 4]
          ],
          [[0, 1]]
        ]
      ],
      _: { f: 'compact', v: '1.0' }
    };

    const restored = transformFromCompactFormat(legacyCompact);

    expect(restored.views[0].items[0].labelBackgroundOpacity).toBeUndefined();
    expect(restored.views[0].items[1].labelBackgroundOpacity).toBeUndefined();
    expect(
      restored.views[0].connectors?.[0].labels
    ).toBeUndefined();
    expect(modelSchema.safeParse(restored).success).toBe(true);
  });
});

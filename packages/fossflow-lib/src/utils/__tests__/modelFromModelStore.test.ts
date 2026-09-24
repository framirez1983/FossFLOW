import { modelFromModelStore } from '../model';
import { ModelStore } from 'src/types';

describe('modelFromModelStore snapshot stripping', () => {
  it('never copies ephemeral export-only keys into saved models', () => {
    const store = {
      version: '1.0',
      title: 'Snapshot',
      description: '',
      labelBackgroundOpacity: 1,
      colors: [],
      icons: [],
      items: [],
      views: [],
      textBoxSizes: { tb1: { width: 3.5, height: 1 } }
    } as unknown as ModelStore;

    const model = modelFromModelStore(store);

    expect(
      (model as Record<string, unknown>).textBoxSizes
    ).toBeUndefined();
    expect(JSON.stringify(model)).not.toContain('textBoxSizes');
  });
});

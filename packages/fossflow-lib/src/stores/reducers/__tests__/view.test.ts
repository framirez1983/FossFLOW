import { view } from '../view';
import { State } from '../types';
import { INITIAL_DATA, INITIAL_SCENE_STATE } from 'src/config';

const buildState = (): State => {
  return {
    model: {
      ...INITIAL_DATA,
      views: [
        { id: 'v1', name: 'First', items: [] },
        { id: 'v2', name: 'Second', items: [] }
      ]
    },
    scene: { ...INITIAL_SCENE_STATE }
  };
};

describe('view reducer UPDATE_VIEW', () => {
  it('renames the targeted view and stamps lastUpdated', () => {
    const newState = view({
      action: 'UPDATE_VIEW',
      payload: { name: 'Renamed' },
      ctx: { viewId: 'v1', state: buildState() }
    });

    expect(
      newState.model.views.find((item) => item.id === 'v1')?.name
    ).toBe('Renamed');
    expect(
      newState.model.views.find((item) => item.id === 'v1')?.lastUpdated
    ).toBeDefined();
  });

  it('leaves other views untouched', () => {
    const newState = view({
      action: 'UPDATE_VIEW',
      payload: { name: 'Renamed' },
      ctx: { viewId: 'v1', state: buildState() }
    });

    expect(
      newState.model.views.find((item) => item.id === 'v2')?.name
    ).toBe('Second');
    expect(newState.model.views).toHaveLength(2);
  });

  it('throws for an unknown view id', () => {
    expect(() =>
      view({
        action: 'UPDATE_VIEW',
        payload: { name: 'Renamed' },
        ctx: { viewId: 'missing', state: buildState() }
      })
    ).toThrow();
  });
});

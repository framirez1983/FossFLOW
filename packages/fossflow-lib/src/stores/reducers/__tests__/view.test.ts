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

describe('view reducer DELETE_VIEW', () => {
  it('refuses to delete the last view', () => {
    const single = buildState();
    single.model.views = [single.model.views[0]];

    expect(() =>
      view({
        action: 'DELETE_VIEW',
        payload: undefined,
        ctx: { viewId: 'v1', state: single }
      })
    ).toThrow('Cannot delete the last view.');
    expect(single.model.views).toHaveLength(1);
  });

  it('deletes a view when others remain', () => {
    const newState = view({
      action: 'DELETE_VIEW',
      payload: undefined,
      ctx: { viewId: 'v1', state: buildState() }
    });

    expect(newState.model.views.map((item) => item.id)).toEqual(['v2']);
  });
});

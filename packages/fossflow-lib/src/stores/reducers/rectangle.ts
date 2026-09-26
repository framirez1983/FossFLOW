import { produce } from 'immer';
import { Rectangle } from 'src/types';
import { getItemByIdOrThrow } from 'src/utils';
import { State, ViewReducerContext } from './types';

/** Fields that define a rectangle's geometry. Locked rectangles refuse these. */
const GEOMETRY_FIELDS = ['from', 'to'] as const;

export const updateRectangle = (
  { id, ...updates }: { id: string } & Partial<Rectangle>,
  { viewId, state }: ViewReducerContext
): State => {
  const view = getItemByIdOrThrow(state.model.views, viewId);

  const newState = produce(state, (draft) => {
    const { rectangles } = draft.model.views[view.index];

    if (!rectangles) return;

    const rectangle = getItemByIdOrThrow(rectangles, id);
    const newRectangle = { ...rectangle.value, ...updates };

    // "Lock position" is a mutation restriction, enforced here at the single
    // chokepoint every geometry write funnels through. Drag, resize anchors,
    // lasso drags and any future path all land in this reducer, so a locked
    // rectangle cannot have its geometry changed by any of them. Non-geometry
    // updates (colour, and the lock itself) still apply.
    if (rectangle.value.locked) {
      GEOMETRY_FIELDS.forEach((field) => {
        if (field in updates) {
          newRectangle[field] = rectangle.value[field];
        }
      });
    }

    rectangles[rectangle.index] = newRectangle;
  });

  return newState;
};

export const toggleRectangleLock = (
  id: string,
  { viewId, state }: ViewReducerContext
): State => {
  const view = getItemByIdOrThrow(state.model.views, viewId);

  const newState = produce(state, (draft) => {
    const { rectangles } = draft.model.views[view.index];

    if (!rectangles) return;

    const rectangle = getItemByIdOrThrow(rectangles, id);
    const newRectangle = { ...rectangle.value, locked: !rectangle.value.locked };
    rectangles[rectangle.index] = newRectangle;
  });

  return newState;
};

export const createRectangle = (
  newRectangle: Rectangle,
  { viewId, state }: ViewReducerContext
): State => {
  const view = getItemByIdOrThrow(state.model.views, viewId);

  const newState = produce(state, (draft) => {
    const { rectangles } = draft.model.views[view.index];

    if (!rectangles) {
      draft.model.views[view.index].rectangles = [newRectangle];
    } else {
      draft.model.views[view.index].rectangles?.unshift(newRectangle);
    }
  });

  return updateRectangle(newRectangle, {
    viewId,
    state: newState
  });
};

export const deleteRectangle = (
  id: string,
  { viewId, state }: ViewReducerContext
): State => {
  const view = getItemByIdOrThrow(state.model.views, viewId);
  const rectangle = getItemByIdOrThrow(view.value.rectangles ?? [], id);

  const newState = produce(state, (draft) => {
    draft.model.views[view.index].rectangles?.splice(rectangle.index, 1);
    // Rectangles don't have scene data - they're only stored in the model
  });

  return newState;
};

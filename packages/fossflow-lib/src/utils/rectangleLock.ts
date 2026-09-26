/**
 * Helpers for the rectangle "Lock position" property.
 *
 * Locking is a *mutation* restriction, not an invisibility rule: a locked
 * rectangle is still hit-tested and still selectable, it just refuses to have
 * its geometry changed. `getItemAtTile` therefore still returns locked
 * rectangles, and placement helpers opt out explicitly.
 */

/** Scene shape needed to resolve a rectangle lock. Structural to avoid cycles. */
type RectangleLockScene = {
  rectangles: Array<{ id: string; locked?: boolean }>;
};

/**
 * Whether the rectangle is locked. Rectangles loaded from legacy diagrams have
 * no `locked` field, so an absent value means unlocked.
 */
export const isRectangleLocked = (
  scene: RectangleLockScene,
  id: string
): boolean => scene.rectangles.find((rectangle) => rectangle.id === id)?.locked === true;

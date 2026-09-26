/**
 * Transient suppression of native browser text/image selection while the canvas
 * is being panned.
 *
 * Panning sweeps the pointer across editor chrome (zoom controls, the compass,
 * the view switcher, the tool palette). Those are non-editable labels, and the
 * browser happily starts a text selection or an image drag while the pointer
 * moves, which looks broken.
 *
 * The guard is deliberately scoped to the panning gesture and applied to the
 * document body so it covers chrome that lives outside the renderer. It is
 * removed on mouseup and on mode exit, so normal selection behaviour returns
 * immediately afterwards.
 *
 * Form fields are explicitly exempted: inputs, textareas and contenteditable
 * regions must stay selectable and editable when the user interacts with them
 * for real.
 */

const PAN_GUARD_CLASS = 'fossflow-panning';
const PAN_GUARD_STYLE_ID = 'fossflow-pan-guard-style';

const CSS = `
body.${PAN_GUARD_CLASS} *:not(input):not(textarea):not(select):not([contenteditable="true"]) {
  user-select: none !important;
  -webkit-user-select: none !important;
}
body.${PAN_GUARD_CLASS} img,
body.${PAN_GUARD_CLASS} svg image {
  -webkit-user-drag: none;
  user-drag: none;
}
`;

const ensureStyle = (): void => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PAN_GUARD_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = PAN_GUARD_STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
};

/** Activate the guard. Safe to call repeatedly within one gesture. */
export const startPanGuard = (): void => {
  if (typeof document === 'undefined') return;
  ensureStyle();
  document.body.classList.add(PAN_GUARD_CLASS);
};

/** Release the guard. Safe to call when it was never started. */
export const stopPanGuard = (): void => {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.remove(PAN_GUARD_CLASS);
};

export const isPanGuardActive = (): boolean => {
  if (typeof document === 'undefined' || !document.body) return false;
  return document.body.classList.contains(PAN_GUARD_CLASS);
};

export { PAN_GUARD_CLASS };

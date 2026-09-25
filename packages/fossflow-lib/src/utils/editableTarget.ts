/**
 * Shared keyboard-focus guard: shortcuts must not fire while the user is
 * typing into an editable control. Mirrors the canvas interaction guard.
 */
export const isEditableEventTarget = (
  target: EventTarget | null
): boolean => {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.contentEditable === 'true' ||
    target.closest('.ql-editor') !== null
  );
};

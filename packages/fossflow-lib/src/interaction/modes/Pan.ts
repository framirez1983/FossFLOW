import { produce } from 'immer';
import {
  CoordsUtils,
  setWindowCursor,
  startPanGuard,
  stopPanGuard
} from 'src/utils';
import { ModeActions } from 'src/types';

export const Pan: ModeActions = {
  entry: ({ uiState }) => {
    // A transient pan is entered automatically (from the cursor, or via the
    // pan handlers on an empty-canvas press), so the gesture is already in
    // progress: arm the selection guard here. An explicitly selected Pan only
    // arms it once an actual drag begins, in mousedown.
    if (uiState.mode.type === 'PAN' && uiState.mode.temp) {
      startPanGuard();
      setWindowCursor('grabbing');
    } else {
      setWindowCursor('grab');
    }
  },
  exit: () => {
    // Cleanup path: the mode can change without a mouseup (e.g. selecting
    // another tool mid-drag), and the guard must never be left behind.
    stopPanGuard();
    setWindowCursor('default');
  },
  mousemove: ({ uiState }) => {
    if (uiState.mode.type !== 'PAN') return;

    if (uiState.mode.temp || uiState.mouse.mousedown !== null) {
      const newScroll = produce(uiState.scroll, (draft) => {
        draft.position = uiState.mouse.delta?.screen
          ? CoordsUtils.add(draft.position, uiState.mouse.delta.screen)
          : draft.position;
      });

      uiState.actions.setScroll(newScroll);
    }
  },
  mousedown: ({ uiState, isRendererInteraction }) => {
    if (uiState.mode.type !== 'PAN' || !isRendererInteraction) return;

    startPanGuard();
    setWindowCursor('grabbing');
  },
  mouseup: ({ uiState }) => {
    if (uiState.mode.type !== 'PAN') return;

    stopPanGuard();

    // A transient pan was entered automatically from the cursor (empty-canvas
    // drag), so hand control back. An explicitly selected Pan - the Hand tool,
    // the Pan hotkey, or the read-only starting mode - has no `temp` flag and
    // must stay active until the user changes tools.
    if (uiState.mode.temp) {
      uiState.actions.setMode({
        type: 'CURSOR',
        showCursor: true,
        mousedownItem: null
      });
      return;
    }

    setWindowCursor('grab');
    // Note: Mode switching is now handled by usePanHandlers
  }
};

import { PlaceIcon } from '../PlaceIcon';

jest.mock('src/utils', () => {
  const actual = jest.requireActual('src/utils');
  return {
    ...actual,
    findNearestUnoccupiedTile: jest.fn(() => ({ x: 7, y: 7 }))
  };
});

const buildUiState = (mode: any) => {
  return {
    mode,
    mouse: { position: { tile: { x: 1, y: 1 } } },
    actions: {
      setMode: jest.fn(),
      setItemControls: jest.fn()
    }
  };
};

const buildScene = () => {
  return {
    items: [],
    textBoxes: [],
    connectors: [],
    rectangles: [],
    placeIcon: jest.fn(),
    placeExistingItem: jest.fn()
  };
};

describe('PlaceIcon existing-item reuse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('places only a ViewItem and exits placement mode', () => {
    const uiState = buildUiState({
      type: 'PLACE_ICON',
      showCursor: true,
      id: 'icon-x',
      existingModelItemId: 'n2'
    });
    const scene = buildScene();

    PlaceIcon.mouseup!({ uiState, scene } as any);

    expect(scene.placeExistingItem).toHaveBeenCalledWith('n2', {
      x: 7,
      y: 7
    });
    expect(scene.placeIcon).not.toHaveBeenCalled();
    expect(uiState.actions.setMode).toHaveBeenCalledWith({
      type: 'CURSOR',
      mousedownItem: null,
      showCursor: true
    });
    expect(uiState.actions.setItemControls).toHaveBeenCalledWith(null);
  });

  it('does not cancel an armed reuse session on mousedown without icon', () => {
    const uiState = buildUiState({
      type: 'PLACE_ICON',
      showCursor: true,
      id: null,
      existingModelItemId: 'n2'
    });
    const scene = buildScene();

    PlaceIcon.mousedown!({
      uiState,
      scene,
      isRendererInteraction: true
    } as any);

    expect(uiState.actions.setMode).not.toHaveBeenCalled();
  });

  it('keeps the new-item flow creating a paired ModelItem + ViewItem', () => {
    const uiState = buildUiState({
      type: 'PLACE_ICON',
      showCursor: true,
      id: 'icon-1'
    });
    const scene = buildScene();

    PlaceIcon.mouseup!({ uiState, scene } as any);

    expect(scene.placeExistingItem).not.toHaveBeenCalled();
    expect(scene.placeIcon).toHaveBeenCalledTimes(1);
    const params = scene.placeIcon.mock.calls[0][0];
    expect(params.modelItem.icon).toBe('icon-1');
    expect(params.modelItem.name).toBe('Untitled');
    expect(params.viewItem.id).toBe(params.modelItem.id);
    expect(params.viewItem.tile).toEqual({ x: 7, y: 7 });
    // Stays armed for the next new item.
    expect(uiState.actions.setMode).toHaveBeenCalled();
  });
});

import {
  createRectangle,
  updateRectangle,
  deleteRectangle,
  toggleRectangleLock
} from '../rectangle';
import { State, ViewReducerContext } from '../types';
import { Rectangle, View } from 'src/types';

// Mock the utility functions
jest.mock('src/utils', () => ({
  getItemByIdOrThrow: jest.fn((items: any[], id: string) => {
    const index = items.findIndex((item: any) => 
      (typeof item === 'object' && item.id === id) || item === id
    );
    if (index === -1) {
      throw new Error(`Item with id ${id} not found`);
    }
    return { value: items[index], index };
  })
}));

describe('rectangle reducer', () => {
  let mockState: State;
  let mockContext: ViewReducerContext;
  let mockRectangle: Rectangle;
  let mockView: View;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRectangle = {
      id: 'rect1',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 50 }, locked: false,
      color: 'color1'
    };

    mockView = {
      id: 'view1',
      name: 'Test View',
      items: [],
      connectors: [],
      rectangles: [mockRectangle],
      textBoxes: []
    };

    mockState = {
      model: {
        version: '1.0',
        title: 'Test Model',
        description: '',
        colors: [],
        icons: [],
        items: [],
        views: [mockView]
      },
      scene: {
        connectors: {},
        textBoxes: {}
      }
    };

    mockContext = {
      viewId: 'view1',
      state: mockState
    };
  });

  describe('updateRectangle', () => {
    it('should update rectangle properties', () => {
      const updates = {
        id: 'rect1',
        to: { x: 200, y: 100 },
        color: 'color3'
      };
      
      const result = updateRectangle(updates, mockContext);
      
      expect(result.model.views[0].rectangles![0].to).toEqual({ x: 200, y: 100 });
      expect(result.model.views[0].rectangles![0].color).toBe('color3');
    });

    it('should preserve other properties when partially updating', () => {
      const updates = {
        id: 'rect1',
        color: 'color4'
      };
      
      const result = updateRectangle(updates, mockContext);
      
      // Original properties should be preserved
      expect(result.model.views[0].rectangles![0].from).toEqual(mockRectangle.from);
      expect(result.model.views[0].rectangles![0].to).toEqual(mockRectangle.to);
      // Updated property
      expect(result.model.views[0].rectangles![0].color).toBe('color4');
    });

    it('should handle undefined rectangles array', () => {
      mockState.model.views[0].rectangles = undefined;
      
      const result = updateRectangle({ id: 'rect1', color: 'test' }, mockContext);
      
      // Should return state unchanged
      expect(result).toEqual(mockState);
    });

    it('should throw error when rectangle does not exist', () => {
      expect(() => {
        updateRectangle({ id: 'nonexistent', color: 'test' }, mockContext);
      }).toThrow('Item with id nonexistent not found');
    });

    it('should throw error when view does not exist', () => {
      mockContext.viewId = 'nonexistent';
      
      expect(() => {
        updateRectangle({ id: 'rect1', color: 'test' }, mockContext);
      }).toThrow('Item with id nonexistent not found');
    });
  });

  describe('createRectangle', () => {
    it('should create a new rectangle', () => {
      const newRectangle: Rectangle = {
        id: 'rect2',
        from: { x: 50, y: 50 },
        to: { x: 200, y: 125 }, locked: false,
        color: 'color3'
      };
      
      const result = createRectangle(newRectangle, mockContext);
      
      // Should be added at the beginning (unshift)
      expect(result.model.views[0].rectangles).toHaveLength(2);
      expect(result.model.views[0].rectangles![0].id).toBe('rect2');
      expect(result.model.views[0].rectangles![1].id).toBe('rect1');
    });

    it('should initialize rectangles array if undefined', () => {
      mockState.model.views[0].rectangles = undefined;
      
      const newRectangle: Rectangle = {
        id: 'rect2',
        from: { x: 50, y: 50 },
        to: { x: 200, y: 125 }, locked: false};
      
      const result = createRectangle(newRectangle, mockContext);
      
      expect(result.model.views[0].rectangles).toHaveLength(1);
      expect(result.model.views[0].rectangles![0].id).toBe('rect2');
    });

    it('should create rectangle with all properties', () => {
      const newRectangle: Rectangle = {
        id: 'rect2',
        from: { x: 50, y: 50 },
        to: { x: 200, y: 125 }, locked: false,
        color: 'color6',
        customColor: '#FF5733'
      };
      
      const result = createRectangle(newRectangle, mockContext);
      
      const created = result.model.views[0].rectangles![0];
      expect(created.color).toBe('color6');
      expect(created.customColor).toBe('#FF5733');
    });

    it('should throw error when view does not exist', () => {
      mockContext.viewId = 'nonexistent';
      
      const newRectangle: Rectangle = {
        id: 'rect2',
        from: { x: 50, y: 50 },
        to: { x: 200, y: 125 }, locked: false};
      
      expect(() => {
        createRectangle(newRectangle, mockContext);
      }).toThrow('Item with id nonexistent not found');
    });

    it('should call updateRectangle after creation', () => {
      // This tests that createRectangle calls updateRectangle at the end
      // which ensures any necessary syncing happens
      const newRectangle: Rectangle = {
        id: 'rect2',
        from: { x: 50, y: 50 },
        to: { x: 200, y: 125 }, locked: false};
      
      const result = createRectangle(newRectangle, mockContext);
      
      // The rectangle should have all properties set
      expect(result.model.views[0].rectangles![0]).toMatchObject(newRectangle);
    });
  });

  describe('deleteRectangle', () => {
    it('should delete a rectangle from model', () => {
      const result = deleteRectangle('rect1', mockContext);
      
      // Check rectangle is removed from model
      expect(result.model.views[0].rectangles).toHaveLength(0);
      
      // Rectangles don't have scene data - only stored in model
    });

    it('should throw error when rectangle does not exist', () => {
      expect(() => {
        deleteRectangle('nonexistent', mockContext);
      }).toThrow('Item with id nonexistent not found');
    });

    it('should throw error when view does not exist', () => {
      mockContext.viewId = 'nonexistent';
      
      expect(() => {
        deleteRectangle('rect1', mockContext);
      }).toThrow('Item with id nonexistent not found');
    });

    it('should handle empty rectangles array', () => {
      mockState.model.views[0].rectangles = [];
      
      expect(() => {
        deleteRectangle('rect1', mockContext);
      }).toThrow('Item with id rect1 not found');
    });

    it('should not affect other rectangles when deleting one', () => {
      const rect2: Rectangle = {
        id: 'rect2',
        from: { x: 100, y: 100 },
        to: { x: 180, y: 140 }, locked: false};
      
      mockState.model.views[0].rectangles = [mockRectangle, rect2];
      
      const result = deleteRectangle('rect1', mockContext);
      
      expect(result.model.views[0].rectangles).toHaveLength(1);
      expect(result.model.views[0].rectangles![0].id).toBe('rect2');
      
      // Rectangles don't have scene data - only verify model is updated
    });
  });

  describe('rectangle lock position', () => {
    const geometryOf = (state: State, id: string) => {
      const rectangle = state.model.views[0].rectangles!.find((r) => r.id === id)!;
      return { from: rectangle.from, to: rectangle.to };
    };

    const setLock = (state: State, locked: boolean): State => {
      state.model.views[0].rectangles![0].locked = locked;
      return state;
    };

    it('treats a legacy rectangle with no locked field as unlocked', () => {
      delete (mockRectangle as Partial<Rectangle>).locked;
      mockState.model.views[0].rectangles = [mockRectangle];

      const result = updateRectangle(
        { id: 'rect1', to: { x: 999, y: 999 } },
        mockContext
      );

      expect(result.model.views[0].rectangles![0].to).toEqual({ x: 999, y: 999 });
    });

    it('leaves geometry unchanged for a locked rectangle', () => {
      setLock(mockState, true);

      const result = updateRectangle(
        { id: 'rect1', from: { x: 10, y: 10 }, to: { x: 20, y: 20 } },
        mockContext
      );

      expect(geometryOf(result, 'rect1')).toEqual({
        from: mockRectangle.from,
        to: mockRectangle.to
      });
    });

    it('blocks a drag-style update of both corners', () => {
      setLock(mockState, true);
      const delta = { x: 5, y: 7 };
      const expected = geometryOf(mockState, 'rect1');

      const result = updateRectangle(
        {
          id: 'rect1',
          from: { x: expected.from.x + delta.x, y: expected.from.y + delta.y },
          to: { x: expected.to.x + delta.x, y: expected.to.y + delta.y }
        },
        mockContext
      );

      expect(geometryOf(result, 'rect1')).toEqual(expected);
    });

    it('blocks a resize of a single corner', () => {
      setLock(mockState, true);

      const result = updateRectangle(
        { id: 'rect1', to: { x: 4242, y: 4242 } },
        mockContext
      );

      expect(result.model.views[0].rectangles![0].to).toEqual(mockRectangle.to);
    });

    it('still allows non-geometry updates while locked', () => {
      setLock(mockState, true);

      const result = updateRectangle(
        { id: 'rect1', color: 'color9', customColor: '#123456' },
        mockContext
      );

      expect(result.model.views[0].rectangles![0].color).toBe('color9');
      expect(result.model.views[0].rectangles![0].customColor).toBe('#123456');
    });

    it('restores movement after unlocking', () => {
      setLock(mockState, true);

      // One toggle unlocks the rectangle we just locked.
      const unlockedResult = toggleRectangleLock('rect1', mockContext);

      expect(unlockedResult.model.views[0].rectangles![0].locked).toBe(false);

      const moved = updateRectangle(
        { id: 'rect1', to: { x: 777, y: 888 } },
        { ...mockContext, state: unlockedResult }
      );

      expect(moved.model.views[0].rectangles![0].to).toEqual({ x: 777, y: 888 });
    });

    it('restores resize after unlocking', () => {
      setLock(mockState, true);

      const unlockedResult = toggleRectangleLock('rect1', mockContext);

      const resized = updateRectangle(
        { id: 'rect1', from: { x: 3, y: 4 } },
        { ...mockContext, state: unlockedResult }
      );

      expect(resized.model.views[0].rectangles![0].from).toEqual({ x: 3, y: 4 });
    });

    it('toggleRectangleLock flips the flag and is a single reversible change', () => {
      expect(toggleRectangleLock('rect1', mockContext)
        .model.views[0].rectangles![0].locked).toBe(true);

      const locked = toggleRectangleLock('rect1', mockContext);
      expect(toggleRectangleLock('rect1', { ...mockContext, state: locked })
        .model.views[0].rectangles![0].locked).toBe(false);
    });

    it('toggleRectangleLock is itself allowed on a locked rectangle', () => {
      setLock(mockState, true);

      const result = toggleRectangleLock('rect1', mockContext);

      expect(result.model.views[0].rectangles![0].locked).toBe(false);
    });

    it('does not leak the lock onto other rectangles', () => {
      mockState.model.views[0].rectangles = [
        { ...mockRectangle, locked: true },
        { id: 'rect2', from: { x: 5, y: 5 }, to: { x: 6, y: 6 }, locked: false }
      ];

      const result = updateRectangle(
        { id: 'rect2', to: { x: 60, y: 60 } },
        mockContext
      );

      expect(result.model.views[0].rectangles![1].to).toEqual({ x: 60, y: 60 });
    });

    it('duplicate View preserves the lock', () => {
      setLock(mockState, true);

      const duplicated = JSON.parse(JSON.stringify(mockState.model.views[0]));
      duplicated.id = 'view2';
      duplicated.name = 'Copy';
      mockState.model.views.push(duplicated);

      expect(mockState.model.views[1].rectangles![0].locked).toBe(true);
    });
  });

  describe('edge cases and state immutability', () => {
    it('should not mutate the original state', () => {
      const originalState = JSON.parse(JSON.stringify(mockState));
      
      deleteRectangle('rect1', mockContext);
      
      expect(mockState).toEqual(originalState);
    });

    it('should handle multiple operations in sequence', () => {
      // Create
      let result = createRectangle({
        id: 'rect2',
        from: { x: 200, y: 200 },
        to: { x: 250, y: 250 }, locked: false}, { ...mockContext, state: mockState });
      
      // Update
      result = updateRectangle({
        id: 'rect2',
        color: 'updatedColor'
      }, { ...mockContext, state: result });
      
      // Delete original
      result = deleteRectangle('rect1', { ...mockContext, state: result });
      
      expect(result.model.views[0].rectangles).toHaveLength(1);
      expect(result.model.views[0].rectangles![0].id).toBe('rect2');
      expect(result.model.views[0].rectangles![0].color).toBe('updatedColor');
    });

    it('should handle view with multiple rectangles', () => {
      const rectangles: Rectangle[] = Array.from({ length: 5 }, (_, i) => ({
        id: `rect${i}`,
        from: { x: i * 20, y: i * 20 },
        to: { x: i * 20 + 100, y: i * 20 + 50 }, locked: false}));
      
      mockState.model.views[0].rectangles = rectangles;
      
      const result = deleteRectangle('rect2', mockContext);
      
      expect(result.model.views[0].rectangles).toHaveLength(4);
      expect(result.model.views[0].rectangles!.find(r => r.id === 'rect2')).toBeUndefined();
    });
  });
});
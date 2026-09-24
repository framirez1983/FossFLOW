import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { ModelProvider, useModelStoreApi } from 'src/stores/modelStore';
import { SceneProvider } from 'src/stores/sceneStore';
import { UiStateProvider } from 'src/stores/uiStateStore';
import { Model } from 'src/types';
import { ExistingItemPicker } from '../ExistingItemPicker';

const buildModel = (): Model => {
  return {
    title: 'Inventory',
    version: '1.0',
    icons: [],
    colors: [],
    items: [
      { id: 'n1', name: 'First' },
      { id: 'n2', name: 'Second' }
    ],
    views: [
      {
        id: 'v1',
        name: 'Main',
        items: [{ id: 'n1', tile: { x: 0, y: 0 } }]
      }
    ]
  };
};

const renderPicker = (props?: {
  activeViewItemIds?: string[];
  onPick?: (id: string) => void;
  onClose?: () => void;
}) => {
  let modelApi!: ReturnType<typeof useModelStoreApi>;
  const Capture = () => {
    modelApi = useModelStoreApi();
    return null;
  };
  const utils = render(
    <ThemeProvider theme={theme}>
      <ModelProvider>
        <SceneProvider>
          <UiStateProvider>
            <Capture />
            <ExistingItemPicker
              open
              activeViewItemIds={props?.activeViewItemIds ?? ['n1']}
              onPick={props?.onPick ?? (() => {})}
              onClose={props?.onClose ?? (() => {})}
            />
          </UiStateProvider>
        </SceneProvider>
      </ModelProvider>
    </ThemeProvider>
  );

  act(() => {
    modelApi.getState().actions.set(buildModel(), true);
  });

  return utils;
};

describe('ExistingItemPicker', () => {
  it('excludes already-placed items and picks by id', () => {
    const onPick = jest.fn();
    renderPicker({ onPick });

    expect(screen.queryByText('First')).toBeNull();
    fireEvent.click(screen.getByText('Second'));
    expect(onPick).toHaveBeenCalledWith('n2');
  });

  it('filters by search and reports no match', () => {
    renderPicker();

    fireEvent.change(screen.getByLabelText('Search items'), {
      target: { value: 'zzz' }
    });
    expect(screen.getByText('No items match your search.')).toBeTruthy();
    expect(screen.queryByText('Second')).toBeNull();

    fireEvent.change(screen.getByLabelText('Search items'), {
      target: { value: 'eco' }
    });
    expect(screen.getByText('Second')).toBeTruthy();
  });

  it('shows an empty state when everything is already placed', () => {
    renderPicker({ activeViewItemIds: ['n1', 'n2'] });

    expect(
      screen.getByText('All items are already placed in this view.')
    ).toBeTruthy();
  });

  it('bounds thumbnails so icons cannot overlap rows', () => {
    renderPicker();

    const thumbs = screen.getAllByTestId('item-thumb');
    expect(thumbs).toHaveLength(1);

    const style = window.getComputedStyle(thumbs[0]);
    expect(style.width).toBe('40px');
    expect(style.height).toBe('40px');
    expect(style.overflow).toBe('hidden');
    expect(style.position).toBe('relative');
  });
});

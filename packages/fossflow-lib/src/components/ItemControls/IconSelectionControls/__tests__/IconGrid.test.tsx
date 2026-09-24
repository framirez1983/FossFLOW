import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from 'src/styles/theme';
import { Icon as IconI } from 'src/types';
import { IconGrid } from '../IconGrid';

const importedIcon: IconI = {
  id: 'imp1',
  name: 'Imported One',
  url: 'data:image/png;base64,AAA',
  collection: 'imported',
  isIsometric: true
};

const builtinIcon: IconI = {
  id: 'core1',
  name: 'Core Block',
  url: 'http://example.com/block.svg',
  collection: 'isoflow',
  isIsometric: true
};

const renderGrid = (props?: {
  onRenameIcon?: (icon: IconI) => void;
  onDeleteIcon?: (icon: IconI) => void;
  onMouseDown?: (icon: IconI) => void;
}) => {
  return render(
    <ThemeProvider theme={theme}>
      <IconGrid
        icons={[importedIcon, builtinIcon]}
        onRenameIcon={props?.onRenameIcon}
        onDeleteIcon={props?.onDeleteIcon}
        onMouseDown={props?.onMouseDown}
      />
    </ThemeProvider>
  );
};

describe('IconGrid imported management actions', () => {
  it('shows rename/delete on imported tiles but not on built-in tiles', () => {
    renderGrid({ onRenameIcon: () => {}, onDeleteIcon: () => {} });

    expect(
      screen.getByRole('button', { name: 'Rename Imported One' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Delete Imported One' })
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Rename Core Block' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Delete Core Block' })
    ).toBeNull();
  });

  it('shows no actions when management handlers are absent', () => {
    renderGrid({});

    expect(
      screen.queryByRole('button', { name: 'Rename Imported One' })
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Delete Imported One' })
    ).toBeNull();
  });

  it('action clicks do not trigger icon placement handlers', () => {
    const onMouseDown = jest.fn();
    const onDeleteIcon = jest.fn();
    const onRenameIcon = jest.fn();
    renderGrid({ onMouseDown, onDeleteIcon, onRenameIcon });

    const deleteButton = screen.getByRole('button', {
      name: 'Delete Imported One'
    });
    fireEvent.mouseDown(deleteButton);
    expect(onMouseDown).not.toHaveBeenCalled();
    fireEvent.click(deleteButton);
    expect(onDeleteIcon).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'imp1' })
    );

    const renameButton = screen.getByRole('button', {
      name: 'Rename Imported One'
    });
    fireEvent.click(renameButton);
    expect(onRenameIcon).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'imp1' })
    );
    expect(onMouseDown).not.toHaveBeenCalled();
  });
});

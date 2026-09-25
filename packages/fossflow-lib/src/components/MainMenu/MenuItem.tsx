import React from 'react';
import { MenuItem as MuiMenuItem, ListItemIcon, ListItemText as MuiListItemText, Typography } from '@mui/material';

export interface Props {
  onClick?: () => void;
  Icon?: React.ReactNode;
  children: string | React.ReactNode;
  disabled?: boolean;
  shortcut?: string;
}

export const MenuItem = ({
  onClick,
  Icon,
  children,
  disabled = false,
  shortcut
}: Props) => {
  return (
    <MuiMenuItem onClick={onClick} disabled={disabled}>
      <ListItemIcon sx={{ opacity: disabled ? 0.5 : 1 }}>{Icon}</ListItemIcon>
      {shortcut ? (
        <>
          <MuiListItemText sx={{ mr: 2 }}>{children}</MuiListItemText>
          <Typography variant="caption" color="text.secondary">
            {shortcut}
          </Typography>
        </>
      ) : (
        children
      )}
    </MuiMenuItem>
  );
};

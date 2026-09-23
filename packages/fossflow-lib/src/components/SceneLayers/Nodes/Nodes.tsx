import React from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { orientTile } from 'src/utils/viewOrientation';
import { ViewItem } from 'src/types';
import { Node } from './Node/Node';

interface Props {
  nodes: ViewItem[];
}

export const Nodes = ({ nodes }: Props) => {
  const orientation = useUiStateStore(state => state.viewOrientation);
  return (
    <>
      {[...nodes].reverse().map((node) => {
        const tile = orientTile(node.tile, orientation);
        return (
          <Node key={node.id} order={-tile.x - tile.y} node={node} />
        );
      })}
    </>
  );
};

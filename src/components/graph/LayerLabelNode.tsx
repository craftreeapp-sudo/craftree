'use client';

import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

export type LayerLabelData = {
  label: string;
};

function LayerLabelNodeInner({ data }: NodeProps) {
  const d = data as LayerLabelData;
  return (
    <div
      className="pointer-events-none max-w-[220px] select-none text-[12px] leading-snug text-muted-foreground"
      style={{ opacity: 0.4 }}
    >
      {d.label}
    </div>
  );
}

export const LayerLabelNode = memo(LayerLabelNodeInner);
LayerLabelNode.displayName = 'LayerLabelNode';

'use client';

import { useMemo } from 'react';
import { useStore, getBezierPath, Position } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import {
  EXPLORE_LAYOUT_NODE_H,
  EXPLORE_LAYOUT_NODE_W,
} from '@/lib/graph-utils';

const BATCH_MIN = 40;

type Props = {
  edges: Edge[];
  nodes: Node[];
};

/**
 * Un seul path SVG pour les arêtes « dimmed » quand le graphe est très dense (évite N composants TechEdge).
 */
export function BatchedDimEdgesOverlay({ edges, nodes }: Props) {
  const transform = useStore((s) => s.transform);
  const [tx, ty, zoom] = transform;

  const pathD = useMemo(() => {
    if (edges.length < BATCH_MIN) return '';
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const w = EXPLORE_LAYOUT_NODE_W;
    const h = EXPLORE_LAYOUT_NODE_H;
    const parts: string[] = [];
    for (const e of edges) {
      const src = byId.get(e.source);
      const tgt = byId.get(e.target);
      if (!src || !tgt) continue;
      const sourceX = src.position.x + w / 2;
      const sourceY = src.position.y;
      const targetX = tgt.position.x + w / 2;
      const targetY = tgt.position.y + h;
      const [p] = getBezierPath({
        sourceX,
        sourceY,
        sourcePosition: Position.Top,
        targetX,
        targetY,
        targetPosition: Position.Bottom,
      });
      parts.push(p);
    }
    return parts.join(' ');
  }, [edges, nodes]);

  if (!pathD) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[4] overflow-visible"
      aria-hidden
    >
      <svg
        className="absolute left-0 top-0 overflow-visible"
        style={{
          width: '100%',
          height: '100%',
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <path
          d={pathD}
          fill="none"
          stroke="var(--edge-stroke-material, #94a3b8)"
          strokeOpacity={0.12}
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

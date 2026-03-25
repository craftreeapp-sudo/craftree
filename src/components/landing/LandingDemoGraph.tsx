'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TechNode } from '@/components/graph/TechNode';
import { TechEdge } from '@/components/graph/TechEdge';
import {
  EXPLORE_LAYOUT_NODE_H,
  EXPLORE_LAYOUT_NODE_W,
  EXPLORE_NODESEP,
  EXPLORE_RANKSEP,
  getLayoutedElements,
} from '@/lib/graph-utils';
import type { LayoutEdge, LayoutNode } from '@/lib/graph-utils';
import nodesIndex from '@/data/nodes-index.json';
import linksJson from '@/data/links.json';
import type { TechNodeBasic } from '@/lib/types';

const nodeTypes = { tech: TechNode };
const edgeTypes = { tech: TechEdge };

const DEMO_IDS = ['sable', 'verre', 'ampoule'] as const;

function DemoFlowInner() {
  const { fitView } = useReactFlow();
  const [phase, setPhase] = useState(0);

  const { allNodes, allEdges } = useMemo(() => {
    const data = {
      nodes: nodesIndex.nodes.map((n) => ({
        ...n,
        tags: [] as string[],
      })) as TechNodeBasic[],
      links: linksJson.links as unknown[],
    };
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    const layoutNodes: LayoutNode[] = DEMO_IDS.map((id) => {
      const n = byId.get(id)!;
      return {
        id: n.id,
        name: n.name,
        category: n.category,
        type: n.type,
        era: n.era,
      };
    });
    const rawLinks = data.links as LayoutEdge[];
    const layoutEdges: LayoutEdge[] = [
      rawLinks.find(
        (l) => l.source_id === 'sable' && l.target_id === 'verre'
      ),
      rawLinks.find(
        (l) => l.source_id === 'verre' && l.target_id === 'ampoule'
      ),
    ].filter((x): x is LayoutEdge => x != null);
    const le = getLayoutedElements(layoutNodes, layoutEdges, {
      direction: 'TB',
      nodeWidth: EXPLORE_LAYOUT_NODE_W,
      nodeHeight: EXPLORE_LAYOUT_NODE_H,
      ranksep: EXPLORE_RANKSEP,
      nodesep: EXPLORE_NODESEP,
    });
    return { allNodes: le.nodes, allEdges: le.edges };
  }, []);

  useEffect(() => {
    const delays = [400, 800, 1200, 1750, 2300];
    const timers = delays.map((ms, i) =>
      window.setTimeout(() => setPhase(i + 1), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const { nodes, edges } = useMemo(() => {
    if (phase === 0) return { nodes: [], edges: [] };
    const n =
      phase >= 3
        ? allNodes
        : allNodes.slice(0, Math.min(phase, 3));
    let e: typeof allEdges = [];
    if (phase >= 4) e = [allEdges[0]];
    if (phase >= 5) e = allEdges;
    return { nodes: n, edges: e };
  }, [phase, allNodes, allEdges]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const t = window.setTimeout(() => {
      fitView({ padding: 0.35, duration: 350 });
    }, 50);
    return () => clearTimeout(t);
  }, [nodes, edges, fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      panOnDrag={false}
      preventScrolling
      fitView={false}
      className="rounded-2xl border border-[#2A3042] bg-[#0A0E17]/90"
      proOptions={{ hideAttribution: true }}
    >
      <Background color="#2A3042" gap={16} size={1} />
    </ReactFlow>
  );
}

export function LandingDemoGraph() {
  return (
    <div className="h-[min(420px,55vh)] w-full max-w-3xl">
      <ReactFlowProvider>
        <DemoFlowInner />
      </ReactFlowProvider>
    </div>
  );
}

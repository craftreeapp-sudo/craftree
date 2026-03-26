'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useStore,
  type ReactFlowInstance,
  type NodeMouseHandler,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TechNode } from './TechNode';
import { TechEdge } from './TechEdge';
import { decorateNodesAndEdges } from './TechGraph';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import {
  buildTimelineElements,
  LAYOUT_MAX_YEAR,
  LAYOUT_MIN_YEAR,
  TIMELINE_ERA_SEGMENTS,
} from '@/lib/timeline-layout';

const CLICK_DELAY_MS = 280;

const nodeTypes = {
  tech: TechNode,
  eraBand: EraBandNode,
};
const edgeTypes = { tech: TechEdge };

function EraBandNode({
  data,
}: {
  data: { width: number; height: number; color: string };
}) {
  return (
    <div
      className="pointer-events-none rounded-sm"
      style={{
        width: data.width,
        height: data.height,
        backgroundColor: data.color,
        opacity: 0.05,
      }}
    />
  );
}

function TimelineEraLabels({ worldWidth }: { worldWidth: number }) {
  const transform = useStore((s) => s.transform);
  const [tx, , zoom] = transform;
  const span = LAYOUT_MAX_YEAR - LAYOUT_MIN_YEAR;

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-0 z-[5] h-8 overflow-hidden border-b border-border/60 bg-page/95">
      <div
        className="relative h-full"
        style={{
          transform: `translate(${tx}px, 0px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: worldWidth,
        }}
      >
        {TIMELINE_ERA_SEGMENTS.map((seg, i) => {
          const x0 = ((seg.start - LAYOUT_MIN_YEAR) / span) * worldWidth;
          const w = ((seg.end - seg.start) / span) * worldWidth;
          return (
            <span
              key={i}
              className="absolute top-1/2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              style={{
                left: x0 + 8,
                maxWidth: Math.max(40, w - 16),
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={seg.label}
            >
              {seg.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TimelineBottomAxis({ worldWidth }: { worldWidth: number }) {
  const transform = useStore((s) => s.transform);
  const [tx, , zoom] = transform;
  const span = LAYOUT_MAX_YEAR - LAYOUT_MIN_YEAR;

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[5] h-[52px] overflow-hidden border-t border-border/60 bg-page/95">
      <div
        className="relative h-full"
        style={{
          transform: `translate(${tx}px, 0px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: worldWidth,
        }}
      >
        <div
          className="absolute left-0 top-0 h-px w-full bg-border/80"
          style={{ width: worldWidth }}
        />
        <span className="absolute bottom-3 left-3 text-[11px] text-muted-foreground">
          Préhistoire ({LAYOUT_MIN_YEAR})
        </span>
        <span className="absolute bottom-3 right-3 text-[11px] text-muted-foreground">
          Contemporain ({LAYOUT_MAX_YEAR})
        </span>
        {TIMELINE_ERA_SEGMENTS.map((seg, i) => {
          const x0 = ((seg.start - LAYOUT_MIN_YEAR) / span) * worldWidth;
          return (
            <div
              key={i}
              className="absolute bottom-2 top-6 w-px bg-border/50"
              style={{ left: x0 }}
            />
          );
        })}
      </div>
    </div>
  );
}

function TechTimelineInner() {
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centerOnNodeId = useUIStore((s) => s.centerOnNodeId);
  const clearCenterTarget = useUIStore((s) => s.clearCenterTarget);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const selectNode = useUIStore((s) => s.selectNode);
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const activeCategories = useUIStore((s) => s.activeCategories);
  const activeEras = useUIStore((s) => s.activeEras);
  const activeTypes = useUIStore((s) => s.activeTypes);

  const graphNodes = useGraphStore((s) => s.nodes);
  const craftEdges = useGraphStore((s) => s.edges);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [pixelsPerYear, setPixelsPerYear] = useState(0.32);

  const layout = useMemo(
    () => buildTimelineElements(graphNodes, craftEdges, pixelsPerYear),
    [graphNodes, craftEdges, pixelsPerYear]
  );

  const { eraNodes, techNodes, worldWidth, worldHeight } = useMemo(() => {
    const era = layout.nodes.filter((n) => n.type === 'eraBand');
    const tech = layout.nodes.filter((n) => n.type === 'tech');
    return {
      eraNodes: era,
      techNodes: tech,
      worldWidth: layout.worldWidth,
      worldHeight: layout.worldHeight,
    };
  }, [layout]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const { nodes: decoratedTech, edges: decEdges } = decorateNodesAndEdges(
      techNodes,
      layout.edges,
      {
        craftEdges,
        hoveredNodeId,
        neighborhoodRootId: null,
        neighborhoodVisible: null,
        selectedNodeId,
        activeCategories,
        activeEras,
        activeTypes,
        progressiveMaxLayer: null,
        isSidebarOpen: false,
        focusLayoutActive: false,
        imageBustByNodeId,
      }
    );
    setNodes([...eraNodes, ...decoratedTech]);
    setEdges(decEdges);
  }, [
    techNodes,
    layout.edges,
    hoveredNodeId,
    selectedNodeId,
    activeCategories,
    activeEras,
    activeTypes,
    craftEdges,
    eraNodes,
    imageBustByNodeId,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    if (!centerOnNodeId || !reactFlowRef.current) return;
    const instance = reactFlowRef.current;
    instance.fitView({
      nodes: [{ id: centerOnNodeId }],
      duration: 320,
      padding: 0.25,
    });
    clearCenterTarget();
  }, [centerOnNodeId, clearCenterTarget]);

  useEffect(() => {
    requestAnimationFrame(() => {
      reactFlowRef.current?.fitView({ padding: 0.12, duration: 240 });
    });
  }, [pixelsPerYear, layout.worldWidth, layout.worldHeight]);

  const wheelContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wheelContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setPixelsPerYear((z) => {
          const next = z * (e.deltaY > 0 ? 0.94 : 1.06);
          return Math.min(3.5, Math.max(0.05, next));
        });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const scheduleSingleClick = useCallback(
    (nodeId: string) => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        selectNode(nodeId, { center: true });
      }, CLICK_DELAY_MS);
    },
    [selectNode]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type !== 'tech') return;
      scheduleSingleClick(node.id);
    },
    [scheduleSingleClick]
  );

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_, node) => {
    if (node.type === 'tech') setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    closeSidebar();
    setHoveredNodeId(null);
  }, [closeSidebar]);

  return (
    <div
      ref={wheelContainerRef}
      className="relative h-full w-full min-h-[400px]"
    >
      <TimelineEraLabels worldWidth={worldWidth} />
      <TimelineBottomAxis worldWidth={worldWidth} />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        onInit={(instance) => {
          reactFlowRef.current = instance;
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        minZoom={0.08}
        maxZoom={2.5}
        panOnScroll
        zoomOnScroll
        zoomOnPinch
        nodesDraggable={false}
        nodesConnectable={false}
        className="bg-page"
        proOptions={{ hideAttribution: true }}
        translateExtent={[
          [-200, -80],
          [worldWidth + 200, worldHeight + 120],
        ]}
        defaultEdgeOptions={{ type: 'tech' }}
      >
        <Background color="var(--graph-bg-dot)" gap={20} size={1} />
        <Controls
          className="!bottom-14 !m-3 !border-border !bg-surface-elevated/95 !shadow-lg [&>button]:!border-border [&>button]:!bg-surface-elevated [&>button]:!text-foreground [&>button:hover]:!bg-border/50"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}

export function TechTimeline() {
  return (
    <ReactFlowProvider>
      <TechTimelineInner />
    </ReactFlowProvider>
  );
}

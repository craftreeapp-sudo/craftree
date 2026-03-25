'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TechNode } from './TechNode';
import { TechEdge } from './TechEdge';
import type { TechEdgeData } from './TechEdge';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import {
  collectUpstreamDependencyNodeIds,
  computeExplosionLevels,
  EXPLORE_LAYOUT_NODE_H,
  EXPLORE_LAYOUT_NODE_W,
  EXPLORE_NODESEP,
  EXPLORE_RANKSEP,
  getExplosionLayoutedElements,
} from '@/lib/graph-utils';
import { getCategoryColor } from '@/lib/colors';
import type { TechNodeBasic } from '@/lib/types';

const nodeTypes = { tech: TechNode };
const edgeTypes = { tech: TechEdge };

const WAVE_MS = 400;

function ExplosionTreeInner({ rootId }: { rootId: string }) {
  const getNodeById = useGraphStore((s) => s.getNodeById);
  const allNodes = useGraphStore((s) => s.nodes);
  const allEdges = useGraphStore((s) => s.edges);

  const root = getNodeById(rootId);

  const { baseNodes, baseEdges, levelMap, stats } = useMemo(() => {
    const idSetInner = collectUpstreamDependencyNodeIds(rootId, allEdges);
    const layout = getExplosionLayoutedElements(rootId, allNodes, allEdges, {
      direction: 'TB',
      nodeWidth: EXPLORE_LAYOUT_NODE_W,
      nodeHeight: EXPLORE_LAYOUT_NODE_H,
      ranksep: EXPLORE_RANKSEP,
      nodesep: EXPLORE_NODESEP,
    });

    if (!layout) {
      return {
        baseNodes: [] as Node[],
        baseEdges: [] as Edge[],
        levelMap: new Map<string, number>(),
        stats: null as null | {
          totalDeps: number;
          numLevels: number;
          rawMaterials: TechNodeBasic[];
        },
      };
    }

    const levels = computeExplosionLevels(rootId, idSetInner, allEdges);
    let maxL = 0;
    for (const v of levels.values()) {
      if (v > maxL) maxL = v;
    }

    const nodesInTree = allNodes.filter((n) => idSetInner.has(n.id));
    const rawMaterials = nodesInTree.filter((n) => n.type === 'raw_material');

    return {
      baseNodes: layout.nodes,
      baseEdges: layout.edges,
      levelMap: levels,
      stats: {
        totalDeps: Math.max(0, idSetInner.size - 1),
        numLevels: maxL + 1,
        rawMaterials,
      },
    };
  }, [rootId, allNodes, allEdges]);

  const maxWave = useMemo(() => {
    let m = 0;
    for (const v of levelMap.values()) {
      if (v > m) m = v;
    }
    return m;
  }, [levelMap]);

  const [wave, setWave] = useState(-1);

  useEffect(() => {
    setWave(-1);
    const t0 = window.setTimeout(() => setWave(0), 80);
    return () => clearTimeout(t0);
  }, [rootId, baseNodes.length]);

  useEffect(() => {
    if (wave < 0 || wave >= maxWave) return;
    const id = window.setTimeout(() => setWave((w) => w + 1), WAVE_MS);
    return () => clearTimeout(id);
  }, [wave, maxWave]);

  const animatedNodes = useMemo(() => {
    return baseNodes.map((n) => {
      const lv = levelMap.get(n.id) ?? 0;
      const revealed = wave >= lv;
      return {
        ...n,
        data: {
          ...(n.data as object),
          explosionMode: true as const,
          explosionRevealed: revealed,
        },
        style: {
          ...n.style,
        },
      };
    });
  }, [baseNodes, levelMap, wave]);

  const animatedEdges = useMemo(() => {
    return baseEdges.map((e) => {
      const ls = levelMap.get(e.source) ?? 0;
      const lt = levelMap.get(e.target) ?? 0;
      const edgeWave = Math.max(ls, lt);
      const revealed = wave >= edgeWave;
      const data = {
        ...(e.data as TechEdgeData | undefined),
        explosionOpacity: revealed ? 1 : 0,
      };
      return {
        ...e,
        data,
        style: {
          ...e.style,
          transition: 'opacity 0.35s ease',
        },
      };
    });
  }, [baseEdges, levelMap, wave]);

  const [tip, setTip] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.stopPropagation();
      setTip({ id: node.id, x: event.clientX, y: event.clientY });
    },
    []
  );

  const onPaneClick = useCallback(() => setTip(null), []);

  const tipNode = tip ? getNodeById(tip.id) : undefined;

  const detailsById = useNodeDetailsStore((s) => s.byId);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const getNodeDetails = useGraphStore((s) => s.getNodeDetails);

  useEffect(() => {
    if (!tip?.id) return;
    let cancelled = false;
    void getNodeDetails(tip.id).then((d) => {
      if (!cancelled && d) mergeDetail(tip.id, d);
    });
    return () => {
      cancelled = true;
    };
  }, [tip?.id, getNodeDetails, mergeDetail]);

  const tipDescription =
    tipNode && detailsById?.[tipNode.id]?.description;

  if (!root || !stats || baseNodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg text-[#E8ECF4]">Technologie introuvable.</p>
        <Link
          href="/explore"
          className="rounded-lg border border-[#2A3042] bg-[#1A1F2E] px-4 py-2 text-sm text-[#3B82F6] hover:bg-[#2A3042]"
        >
          Retour à l’exploration
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full min-h-[400px]">
      <ReactFlow
        nodes={animatedNodes}
        edges={animatedEdges}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.15}
        maxZoom={1.5}
        className="bg-[#0A0E17]"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#2A3042" gap={16} size={1} />
        <Controls
          className="!m-3 !border-[#2A3042] !bg-[#1A1F2E]/95 !shadow-lg [&>button]:!border-[#2A3042] [&>button]:!bg-[#1A1F2E] [&>button]:!text-[#E8ECF4] [&>button:hover]:!bg-[#2A3042]"
          showInteractive={false}
        />
      </ReactFlow>

      {/* Stats overlay */}
      <div className="pointer-events-none absolute right-3 top-3 z-10 max-w-[min(100%-1.5rem,280px)] rounded-xl border border-[#2A3042]/90 bg-[#0A0E17]/85 p-4 text-sm shadow-xl backdrop-blur-md">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B95A8]">
          Statistiques
        </h3>
        <dl className="pointer-events-auto space-y-2 text-[#E8ECF4]">
          <div className="flex justify-between gap-4">
            <dt className="text-[#8B95A8]">Dépendances (nœuds)</dt>
            <dd className="font-medium tabular-nums">{stats.totalDeps}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#8B95A8]">Niveaux</dt>
            <dd className="font-medium tabular-nums">{stats.numLevels}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#8B95A8]">Matières premières</dt>
            <dd className="font-medium tabular-nums">
              {stats.rawMaterials.length}
            </dd>
          </div>
        </dl>
        {stats.rawMaterials.length > 0 ? (
          <div className="pointer-events-auto mt-4 border-t border-[#2A3042] pt-3">
            <p className="mb-2 text-xs font-medium text-[#8B95A8]">
              Feuilles (matières premières)
            </p>
            <ul className="max-h-36 space-y-1.5 overflow-y-auto">
              {stats.rawMaterials.map((n) => (
                <li key={n.id} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/15"
                    style={{
                      backgroundColor: getCategoryColor(n.category),
                    }}
                  />
                  <span className="truncate text-xs text-[#E8ECF4]">
                    {n.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Tooltip / mini popover */}
      {tip && tipNode ? (
        <div
          className="pointer-events-auto fixed z-[100] w-[min(calc(100vw-2rem),320px)] rounded-xl border border-[#2A3042] bg-[#1A1F2E] p-4 shadow-2xl"
          style={{
            left: Math.min(tip.x, typeof window !== 'undefined' ? window.innerWidth - 340 : tip.x),
            top: Math.min(tip.y + 12, typeof window !== 'undefined' ? window.innerHeight - 200 : tip.y),
          }}
          role="dialog"
        >
          <p className="text-sm font-semibold text-[#E8ECF4]">{tipNode.name}</p>
          <p className="mt-2 line-clamp-6 text-xs leading-relaxed text-[#8B95A8]">
            {tipDescription?.trim()
              ? tipDescription
              : detailsById
                ? 'Pas de description.'
                : 'Chargement…'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/tree/${tipNode.id}`}
              className="inline-flex rounded-lg bg-[#3B82F6]/20 px-3 py-1.5 text-xs font-medium text-[#3B82F6] hover:bg-[#3B82F6]/30"
              onClick={() => setTip(null)}
            >
              Arbre de dépendances de ce nœud
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Provider requis pour fitView si utilisé ailleurs */
export function ExplosionTreeView({ rootId }: { rootId: string }) {
  return (
    <ReactFlowProvider>
      <ExplosionTreeInner rootId={rootId} />
    </ReactFlowProvider>
  );
}

import { create } from 'zustand';
import type { Node, Edge } from '@xyflow/react';
import type {
  TechNodeBasic,
  CraftingLink,
  NodeCategory,
  Era,
  TechNodeType,
  RelationType,
  SeedNode,
  TechNodeDetails,
} from '@/lib/types';
import {
  computeComplexityDepth,
  computeCentrality,
  filterValidCraftingLinks,
  warnOrphanNodes,
  getDepthLayerLayoutedElements,
  EXPLORE_LAYER_HEIGHT,
  EXPLORE_LAYOUT_NODE_H,
  EXPLORE_LAYOUT_NODE_W,
  EXPLORE_NODESEP,
  type DepthLayerMeta,
} from '@/lib/graph-utils';
import { useNodeDetailsStore } from '@/stores/node-details-store';

interface RawNode {
  id: string;
  name: string;
  name_en?: string;
  category: string;
  type: string;
  era: string;
  year_approx?: number | null;
  complexity_depth: number;
  tags?: string[];
  origin?: string;
  image_url?: string;
}

interface RawLink {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  is_optional?: boolean;
  notes?: string;
}

const detailsMemoryCache = new Map<string, TechNodeDetails | null>();

/** Mise à jour légère des données affichées sur les nœuds Flow (sans recalcul dagre). */
function applyVisualPatchToExploreFlowNodes(
  flowNodes: Node[],
  nodeId: string,
  patch: Partial<TechNodeBasic>
): Node[] {
  return flowNodes.map((n) => {
    if (n.id !== nodeId || n.type !== 'tech') return n;
    const d = (n.data ?? {}) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...d };
    if (patch.image_url !== undefined) next.image_url = patch.image_url;
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.tags !== undefined) next.tags = patch.tags;
    if (patch.origin !== undefined) next.origin = patch.origin;
    return { ...n, data: next };
  });
}

function patchNeedsFullLayout(patch: Partial<TechNodeBasic>): boolean {
  return Object.keys(patch).some(
    (k) =>
      !['image_url', 'tags', 'origin', 'name'].includes(k)
  );
}

/** Détails d’un nœud : cache mémoire + GET /api/nodes/[id] (priorité au store hydraté). */
export async function getNodeDetails(id: string): Promise<TechNodeDetails | null> {
  const fromStore = useNodeDetailsStore.getState().byId[id];
  if (fromStore !== undefined) {
    return fromStore;
  }
  if (detailsMemoryCache.has(id)) {
    return detailsMemoryCache.get(id)!;
  }
  try {
    const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`);
    if (!res.ok) {
      detailsMemoryCache.set(id, null);
      return null;
    }
    const json = (await res.json()) as { details?: TechNodeDetails };
    const d = json.details;
    if (!d) {
      detailsMemoryCache.set(id, null);
      return null;
    }
    detailsMemoryCache.set(id, d);
    return d;
  } catch {
    detailsMemoryCache.set(id, null);
    return null;
  }
}

function normalizeNode(raw: RawNode): TechNodeBasic {
  return {
    id: raw.id,
    name: raw.name,
    ...(raw.name_en !== undefined && raw.name_en !== ''
      ? { name_en: raw.name_en }
      : {}),
    category: raw.category as NodeCategory,
    type: raw.type as TechNodeType,
    era: raw.era as Era,
    year_approx: raw.year_approx ?? undefined,
    complexity_depth: raw.complexity_depth,
    tags: raw.tags ?? [],
    origin: raw.origin,
    image_url: raw.image_url,
  };
}

function normalizeLink(raw: RawLink): CraftingLink {
  return {
    id: raw.id,
    source_id: raw.source_id,
    target_id: raw.target_id,
    relation_type: raw.relation_type as RelationType,
    is_optional: raw.is_optional ?? false,
    notes: raw.notes,
  };
}

function nodesToRaw(nodes: TechNodeBasic[]): RawNode[] {
  return nodes.map((n) => ({
    id: n.id,
    name: n.name,
    category: n.category,
    type: n.type,
    era: n.era,
    year_approx: n.year_approx ?? null,
    complexity_depth: n.complexity_depth,
    tags: n.tags ?? [],
    origin: n.origin,
    image_url: n.image_url,
  }));
}

function linksToRaw(links: CraftingLink[]): RawLink[] {
  return links.map((l) => ({
    id: l.id,
    source_id: l.source_id,
    target_id: l.target_id,
    relation_type: l.relation_type,
    is_optional: l.is_optional,
    notes: l.notes,
  }));
}

function buildGraphState(data: { nodes: RawNode[]; links: RawLink[] }) {
  const initialNodes = data.nodes.map(normalizeNode);
  let initialEdges = data.links.map(normalizeLink);
  initialEdges = filterValidCraftingLinks(initialNodes, initialEdges);
  if (typeof window !== 'undefined') {
    warnOrphanNodes(initialNodes, initialEdges);
  }

  const complexityDepthByNodeId = computeComplexityDepth(
    initialNodes,
    initialEdges
  );
  const centralityByNodeId = computeCentrality(initialNodes, initialEdges);

  const nodesWithComputedMetrics = initialNodes.map((n) => ({
    ...n,
    complexity_depth: complexityDepthByNodeId.get(n.id) ?? n.complexity_depth,
  }));

  const metricsByNodeId = new Map(
    nodesWithComputedMetrics.map((n) => [n.id, n])
  );
  const layoutNodes = nodesWithComputedMetrics.map((n) => ({
    id: n.id,
    name: n.name,
    category: n.category,
    type: n.type,
    era: n.era,
    complexity_depth: n.complexity_depth,
  }));
  const layoutEdges = initialEdges.map((e) => ({
    id: e.id,
    source_id: e.source_id,
    target_id: e.target_id,
    relation_type: e.relation_type,
  }));

  const { nodes: exploreFlowNodes, edges: exploreFlowEdges, layerMetas } =
    getDepthLayerLayoutedElements(layoutNodes, layoutEdges, {
      topMargin: 80,
      layerHeight: EXPLORE_LAYER_HEIGHT,
      nodeWidth: EXPLORE_LAYOUT_NODE_W,
      nodeHeight: EXPLORE_LAYOUT_NODE_H,
      nodesep: EXPLORE_NODESEP,
      centralityByNodeId,
      metricsByNodeId,
    });

  return {
    nodes: nodesWithComputedMetrics,
    edges: initialEdges,
    centralityByNodeId,
    complexityDepthByNodeId,
    exploreFlowNodes,
    exploreFlowEdges,
    exploreLayerMetas: layerMetas,
  };
}

const bootstrap = buildGraphState({
  nodes: [],
  links: [],
});

export interface UsageEntry {
  link: CraftingLink;
  product: TechNodeBasic;
}

interface GraphStore {
  nodes: TechNodeBasic[];
  edges: CraftingLink[];
  centralityByNodeId: Map<string, number>;
  complexityDepthByNodeId: Map<string, number>;
  /** Incrémenté à chaque changement d’image pour forcer le reload navigateur. */
  imageBustByNodeId: Record<string, number>;
  /** Layout React Flow vue /explore (une fois au chargement / refresh). */
  exploreFlowNodes: Node[];
  exploreFlowEdges: Edge[];
  exploreLayerMetas: DepthLayerMeta[];
  /** Recalcule profondeurs, centralité et layout explore sans refetch API. */
  setEdgesAndRecompute: (edges: CraftingLink[]) => void;
  /** Ajoute un nœud (après POST /api/nodes) puis recalcule tout le graphe. */
  addNodeAndRecompute: (node: TechNodeBasic) => void;
  /** Met à jour des champs d’un nœud (ex. image_url) et recalcule le layout explore. */
  updateNode: (nodeId: string, patch: Partial<TechNodeBasic>) => void;
  getNodeById: (id: string) => TechNodeBasic | undefined;
  getRecipeForNode: (id: string) => CraftingLink[];
  getUsagesOfNode: (id: string) => UsageEntry[];
  refreshData: () => Promise<void>;
  getNodeDetails: (id: string) => Promise<TechNodeDetails | null>;
  /** Hydratation initiale (SSR Supabase ou refresh client). */
  hydrateFromRaw: (nodes: SeedNode[], links: CraftingLink[]) => void;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  nodes: bootstrap.nodes,
  edges: bootstrap.edges,
  centralityByNodeId: bootstrap.centralityByNodeId,
  complexityDepthByNodeId: bootstrap.complexityDepthByNodeId,
  imageBustByNodeId: {},
  exploreFlowNodes: bootstrap.exploreFlowNodes,
  exploreFlowEdges: bootstrap.exploreFlowEdges,
  exploreLayerMetas: bootstrap.exploreLayerMetas,

  getNodeDetails,

  hydrateFromRaw: (seedNodes, craftingLinks) => {
    const rawNodes: RawNode[] = seedNodes.map((n) => ({
      id: n.id,
      name: n.name,
      name_en: n.name_en,
      category: n.category,
      type: n.type,
      era: n.era,
      year_approx: n.year_approx ?? null,
      complexity_depth: n.complexity_depth,
      tags: n.tags ?? [],
      origin: n.origin,
      image_url: n.image_url,
    }));
    const rawLinks: RawLink[] = craftingLinks.map((l) => ({
      id: l.id,
      source_id: l.source_id,
      target_id: l.target_id,
      relation_type: l.relation_type,
      is_optional: l.is_optional,
      notes: l.notes,
    }));
    detailsMemoryCache.clear();
    const next = buildGraphState({ nodes: rawNodes, links: rawLinks });
    set({
      nodes: next.nodes,
      edges: next.edges,
      centralityByNodeId: next.centralityByNodeId,
      complexityDepthByNodeId: next.complexityDepthByNodeId,
      imageBustByNodeId: {},
      exploreFlowNodes: next.exploreFlowNodes,
      exploreFlowEdges: next.exploreFlowEdges,
      exploreLayerMetas: next.exploreLayerMetas,
    });
    useNodeDetailsStore.getState().hydrateFromSeedNodes(seedNodes);
  },

  setEdgesAndRecompute: (edges) => {
    set((s) => {
      const next = buildGraphState({
        nodes: nodesToRaw(s.nodes),
        links: linksToRaw(edges),
      });
      return {
        edges: next.edges,
        nodes: next.nodes,
        centralityByNodeId: next.centralityByNodeId,
        complexityDepthByNodeId: next.complexityDepthByNodeId,
        exploreFlowNodes: next.exploreFlowNodes,
        exploreFlowEdges: next.exploreFlowEdges,
        exploreLayerMetas: next.exploreLayerMetas,
      };
    });
  },

  addNodeAndRecompute: (node) => {
    set((s) => {
      if (s.nodes.some((n) => n.id === node.id)) return {};
      const nextNodes = [...s.nodes, node];
      const next = buildGraphState({
        nodes: nodesToRaw(nextNodes),
        links: linksToRaw(s.edges),
      });
      return {
        nodes: next.nodes,
        edges: next.edges,
        centralityByNodeId: next.centralityByNodeId,
        complexityDepthByNodeId: next.complexityDepthByNodeId,
        exploreFlowNodes: next.exploreFlowNodes,
        exploreFlowEdges: next.exploreFlowEdges,
        exploreLayerMetas: next.exploreLayerMetas,
      };
    });
  },

  updateNode: (nodeId, patch) => {
    set((s) => {
      if (!s.nodes.some((n) => n.id === nodeId)) return {};
      const nextNodes = s.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...patch } : n
      );
      const nextBust = { ...s.imageBustByNodeId };
      if (patch.image_url !== undefined) {
        nextBust[nodeId] = (nextBust[nodeId] ?? 0) + 1;
      }

      if (!patchNeedsFullLayout(patch)) {
        return {
          nodes: nextNodes,
          imageBustByNodeId: nextBust,
          exploreFlowNodes: applyVisualPatchToExploreFlowNodes(
            s.exploreFlowNodes,
            nodeId,
            patch
          ),
        };
      }

      const next = buildGraphState({
        nodes: nodesToRaw(nextNodes),
        links: linksToRaw(s.edges),
      });
      return {
        nodes: next.nodes,
        edges: next.edges,
        centralityByNodeId: next.centralityByNodeId,
        complexityDepthByNodeId: next.complexityDepthByNodeId,
        imageBustByNodeId: nextBust,
        exploreFlowNodes: next.exploreFlowNodes,
        exploreFlowEdges: next.exploreFlowEdges,
        exploreLayerMetas: next.exploreLayerMetas,
      };
    });
  },

  getNodeById: (id) => get().nodes.find((n) => n.id === id),

  getRecipeForNode: (id) =>
    get().edges.filter((e) => e.target_id === id),

  getUsagesOfNode: (id) => {
    const nodes = get().nodes;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return get()
      .edges.filter((e) => e.source_id === id)
      .map((link) => {
        const product = byId.get(link.target_id);
        return product ? { link, product } : null;
      })
      .filter((x): x is UsageEntry => x !== null);
  },

  refreshData: async () => {
    const [nodesRes, linksRes] = await Promise.all([
      fetch('/api/nodes'),
      fetch('/api/links'),
    ]);
    if (!nodesRes.ok || !linksRes.ok) {
      console.warn('refreshData: API error');
      return;
    }
    const { nodes: rawNodes } = (await nodesRes.json()) as {
      nodes: RawNode[];
    };
    const { links: rawLinks } = (await linksRes.json()) as {
      links: RawLink[];
    };
    detailsMemoryCache.clear();
    const next = buildGraphState({ nodes: rawNodes, links: rawLinks });
    set({
      nodes: next.nodes,
      edges: next.edges,
      centralityByNodeId: next.centralityByNodeId,
      complexityDepthByNodeId: next.complexityDepthByNodeId,
      imageBustByNodeId: {},
      exploreFlowNodes: next.exploreFlowNodes,
      exploreFlowEdges: next.exploreFlowEdges,
      exploreLayerMetas: next.exploreLayerMetas,
    });
    useNodeDetailsStore
      .getState()
      .hydrateFromSeedNodes(rawNodes as unknown as SeedNode[]);
  },
}));

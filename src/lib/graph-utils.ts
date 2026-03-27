/**
 * Utilitaires de graphe CivTree : algorithmes (profondeur, arbres, centralité, chemins)
 * et layout dagre pour React Flow.
 * @see BRIEF.md Section 9
 */

import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { categoryDisplayOrderIndex } from './category-labels';
import type {
  CraftingLink,
  Era,
  NodeCategory,
  RelationType,
  TechNodeBasic,
  TechNodeType,
} from './types';

// ─── Types layout ─────────────────────────────────────────────────────────────

export interface LayoutNode {
  id: string;
  name: string;
  category: string;
  type: string;
  era: string;
}

export interface LayoutEdge {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
}

export interface LayoutOptions {
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  ranksep?: number;
  nodesep?: number;
}

/** Arbre d’intrants (dependency) ou de produits (usage) — @see BRIEF §9.2 / §9.3 */
export interface DependencyTreeNode {
  node: TechNodeBasic;
  children: DependencyTreeNode[];
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  direction: 'TB',
  nodeWidth: 200,
  nodeHeight: 60,
  ranksep: 100,
  nodesep: 50,
};

// ─── Graphes d’adjacence (helpers) ───────────────────────────────────────────

function buildPredecessors(
  nodeIds: Set<string>,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Map<string, string[]> {
  const preds = new Map<string, string[]>();
  for (const id of nodeIds) preds.set(id, []);
  for (const e of edges) {
    if (!nodeIds.has(e.source_id) || !nodeIds.has(e.target_id)) continue;
    const arr = preds.get(e.target_id)!;
    if (!arr.includes(e.source_id)) arr.push(e.source_id);
  }
  return preds;
}

function buildSuccessors(
  nodeIds: Set<string>,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Map<string, string[]> {
  const succs = new Map<string, string[]>();
  for (const id of nodeIds) succs.set(id, []);
  for (const e of edges) {
    if (!nodeIds.has(e.source_id) || !nodeIds.has(e.target_id)) continue;
    const arr = succs.get(e.source_id)!;
    if (!arr.includes(e.target_id)) arr.push(e.target_id);
  }
  return succs;
}

// ─── Données : nettoyage avant profondeur / layout ───────────────────────────

/** Ne garde que les liens dont les deux extrémités existent dans le jeu de nœuds. */
export function filterValidCraftingLinks<
  T extends { source_id: string; target_id: string },
>(nodes: Pick<TechNodeBasic, 'id'>[], links: T[]): T[] {
  const ids = new Set(nodes.map((n) => n.id));
  return links.filter((l) => ids.has(l.source_id) && ids.has(l.target_id));
}

/**
 * Les matières premières n’ont pas d’intrants : on supprime les liens qui pointent
 * vers un nœud `raw_material`.
 */
export function cleanRawMaterialLinks<
  T extends { source_id: string; target_id: string },
>(nodes: Pick<TechNodeBasic, 'id' | 'type'>[], links: T[]): T[] {
  const rawMaterialIds = new Set(
    nodes.filter((n) => n.type === 'raw_material').map((n) => n.id)
  );
  return links.filter((l) => !rawMaterialIds.has(l.target_id));
}

/**
 * Nœud sans lien entrant ni sortant — log uniquement (profondeur 0 par défaut).
 */
export function warnOrphanNodes(
  nodes: Pick<TechNodeBasic, 'id' | 'name'>[],
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): void {
  const hasIn = new Set<string>();
  const hasOut = new Set<string>();
  for (const e of edges) {
    hasIn.add(e.target_id);
    hasOut.add(e.source_id);
  }
  for (const n of nodes) {
    if (!hasIn.has(n.id) && !hasOut.has(n.id)) {
      console.warn(
        `[CivTree] Nœud orphelin (aucun lien entrant ni sortant) : "${n.name}" (${n.id})`
      );
    }
  }
}

// ─── 9.1 Profondeur (complexity_depth) ───────────────────────────────────────

/**
 * Profondeur de transformation pour le layout /explore.
 *
 * - `raw_material` → toujours **0** (couche matières premières uniquement).
 * - Autres nœuds → max(profondeur intrants) + 1 ; **sans intrant** → **1** minimum
 *   (jamais 0 : seules les matières premières sont en couche 0).
 * - Cycle sur un chemin : la branche cyclique contribue comme 0 pour le max.
 */
export function computeComplexityDepth(
  nodes: Pick<TechNodeBasic, 'id' | 'type'>[],
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const inputsOf = new Map<string, string[]>();
  for (const id of ids) inputsOf.set(id, []);
  for (const e of edges) {
    if (!ids.has(e.source_id) || !ids.has(e.target_id)) continue;
    inputsOf.get(e.target_id)!.push(e.source_id);
  }

  const depths = new Map<string, number>();

  function getDepth(nodeId: string, stack: Set<string>): number {
    const self = byId.get(nodeId);
    if (self?.type === 'raw_material') {
      depths.set(nodeId, 0);
      return 0;
    }

    const cached = depths.get(nodeId);
    if (cached !== undefined) return cached;
    if (stack.has(nodeId)) return 0;

    const inputs = inputsOf.get(nodeId) ?? [];
    if (inputs.length === 0) {
      depths.set(nodeId, 1);
      return 1;
    }

    stack.add(nodeId);
    let maxInputDepth = 0;
    for (const inputId of inputs) {
      if (!ids.has(inputId)) continue;
      const inputDepth = getDepth(inputId, stack);
      maxInputDepth = Math.max(maxInputDepth, inputDepth);
    }
    stack.delete(nodeId);

    const depth = maxInputDepth + 1;
    depths.set(nodeId, depth);
    return depth;
  }

  for (const node of nodes) {
    getDepth(node.id, new Set());
  }

  return depths;
}

// ─── 9.2 / 9.3 Arbres dépendance & usage ─────────────────────────────────────

function buildTreeRecursive(
  id: string,
  byId: Map<string, TechNodeBasic>,
  nextIds: (nodeId: string) => string[],
  maxDepth: number | undefined,
  depth: number,
  path: Set<string>
): DependencyTreeNode | null {
  if (maxDepth !== undefined && depth > maxDepth) return null;
  const node = byId.get(id);
  if (!node) return null;

  if (path.has(id)) {
    return { node, children: [] };
  }

  path.add(id);
  const children: DependencyTreeNode[] = [];
  for (const cid of nextIds(id)) {
    const sub = buildTreeRecursive(
      cid,
      byId,
      nextIds,
      maxDepth,
      depth + 1,
      path
    );
    if (sub) children.push(sub);
  }
  path.delete(id);

  return { node, children };
}

/**
 * Intrants récursifs (produit ← matières). Détection de cycle par chemin courant.
 */
export function getDependencyTree(
  nodeId: string,
  nodes: TechNodeBasic[],
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[],
  maxDepth?: number
): DependencyTreeNode | null {
  const ids = new Set(nodes.map((n) => n.id));
  const preds = buildPredecessors(ids, edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return buildTreeRecursive(
    nodeId,
    byId,
    (id) => preds.get(id) ?? [],
    maxDepth,
    0,
    new Set()
  );
}

/**
 * Tout ce qu’on peut fabriquer à partir d’un nœud (aval). Même structure.
 */
export function getUsageTree(
  nodeId: string,
  nodes: TechNodeBasic[],
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[],
  maxDepth?: number
): DependencyTreeNode | null {
  const ids = new Set(nodes.map((n) => n.id));
  const succs = buildSuccessors(ids, edges);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return buildTreeRecursive(
    nodeId,
    byId,
    (id) => succs.get(id) ?? [],
    maxDepth,
    0,
    new Set()
  );
}

// ─── 9.4 Centralité (nombre de nœuds en aval) ─────────────────────────────────

/**
 * Pour chaque nœud : nombre de nœuds distincts atteignables en suivant les arêtes
 * source → target (produits qui dépendent transitivement de ce nœud). Le nœud
 * source lui-même n’est pas compté.
 */
export function computeCentrality(
  nodes: Pick<TechNodeBasic, 'id'>[],
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const forward = buildSuccessors(ids, edges);
  const result = new Map<string, number>();

  for (const n of nodes) {
    const reachable = new Set<string>();
    const stack = [...(forward.get(n.id) ?? [])];
    while (stack.length) {
      const u = stack.pop()!;
      if (reachable.has(u)) continue;
      reachable.add(u);
      for (const v of forward.get(u) ?? []) {
        if (!reachable.has(v)) stack.push(v);
      }
    }
    result.set(n.id, reachable.size);
  }

  return result;
}

// ─── 9.5 Plus court chemin (BFS) ─────────────────────────────────────────────

/**
 * Plus court chemin dirigé de `fromId` à `toId` (nombre d’arêtes minimal).
 */
export function findCraftingPath(
  fromId: string,
  toId: string,
  nodes: Pick<TechNodeBasic, 'id'>[],
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): string[] {
  const ids = new Set(nodes.map((n) => n.id));
  if (!ids.has(fromId) || !ids.has(toId)) return [];

  const forward = buildSuccessors(ids, edges);
  const queue: string[] = [fromId];
  const prev = new Map<string, string | null>();
  prev.set(fromId, null);

  while (queue.length) {
    const u = queue.shift()!;
    if (u === toId) break;
    for (const v of forward.get(u) ?? []) {
      if (!prev.has(v)) {
        prev.set(v, u);
        queue.push(v);
      }
    }
  }

  if (!prev.has(toId)) return [];

  const path: string[] = [];
  let cur: string | null = toId;
  while (cur !== null) {
    path.push(cur);
    cur = prev.get(cur) ?? null;
  }
  return path.reverse();
}

// ─── Layout dagre ────────────────────────────────────────────────────────────

export interface LayoutElementsOptions extends LayoutOptions {
  /** Centralité → largeur/hauteur dagre + `centralityNorm` dans les data */
  centralityByNodeId?: Map<string, number>;
  /** Métadonnées store (ex. complexity_depth à jour) */
  metricsByNodeId?: Map<string, TechNodeBasic>;
}

/**
 * Calcule les positions des nœuds avec dagre en layout hiérarchique.
 * Les edges source→target représentent le flux : intrant → produit
 */
export function getLayoutedElements(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutElementsOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const {
    nodeWidth: baseNodeWidth,
    nodeHeight: baseNodeHeight,
    ranksep,
    nodesep,
    direction,
    centralityByNodeId,
    metricsByNodeId,
  } = opts;
  const isHorizontal = direction === 'LR';

  let maxCent = 0;
  if (centralityByNodeId && centralityByNodeId.size > 0) {
    for (const v of centralityByNodeId.values()) {
      if (v > maxCent) maxCent = v;
    }
  }

  const sizeForNode = (id: string) => {
    const c = centralityByNodeId?.get(id) ?? 0;
    const norm = maxCent > 0 ? c / maxCent : 0;
    const w = baseNodeWidth + norm * 52;
    const h = baseNodeHeight + norm * 18;
    return { width: w, height: h, centralityNorm: norm };
  };

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep,
    nodesep,
    marginx: 50,
    marginy: 50,
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  nodes.forEach((node) => {
    const { width, height } = sizeForNode(node.id);
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    if (nodeMap.has(edge.source_id) && nodeMap.has(edge.target_id)) {
      dagreGraph.setEdge(edge.source_id, edge.target_id);
    }
  });

  dagre.layout(dagreGraph);

  const layoutedNodes: Node[] = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const { width, height, centralityNorm } = sizeForNode(node.id);
    const stored = metricsByNodeId?.get(node.id);

    return {
      id: node.id,
      type: 'tech',
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
      data: {
        name: node.name,
        category: node.category as NodeCategory,
        era: node.era as Era,
        type: node.type as TechNodeType,
        complexity_depth: stored?.complexity_depth ?? 0,
        centralityNorm,
      },
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
    };
  });

  const sourceCategoryMap = new Map(nodes.map((n) => [n.id, n.category]));
  const targetCategoryMap = new Map(nodes.map((n) => [n.id, n.category]));

  const layoutedEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    type: 'tech',
    data: {
      relationType: edge.relation_type as RelationType,
      sourceCategory: sourceCategoryMap.get(edge.source_id) as
        | NodeCategory
        | undefined,
      targetCategory: targetCategoryMap.get(edge.target_id) as
        | NodeCategory
        | undefined,
    },
  }));

  return { nodes: layoutedNodes, edges: layoutedEdges };
}

// ─── Layout Tree : couches horizontales par profondeur (vue /explore) ───────

/** Boîte de layout dagre / placement (carte 150×220 + marge ~20 px). */
export const EXPLORE_LAYOUT_NODE_W = 170;
export const EXPLORE_LAYOUT_NODE_H = 240;
export const EXPLORE_NODESEP = 25;
/** Écart vertical entre deux couches (entre boîtes 240 px de haut). */
export const EXPLORE_LAYER_MIN_GAP_Y = 60;
/** Distance entre centres de deux rangées (H + gap) — layout manuel historique. */
export const EXPLORE_RANKSEP = EXPLORE_LAYOUT_NODE_H + EXPLORE_LAYER_MIN_GAP_Y;
/**
 * Marge entre le bord de la carte et la zone colorée « couche » (haut + bas).
 * Hauteur d’une bande = {@link EXPLORE_LAYOUT_NODE_H} + 2 × cette valeur.
 */
export const EXPLORE_LAYER_EDGE_PAD_Y = 30;
/** Distance entre centres de deux rangées = hauteur carte + marges (bandes adjacentes sans chevauchement). */
export const EXPLORE_LAYER_HEIGHT =
  EXPLORE_LAYOUT_NODE_H + 2 * EXPLORE_LAYER_EDGE_PAD_Y;
/** Écart horizontal minimal entre deux boîtes après placement (bord à bord). */
export const EXPLORE_LAYER_MIN_GAP_X = 24;

/** Dimensions visuelles des cartes (TechNode). */
export const EXPLORE_CARD_W = 150;
export const EXPLORE_CARD_H = 220;

/** Nœud avec profondeur pour placement en bandes */
export interface DepthLayoutNode extends LayoutNode {
  complexity_depth: number;
}

export interface DepthLayerMeta {
  depth: number;
  yCenter: number;
  yTop: number;
  yBottom: number;
}

function layerIndexForNode(
  n: DepthLayoutNode,
  metricsByNodeId?: Map<string, TechNodeBasic>
): number {
  return metricsByNodeId?.get(n.id)?.complexity_depth ?? n.complexity_depth;
}

/**
 * Vue /explore : Y imposé par la profondeur (plus long chemin depuis une racine sans intrant),
 * X optimisé par dagre puis anti-chevauchement par couche. Matières premières en bas.
 */
export function getDepthLayerLayoutedElements(
  nodes: DepthLayoutNode[],
  edges: LayoutEdge[],
  options: LayoutElementsOptions & {
    ranksep?: number;
    nodesep?: number;
    topMargin?: number;
    /** Écart vertical entre deux couches (défaut {@link EXPLORE_LAYER_HEIGHT}). */
    layerHeight?: number;
  }
): { nodes: Node[]; edges: Edge[]; layerMetas: DepthLayerMeta[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const nodesep = opts.nodesep ?? EXPLORE_NODESEP;
  const layerHeight =
    (options as { layerHeight?: number }).layerHeight ?? EXPLORE_LAYER_HEIGHT;
  const topMargin = (options as { topMargin?: number }).topMargin ?? 60;
  const baseNodeWidth = opts.nodeWidth;
  const baseNodeHeight = opts.nodeHeight;
  const { centralityByNodeId, metricsByNodeId } = options;
  const GRID = 20;
  const LAYOUT_W = baseNodeWidth;
  const LAYOUT_H = baseNodeHeight;
  const ANTI_OVERLAP_MAX_PASSES = 48;

  let maxCent = 0;
  if (centralityByNodeId && centralityByNodeId.size > 0) {
    for (const v of centralityByNodeId.values()) {
      if (v > maxCent) maxCent = v;
    }
  }

  const sizeForNode = (id: string) => {
    const c = centralityByNodeId?.get(id) ?? 0;
    const norm = maxCent > 0 ? c / maxCent : 0;
    return { width: LAYOUT_W, height: LAYOUT_H, centralityNorm: norm };
  };

  if (nodes.length === 0) {
    return { nodes: [], edges: [], layerMetas: [] };
  }

  const depths = [
    ...new Set(nodes.map((n) => layerIndexForNode(n, metricsByNodeId))),
  ].sort((a, b) => a - b);
  const maxDepth = Math.max(...depths);

  const positions = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: 'TB',
    nodesep,
    ranksep: 100,
    marginx: 80,
    marginy: 50,
  });

  for (const n of nodes) {
    dagreGraph.setNode(n.id, { width: LAYOUT_W, height: LAYOUT_H });
  }
  for (const edge of edges) {
    if (nodeMap.has(edge.source_id) && nodeMap.has(edge.target_id)) {
      /** Produit au-dessus de l’intrant : arête target → source pour le rang dagre. */
      dagreGraph.setEdge(edge.target_id, edge.source_id);
    }
  }
  dagre.layout(dagreGraph);

  for (const d of depths) {
    const rowNodes = nodes
      .filter((n) => layerIndexForNode(n, metricsByNodeId) === d)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    if (rowNodes.length === 0) continue;

    const yCenter = topMargin + (maxDepth - d) * layerHeight;
    const rowY = Math.round((yCenter - LAYOUT_H / 2) / GRID) * GRID;

    for (const n of rowNodes) {
      const dg = dagreGraph.node(n.id);
      const rawX = dg ? dg.x - LAYOUT_W / 2 : -LAYOUT_W / 2;
      const x = Math.round(rawX / GRID) * GRID;
      positions.set(n.id, {
        x,
        y: rowY,
        width: LAYOUT_W,
        height: LAYOUT_H,
      });
    }

    const rowIds = rowNodes.map((n) => n.id);
    for (let pass = 0; pass < ANTI_OVERLAP_MAX_PASSES; pass++) {
      const sortedByX = [...rowIds].sort((a, b) => {
        const pa = positions.get(a)!;
        const pb = positions.get(b)!;
        return pa.x - pb.x;
      });
      let changed = false;
      for (let i = 1; i < sortedByX.length; i++) {
        const prevId = sortedByX[i - 1]!;
        const curId = sortedByX[i]!;
        const prev = positions.get(prevId)!;
        const cur = positions.get(curId)!;
        const minLeft = prev.x + prev.width + EXPLORE_LAYER_MIN_GAP_X;
        if (cur.x + 1e-6 < minLeft) {
          positions.set(curId, { ...cur, x: minLeft });
          changed = true;
        }
      }
      if (!changed) break;
    }

    let minRowX = Infinity;
    let maxRowX = -Infinity;
    for (const id of rowIds) {
      const p = positions.get(id)!;
      minRowX = Math.min(minRowX, p.x);
      maxRowX = Math.max(maxRowX, p.x + p.width);
    }
    if (Number.isFinite(minRowX) && Number.isFinite(maxRowX)) {
      const shift = -(minRowX + maxRowX) / 2;
      for (const id of rowIds) {
        const p = positions.get(id)!;
        positions.set(id, { ...p, x: Math.round(p.x + shift) });
      }
    }
    for (let pass = 0; pass < ANTI_OVERLAP_MAX_PASSES; pass++) {
      const sortedByX = [...rowIds].sort((a, b) => {
        const pa = positions.get(a)!;
        const pb = positions.get(b)!;
        return pa.x - pb.x;
      });
      let changed = false;
      for (let i = 1; i < sortedByX.length; i++) {
        const prevId = sortedByX[i - 1]!;
        const curId = sortedByX[i]!;
        const prev = positions.get(prevId)!;
        const cur = positions.get(curId)!;
        const minLeft = prev.x + prev.width + EXPLORE_LAYER_MIN_GAP_X;
        if (cur.x + 1e-6 < minLeft) {
          positions.set(curId, { ...cur, x: minLeft });
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  const layerMetas: DepthLayerMeta[] = depths.map((d) => {
    const ns = nodes.filter(
      (n) => layerIndexForNode(n, metricsByNodeId) === d
    );
    let yTop = Infinity;
    let yBottom = -Infinity;
    for (const n of ns) {
      const p = positions.get(n.id);
      if (!p) continue;
      yTop = Math.min(yTop, p.y);
      yBottom = Math.max(yBottom, p.y + p.height);
    }
    if (!Number.isFinite(yTop)) yTop = 0;
    if (!Number.isFinite(yBottom)) yBottom = 0;
    const yCenter = (yTop + yBottom) / 2;
    return { depth: d, yCenter, yTop, yBottom };
  });

  const layoutedNodes: Node[] = nodes.map((node) => {
    const p = positions.get(node.id);
    const stored = metricsByNodeId?.get(node.id);
    const { centralityNorm } = sizeForNode(node.id);
    const layer = layerIndexForNode(node, metricsByNodeId);
    const isRm = stored?.type === 'raw_material';

    const extraData = {
      year_approx: stored?.year_approx,
      image_url: stored?.image_url,
      origin: stored?.origin,
    };

    if (!p) {
      return {
        id: node.id,
        type: 'tech',
        position: { x: 0, y: 0 },
        style: { zIndex: 1 },
        data: {
          name: node.name,
          category: node.category as NodeCategory,
          era: node.era as Era,
          type: node.type as TechNodeType,
          complexity_depth: stored?.complexity_depth ?? 0,
          centralityNorm,
          isRawMaterial: isRm,
          treeLayer: layer,
          ...extraData,
        },
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
      };
    }

    return {
      id: node.id,
      type: 'tech',
      position: { x: p.x, y: p.y },
      style: { zIndex: 1 },
      data: {
        name: node.name,
        category: node.category as NodeCategory,
        era: node.era as Era,
        type: node.type as TechNodeType,
        complexity_depth: stored?.complexity_depth ?? 0,
        centralityNorm,
        isRawMaterial: isRm,
        treeLayer: layer,
        ...extraData,
      },
      sourcePosition: Position.Top,
      targetPosition: Position.Bottom,
    };
  });

  const sourceCategoryMap = new Map(nodes.map((n) => [n.id, n.category]));
  const targetCategoryMap = new Map(nodes.map((n) => [n.id, n.category]));

  const layoutedEdges: Edge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    type: 'tech',
    data: {
      relationType: edge.relation_type as RelationType,
      sourceCategory: sourceCategoryMap.get(edge.source_id) as
        | NodeCategory
        | undefined,
      targetCategory: targetCategoryMap.get(edge.target_id) as
        | NodeCategory
        | undefined,
    },
  }));

  return {
    nodes: layoutedNodes,
    edges: layoutedEdges,
    layerMetas,
  };
}

/** Écart vertical entre la carte centrale et les lignes intrants/produits (vue focalisée /explore). */
export const FOCUS_VERT_GAP = 150;
const FOCUS_H_GAP = 36;
const FOCUS_GRID = 20;

/** Tri gauche → droite : catégorie (@see NODE_CATEGORY_DISPLAY_ORDER), puis id. */
export function sortFocusNeighborIdsByCategory(
  ids: string[],
  getCategory: (id: string) => NodeCategory | undefined
): string[] {
  return [...ids].sort((a, b) => {
    const ia = categoryDisplayOrderIndex(getCategory(a));
    const ib = categoryDisplayOrderIndex(getCategory(b));
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, 'fr');
  });
}

/**
 * Positions flow pour la vue focalisée : sélection au centre, intrants en dessous,
 * produits au-dessus (une ligne chacun).
 */
export function computeExploreFocusPositions(
  selectedId: string,
  preds: string[],
  succs: string[],
  flowCenter: { x: number; y: number },
  options?: {
    getCategory?: (id: string) => NodeCategory | undefined;
  }
): Map<string, { x: number; y: number }> {
  const cx = flowCenter.x;
  const cy = flowCenter.y;
  const out = new Map<string, { x: number; y: number }>();

  const placeRow = (ids: string[], rowCenterY: number) => {
    const N = ids.length;
    if (N === 0) return;
    const totalW = N * EXPLORE_CARD_W + (N - 1) * FOCUS_H_GAP;
    const y = Math.round((rowCenterY - EXPLORE_CARD_H / 2) / FOCUS_GRID) * FOCUS_GRID;
    for (let i = 0; i < N; i++) {
      const id = ids[i]!;
      const left = cx - totalW / 2 + i * (EXPLORE_CARD_W + FOCUS_H_GAP);
      out.set(id, { x: Math.round(left), y });
    }
    for (let pass = 0; pass < 10; pass++) {
      const sorted = [...ids].sort((a, b) => (out.get(a)!.x - out.get(b)!.x));
      let changed = false;
      for (let i = 1; i < sorted.length; i++) {
        const prevId = sorted[i - 1]!;
        const curId = sorted[i]!;
        const prev = out.get(prevId)!;
        const cur = out.get(curId)!;
        const minLeft = prev.x + EXPLORE_CARD_W + EXPLORE_LAYER_MIN_GAP_X;
        if (cur.x + 1e-6 < minLeft) {
          out.set(curId, { ...cur, x: minLeft });
          changed = true;
        }
      }
      if (!changed) break;
    }
  };

  out.set(selectedId, {
    x: Math.round((cx - EXPLORE_CARD_W / 2) / FOCUS_GRID) * FOCUS_GRID,
    y: Math.round((cy - EXPLORE_CARD_H / 2) / FOCUS_GRID) * FOCUS_GRID,
  });

  const getCategory = options?.getCategory;
  const predSorted = getCategory
    ? sortFocusNeighborIdsByCategory(preds, getCategory)
    : [...preds].sort((a, b) => a.localeCompare(b, 'fr'));
  const succSorted = getCategory
    ? sortFocusNeighborIdsByCategory(succs, getCategory)
    : [...succs].sort((a, b) => a.localeCompare(b, 'fr'));

  const predRowCenterY = cy + EXPLORE_CARD_H + FOCUS_VERT_GAP;
  placeRow(predSorted, predRowCenterY);

  const succRowCenterY = cy - EXPLORE_CARD_H - FOCUS_VERT_GAP;
  placeRow(succSorted, succRowCenterY);

  return out;
}

// ─── Vue explosion (arbre de dépendances) — BRIEF §10.4 ─────────────────────

/**
 * Ferme transitive des intrants : tous les nœuds nécessaires pour fabriquer `rootId`.
 */
export function collectUpstreamDependencyNodeIds(
  rootId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Set<string> {
  const set = new Set<string>([rootId]);
  const queue: string[] = [rootId];
  while (queue.length) {
    const targetId = queue.shift()!;
    for (const e of edges) {
      if (e.target_id === targetId && !set.has(e.source_id)) {
        set.add(e.source_id);
        queue.push(e.source_id);
      }
    }
  }
  return set;
}

/**
 * Niveau pour l’animation : 0 = produit racine, +1 à chaque pas vers les intrants
 * (plus long chemin depuis la racine dans le sous-graphe induit).
 */
export function computeExplosionLevels(
  rootId: string,
  nodeIds: Set<string>,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Map<string, number> {
  const level = new Map<string, number>();
  level.set(rootId, 0);
  const rel = edges.filter(
    (e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id)
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const e of rel) {
      const tLv = level.get(e.target_id);
      if (tLv === undefined) continue;
      const next = tLv + 1;
      const cur = level.get(e.source_id);
      if (cur === undefined || next > cur) {
        level.set(e.source_id, next);
        changed = true;
      }
    }
  }
  for (const id of nodeIds) {
    if (!level.has(id)) level.set(id, 0);
  }
  return level;
}

/**
 * Layout dagre TB avec le **produit en haut** et les matières en bas :
 * pour le layout uniquement, les arêtes dagre vont target → source (produit → intrant).
 * Les arêtes React Flow conservent intrant → produit pour l’affichage des liens.
 */
export function getExplosionLayoutedElements(
  rootId: string,
  nodes: TechNodeBasic[],
  edges: CraftingLink[],
  options: Omit<LayoutElementsOptions, 'metricsByNodeId' | 'centralityByNodeId'> = {}
): { nodes: Node[]; edges: Edge[] } | null {
  const idSet = collectUpstreamDependencyNodeIds(rootId, edges);
  if (!idSet.has(rootId)) return null;

  const filteredNodes = nodes.filter((n) => idSet.has(n.id));
  const filteredEdges = edges.filter(
    (e) => idSet.has(e.source_id) && idSet.has(e.target_id)
  );

  if (filteredNodes.length === 0) return null;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const {
    nodeWidth: baseNodeWidth,
    nodeHeight: baseNodeHeight,
    ranksep,
    nodesep,
    direction = 'TB',
  } = opts;
  const isHorizontal = direction === 'LR';

  const layoutNodes: LayoutNode[] = filteredNodes.map((n) => ({
    id: n.id,
    name: n.name,
    category: n.category,
    type: n.type,
    era: n.era,
  }));

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep,
    nodesep,
    marginx: 50,
    marginy: 50,
  });

  layoutNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: baseNodeWidth, height: baseNodeHeight });
  });

  /** Dagre : produit au-dessus de l’intrant → arête target_id → source_id */
  for (const edge of filteredEdges) {
    if (nodeMap.has(edge.source_id) && nodeMap.has(edge.target_id)) {
      dagreGraph.setEdge(edge.target_id, edge.source_id);
    }
  }

  dagre.layout(dagreGraph);

  const layoutedNodes: Node[] = layoutNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      id: node.id,
      type: 'tech',
      position: {
        x: nodeWithPosition.x - baseNodeWidth / 2,
        y: nodeWithPosition.y - baseNodeHeight / 2,
      },
      data: {
        name: node.name,
        category: node.category as NodeCategory,
        era: node.era as Era,
        type: node.type as TechNodeType,
      },
      sourcePosition: isHorizontal ? Position.Right : Position.Top,
      targetPosition: isHorizontal ? Position.Left : Position.Bottom,
    };
  });

  const sourceCategoryMap = new Map(
    layoutNodes.map((n) => [n.id, n.category])
  );

  const layoutedEdges: Edge[] = filteredEdges.map((edge) => ({
    id: edge.id,
    source: edge.source_id,
    target: edge.target_id,
    type: 'tech',
    data: {
      relationType: edge.relation_type as RelationType,
      sourceCategory: sourceCategoryMap.get(edge.source_id) as
        | NodeCategory
        | undefined,
    },
  }));

  return { nodes: layoutedNodes, edges: layoutedEdges };
}

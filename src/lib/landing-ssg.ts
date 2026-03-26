import { getDirectPredecessors } from '@/lib/graph-adjacency';
import type { CraftingLink } from '@/lib/types';

export type LandingIndexNode = {
  id: string;
  name: string;
  type: string;
  complexity_depth: number;
};

export type LandingStats = {
  nodeCount: number;
  linkCount: number;
  maxComplexityDepth: number;
};

export type LandingFeatureHighlight = {
  nodeId: string;
  nodeName: string;
  rawMaterialCount: number;
  transformationLayers: number;
};

/** Tous les intrants transitifs (BFS), sans le nœud de départ. */
function collectAllUpstream(
  nodeId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Set<string> {
  const result = new Set<string>();
  const queue: string[] = [];
  for (const e of edges) {
    if (e.target_id === nodeId && !result.has(e.source_id)) {
      result.add(e.source_id);
      queue.push(e.source_id);
    }
  }
  let qi = 0;
  while (qi < queue.length) {
    const id = queue[qi++]!;
    for (const e of edges) {
      if (e.target_id === id && !result.has(e.source_id)) {
        result.add(e.source_id);
        queue.push(e.source_id);
      }
    }
  }
  return result;
}

function longestUpstreamChain(
  nodeId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[],
  cache: Map<string, number>,
  visiting: Set<string>
): number {
  if (cache.has(nodeId)) return cache.get(nodeId)!;
  if (visiting.has(nodeId)) return 0;
  visiting.add(nodeId);
  const preds = getDirectPredecessors(nodeId, edges);
  let best = 0;
  if (preds.length) {
    best =
      1 +
      Math.max(
        ...preds.map((p) => longestUpstreamChain(p, edges, cache, visiting))
      );
  }
  visiting.delete(nodeId);
  cache.set(nodeId, best);
  return best;
}

function pickHighlightNode(nodes: LandingIndexNode[]): LandingIndexNode {
  const smartphone = nodes.find((n) => n.id === 'smartphone');
  if (smartphone) return smartphone;
  let best = nodes[0]!;
  for (const n of nodes) {
    if (n.complexity_depth > best.complexity_depth) best = n;
  }
  return best;
}

/**
 * Données calculées au build (SSG) à partir de nodes-index + links.
 */
export function computeLandingPageData(
  nodes: LandingIndexNode[],
  links: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): { stats: LandingStats; feature: LandingFeatureHighlight } {
  const nodeCount = nodes.length;
  const linkCount = links.length;
  let maxComplexityDepth = 0;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (n.complexity_depth > maxComplexityDepth) maxComplexityDepth = n.complexity_depth;
  }

  const highlight = pickHighlightNode(nodes);
  const upstream = collectAllUpstream(highlight.id, links);
  let rawMaterialCount = 0;
  for (const id of upstream) {
    const n = byId.get(id);
    if (n?.type === 'raw_material') rawMaterialCount++;
  }

  const cache = new Map<string, number>();
  const visiting = new Set<string>();
  const transformationLayers = longestUpstreamChain(
    highlight.id,
    links,
    cache,
    visiting
  );

  return {
    stats: {
      nodeCount,
      linkCount,
      maxComplexityDepth,
    },
    feature: {
      nodeId: highlight.id,
      nodeName: highlight.name,
      rawMaterialCount,
      transformationLayers,
    },
  };
}

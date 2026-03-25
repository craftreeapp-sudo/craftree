import type { CraftingLink } from './types';

/** Intrans directs : source_id → target_id (intrant → produit) */
export function getDirectPredecessors(
  nodeId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): string[] {
  const set = new Set<string>();
  for (const e of edges) {
    if (e.target_id === nodeId) set.add(e.source_id);
  }
  return [...set];
}

export function getDirectSuccessors(
  nodeId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): string[] {
  const set = new Set<string>();
  for (const e of edges) {
    if (e.source_id === nodeId) set.add(e.target_id);
  }
  return [...set];
}

/** Jusqu'à `depth` pas en remontant les arêtes (intrants) */
export function collectUpstream(
  startId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[],
  depth: number
): Set<string> {
  const result = new Set<string>();
  let frontier = new Set([startId]);
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const e of edges) {
        if (e.target_id === id) {
          next.add(e.source_id);
          result.add(e.source_id);
        }
      }
    }
    frontier = next;
  }
  return result;
}

/** Jusqu'à `depth` pas en descendant les arêtes (produits) */
export function collectDownstream(
  startId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[],
  depth: number
): Set<string> {
  const result = new Set<string>();
  let frontier = new Set([startId]);
  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const e of edges) {
        if (e.source_id === id) {
          next.add(e.target_id);
          result.add(e.target_id);
        }
      }
    }
    frontier = next;
  }
  return result;
}

/**
 * 2 niveaux de voisinage : nœud + intrants/sortants directs + intrants des intrants + produits des produits
 */
export function getTwoHopNeighborhood(
  nodeId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Set<string> {
  const up = collectUpstream(nodeId, edges, 2);
  const down = collectDownstream(nodeId, edges, 2);
  const set = new Set<string>([nodeId, ...up, ...down]);
  return set;
}

/**
 * Voisinage BFS (graphe non orienté) autour de `rootId`, plafonné à `maxNodes`.
 * Utilisé pour la vue détail /explore?node= (~50 nœuds).
 */
export function getBoundedNeighborhood(
  rootId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[],
  maxNodes: number
): Set<string> {
  const ids = new Set<string>([rootId]);
  const queue: string[] = [rootId];
  while (queue.length > 0 && ids.size < maxNodes) {
    const u = queue.shift()!;
    for (const e of edges) {
      if (ids.size >= maxNodes) break;
      if (e.target_id === u && !ids.has(e.source_id)) {
        ids.add(e.source_id);
        queue.push(e.source_id);
      }
      if (ids.size >= maxNodes) break;
      if (e.source_id === u && !ids.has(e.target_id)) {
        ids.add(e.target_id);
        queue.push(e.target_id);
      }
    }
  }
  return ids;
}

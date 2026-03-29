/**
 * Algorithmes de graphe Craftree : profondeur, centralité, chemins, fermeture amont.
 */

import type { CraftingLink, TechNodeBasic } from './types';

// ─── Adjacence ───────────────────────────────────────────────────────────────

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

// ─── Nettoyage ───────────────────────────────────────────────────────────────

/** Ne garde que les liens dont les deux extrémités existent dans le jeu de nœuds. */
export function filterValidCraftingLinks<
  T extends { source_id: string; target_id: string },
>(nodes: Pick<TechNodeBasic, 'id'>[], links: T[]): T[] {
  const ids = new Set(nodes.map((n) => n.id));
  return links.filter((l) => ids.has(l.source_id) && ids.has(l.target_id));
}

/** Nœud sans lien entrant ni sortant — log uniquement. */
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

// ─── Profondeur (complexity_depth) ───────────────────────────────────────────

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

// ─── Centralité ──────────────────────────────────────────────────────────────

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

// ─── Plus court chemin (BFS) ─────────────────────────────────────────────────

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

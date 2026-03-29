import { collectUpstreamDependencyNodeIds } from '@/lib/graph-utils';
import type {
  CraftingLink,
  MaterialLevel,
  NodeDimension,
  TechNodeBasic,
} from '@/lib/types';

export const MATERIAL_COLUMNS: MaterialLevel[] = [
  'raw',
  'processed',
  'industrial',
  'component',
];

/** Nombre d’intrants directs (liens vers ce nœud). */
export function directDependencyCount(
  nodeId: string,
  edges: Pick<CraftingLink, 'target_id'>[]
): number {
  return edges.filter((e) => e.target_id === nodeId).length;
}

/** Nombre de sortants directs (ce nœud comme source). */
export function directDownstreamCount(
  nodeId: string,
  edges: Pick<CraftingLink, 'source_id'>[]
): number {
  return edges.filter((e) => e.source_id === nodeId).length;
}

/** Cartes distinctes nécessaires en amont (hors le nœud racine). */
export function totalUpstreamCardCount(
  rootId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): number {
  const set = collectUpstreamDependencyNodeIds(rootId, edges);
  return Math.max(0, set.size - 1);
}

/**
 * Fermeture transitive des produits en aval : tout ce que `rootId` permet
 * d’atteindre (suivant les arêtes source → target).
 */
export function collectDownstreamProductNodeIds(
  rootId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Set<string> {
  const set = new Set<string>([rootId]);
  const queue: string[] = [rootId];
  while (queue.length) {
    const sourceId = queue.shift()!;
    for (const e of edges) {
      if (e.source_id === sourceId && !set.has(e.target_id)) {
        set.add(e.target_id);
        queue.push(e.target_id);
      }
    }
  }
  return set;
}

/** Cartes distinctes en aval (hors le nœud racine). */
export function totalDownstreamCardCount(
  rootId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): number {
  const set = collectDownstreamProductNodeIds(rootId, edges);
  return Math.max(0, set.size - 1);
}

/**
 * Infère la dimension quand `dimension` est encore null en base.
 */
export function effectiveDimension(n: TechNodeBasic): NodeDimension {
  const d = n.dimension;
  if (d === 'matter' || d === 'process' || d === 'tool') return d;
  if (n.type === 'process') return 'process';
  if (n.type === 'tool') return 'tool';
  return 'matter';
}

/**
 * Colonne matière quand `materialLevel` est null : heuristique via `type`.
 */
export function effectiveMaterialLevel(n: TechNodeBasic): MaterialLevel {
  if (n.dimension === 'matter' && n.materialLevel) return n.materialLevel;
  if (n.type === 'raw_material') return 'raw';
  if (n.type === 'component') return 'component';
  if (n.type === 'material') return 'processed';
  return 'processed';
}

export type BuiltUponBuckets = {
  matters: Record<MaterialLevel, TechNodeBasic[]>;
  process: TechNodeBasic[];
  tools: TechNodeBasic[];
};

const emptyMatters = (): Record<MaterialLevel, TechNodeBasic[]> => ({
  raw: [],
  processed: [],
  industrial: [],
  component: [],
});

/**
 * Intrants directs du nœud `focusId`, classés par dimension puis niveau matière.
 */
export function bucketDirectDependencies(
  focusId: string,
  nodes: TechNodeBasic[],
  edges: CraftingLink[]
): BuiltUponBuckets {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const matters = emptyMatters();
  const process: TechNodeBasic[] = [];
  const tools: TechNodeBasic[] = [];

  const inputs = edges.filter((e) => e.target_id === focusId);
  const seen = new Set<string>();

  for (const e of inputs) {
    const n = byId.get(e.source_id);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    const dim = effectiveDimension(n);
    if (dim === 'matter') {
      const col = effectiveMaterialLevel(n);
      matters[col].push(n);
    } else if (dim === 'process') {
      process.push(n);
    } else {
      tools.push(n);
    }
  }

  const nameCmp = (a: TechNodeBasic, b: TechNodeBasic) =>
    a.name.localeCompare(b.name, 'fr');

  for (const k of MATERIAL_COLUMNS) {
    matters[k].sort(nameCmp);
  }
  process.sort(nameCmp);
  tools.sort(nameCmp);

  return { matters, process, tools };
}

/**
 * Produits directs qui utilisent `focusId` comme intrant (liens source → target).
 */
export function bucketLedToOutputs(
  focusId: string,
  nodes: TechNodeBasic[],
  edges: CraftingLink[]
): BuiltUponBuckets {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const matters = emptyMatters();
  const process: TechNodeBasic[] = [];
  const tools: TechNodeBasic[] = [];

  const outputs = edges.filter((e) => e.source_id === focusId);
  const seen = new Set<string>();

  for (const e of outputs) {
    const n = byId.get(e.target_id);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    const dim = effectiveDimension(n);
    if (dim === 'matter') {
      const col = effectiveMaterialLevel(n);
      matters[col].push(n);
    } else if (dim === 'process') {
      process.push(n);
    } else {
      tools.push(n);
    }
  }

  const nameCmp = (a: TechNodeBasic, b: TechNodeBasic) =>
    a.name.localeCompare(b.name, 'fr');

  for (const k of MATERIAL_COLUMNS) {
    matters[k].sort(nameCmp);
  }
  process.sort(nameCmp);
  tools.sort(nameCmp);

  return { matters, process, tools };
}

import { collectUpstreamDependencyNodeIds } from '@/lib/graph-utils';
import {
  effectiveDimension,
  effectiveMaterialLevel,
} from '@/lib/node-dimension-helpers';
import { normalizeRelationTypeForUi } from '@/lib/relation-display';
import {
  type CraftingLink,
  type MaterialLevel,
  type NodeDimension,
  RelationType,
  type TechNodeBasic,
} from '@/lib/types';

export { effectiveDimension, effectiveMaterialLevel } from '@/lib/node-dimension-helpers';

/** Colonnes affichées sous la box « Matières » (sans la colonne composant, devenue une box à part). */
export const MATTER_GRID_LEVELS = ['raw', 'processed', 'industrial'] as const;
export type MatterGridLevel = (typeof MATTER_GRID_LEVELS)[number];

/** Tous les niveaux matière (données) — `component` alimente la box « Composants », pas la grille Matières. */
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

/**
 * Nombre de cartes en amont distinctes « obtenu à partir de » en lien direct
 * (`!is_optional`) pour ce nœud.
 */
export function directBuiltUponPeerCount(
  nodeId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id' | 'is_optional'>[]
): number {
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.target_id !== nodeId) continue;
    if (e.is_optional) continue;
    seen.add(e.source_id);
  }
  return seen.size;
}

/** Nombre de sortants directs (ce nœud comme source). */
export function directDownstreamCount(
  nodeId: string,
  edges: Pick<CraftingLink, 'source_id'>[]
): number {
  return edges.filter((e) => e.source_id === nodeId).length;
}

/** Prédécesseurs immédiats (intrants directs vers `focusId`). */
export function collectDirectUpstreamIds(
  focusId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Set<string> {
  const s = new Set<string>();
  for (const e of edges) {
    if (e.target_id === focusId) s.add(e.source_id);
  }
  return s;
}

/** Successeurs immédiats (produits directs depuis `focusId`). */
export function collectDirectDownstreamIds(
  focusId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Set<string> {
  const s = new Set<string>();
  for (const e of edges) {
    if (e.source_id === focusId) s.add(e.target_id);
  }
  return s;
}

/**
 * Amont étendu (niveau 2 seulement) : P → B → focusId, P hors intrants directs.
 * Valeur : pour chaque P, ensemble des B intermédiaires (cartes directes).
 */
export function collectExtendedUpstreamPeerInfos(
  focusId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Map<string, Set<string>> {
  const directUp = collectDirectUpstreamIds(focusId, edges);
  const viaMap = new Map<string, Set<string>>();
  for (const b of directUp) {
    for (const e of edges) {
      if (e.target_id !== b) continue;
      const p = e.source_id;
      if (p === focusId) continue;
      if (directUp.has(p)) continue;
      let set = viaMap.get(p);
      if (!set) {
        set = new Set<string>();
        viaMap.set(p, set);
      }
      set.add(b);
    }
  }
  return viaMap;
}

/**
 * Aval étendu (niveau 2 seulement) : focusId → B → S, S hors produits directs.
 */
export function collectExtendedDownstreamPeerInfos(
  focusId: string,
  edges: Pick<CraftingLink, 'source_id' | 'target_id'>[]
): Map<string, Set<string>> {
  const directDown = collectDirectDownstreamIds(focusId, edges);
  const viaMap = new Map<string, Set<string>>();
  for (const b of directDown) {
    for (const e of edges) {
      if (e.source_id !== b) continue;
      const s = e.target_id;
      if (s === focusId) continue;
      if (directDown.has(s)) continue;
      let set = viaMap.get(s);
      if (!set) {
        set = new Set<string>();
        viaMap.set(s, set);
      }
      set.add(b);
    }
  }
  return viaMap;
}

/** Arête orientée exacte `source_id → target_id` (pour cartes « étendu » = 2ᵉ hop). */
export function findLinkByEndpoints(
  edges: CraftingLink[],
  source_id: string,
  target_id: string
): CraftingLink | undefined {
  return edges.find(
    (e) => e.source_id === source_id && e.target_id === target_id
  );
}

export type ExtendedPeerInfo = {
  peerId: string;
  /** Cartes directes qui font le lien (B dans P → B → A ou A → B → S). */
  viaNodeIds: string[];
};

function sortPeerIdsByNodeName(
  ids: string[],
  byId: Map<string, TechNodeBasic>
): string[] {
  return [...ids].sort((a, b) => {
    const na = byId.get(a)?.name ?? a;
    const nb = byId.get(b)?.name ?? b;
    return na.localeCompare(nb, 'fr');
  });
}

export function buildExtendedUpstreamPeerInfos(
  focusId: string,
  edges: CraftingLink[],
  nodes: TechNodeBasic[]
): ExtendedPeerInfo[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const m = collectExtendedUpstreamPeerInfos(focusId, edges);
  const arr: ExtendedPeerInfo[] = [];
  for (const [peerId, vias] of m) {
    arr.push({
      peerId,
      viaNodeIds: sortPeerIdsByNodeName([...vias], byId),
    });
  }
  arr.sort((a, b) => {
    const na = byId.get(a.peerId)?.name ?? a.peerId;
    const nb = byId.get(b.peerId)?.name ?? b.peerId;
    return na.localeCompare(nb, 'fr');
  });
  return arr;
}

export function buildExtendedDownstreamPeerInfos(
  focusId: string,
  edges: CraftingLink[],
  nodes: TechNodeBasic[]
): ExtendedPeerInfo[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const m = collectExtendedDownstreamPeerInfos(focusId, edges);
  const arr: ExtendedPeerInfo[] = [];
  for (const [peerId, vias] of m) {
    arr.push({
      peerId,
      viaNodeIds: sortPeerIdsByNodeName([...vias], byId),
    });
  }
  arr.sort((a, b) => {
    const na = byId.get(a.peerId)?.name ?? a.peerId;
    const nb = byId.get(b.peerId)?.name ?? b.peerId;
    return na.localeCompare(nb, 'fr');
  });
  return arr;
}

function sortBucketsInPlace(b: BuiltUponBuckets): void {
  const nameCmp = (a: TechNodeBasic, b: TechNodeBasic) =>
    a.name.localeCompare(b.name, 'fr');
  for (const k of MATTER_GRID_LEVELS) {
    b.matters[k].sort(nameCmp);
  }
  b.process.sort(nameCmp);
  b.tools.sort(nameCmp);
  b.composants.sort(nameCmp);
  b.energy.sort(nameCmp);
  b.infrastructure.sort(nameCmp);
}

/**
 * Buckets pour les seuls pairs « étendu » (niveau 2) — pas d’arête directe vers la fiche :
 * on garde la classification par dimension du nœud pair.
 */
export function bucketExtendedUpstreamOnly(
  infos: ExtendedPeerInfo[],
  nodes: TechNodeBasic[]
): BuiltUponBuckets {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const matters = emptyMatters();
  const process: TechNodeBasic[] = [];
  const tools: TechNodeBasic[] = [];
  const composants: TechNodeBasic[] = [];
  const energy: TechNodeBasic[] = [];
  const infrastructure: TechNodeBasic[] = [];
  const seen = new Set<string>();

  for (const info of infos) {
    const n = byId.get(info.peerId);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    pushByDimension(n, matters, process, tools, composants, energy, infrastructure);
  }

  const buckets: BuiltUponBuckets = {
    matters,
    process,
    tools,
    composants,
    energy,
    infrastructure,
  };
  sortBucketsInPlace(buckets);
  return buckets;
}

export function bucketExtendedDownstreamOnly(
  infos: ExtendedPeerInfo[],
  nodes: TechNodeBasic[]
): BuiltUponBuckets {
  return bucketExtendedUpstreamOnly(infos, nodes);
}

/** Nombre total de cartes dans les buckets (toutes dimensions). */
export function totalCardsInBuckets(b: BuiltUponBuckets): number {
  let n =
    b.process.length +
    b.tools.length +
    b.composants.length +
    b.energy.length +
    b.infrastructure.length;
  for (const k of MATTER_GRID_LEVELS) {
    n += b.matters[k].length;
  }
  return n;
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

export type BuiltUponBuckets = {
  /** Grille 3 colonnes : brut / transformé / industriel uniquement. */
  matters: Record<MatterGridLevel, TechNodeBasic[]>;
  process: TechNodeBasic[];
  tools: TechNodeBasic[];
  /** Dimension `composant` + matière de niveau `component`. */
  composants: TechNodeBasic[];
  energy: TechNodeBasic[];
  infrastructure: TechNodeBasic[];
};

const emptyMatters = (): Record<MatterGridLevel, TechNodeBasic[]> => ({
  raw: [],
  processed: [],
  industrial: [],
});

/**
 * Colonne brut / transformé / industriel pour un lien `relation_type: material`.
 * `materialLevel` du nœud n’intervient que là ; `component` ou inconnu → transformé.
 */
function matterGridColumnForMaterialLink(n: TechNodeBasic): MatterGridLevel {
  if (effectiveDimension(n) !== 'matter') return 'processed';
  const ml = effectiveMaterialLevel(n);
  if (ml === 'raw' || ml === 'processed' || ml === 'industrial') return ml;
  return 'processed';
}

/**
 * Classement vue arbre pour les liens **directs** avec la fiche : `relation_type`
 * (sauf matière, où seul le niveau matière affine les 3 colonnes).
 */
function pushByLinkRelation(
  n: TechNodeBasic,
  relationType: string,
  matters: Record<MatterGridLevel, TechNodeBasic[]>,
  process: TechNodeBasic[],
  tools: TechNodeBasic[],
  composants: TechNodeBasic[],
  energy: TechNodeBasic[],
  infrastructure: TechNodeBasic[]
): void {
  const rel = normalizeRelationTypeForUi(relationType);
  if (rel === RelationType.MATERIAL) {
    matters[matterGridColumnForMaterialLink(n)].push(n);
    return;
  }
  if (rel === RelationType.COMPONENT) {
    composants.push(n);
    return;
  }
  if (rel === RelationType.TOOL) {
    tools.push(n);
    return;
  }
  if (rel === RelationType.PROCESS) {
    process.push(n);
    return;
  }
  if (rel === RelationType.ENERGY) {
    energy.push(n);
    return;
  }
  if (rel === RelationType.INFRASTRUCTURE) {
    infrastructure.push(n);
    return;
  }
  process.push(n);
}

function pushByDimension(
  n: TechNodeBasic,
  matters: Record<MatterGridLevel, TechNodeBasic[]>,
  process: TechNodeBasic[],
  tools: TechNodeBasic[],
  composants: TechNodeBasic[],
  energy: TechNodeBasic[],
  infrastructure: TechNodeBasic[]
): void {
  const dim: NodeDimension = effectiveDimension(n);
  if (dim === 'matter') {
    const ml = effectiveMaterialLevel(n);
    if (ml === 'component') {
      composants.push(n);
    } else if (ml === 'raw' || ml === 'processed' || ml === 'industrial') {
      matters[ml].push(n);
    } else {
      matters.processed.push(n);
    }
    return;
  }
  if (dim === 'process') {
    process.push(n);
    return;
  }
  if (dim === 'tool') {
    tools.push(n);
    return;
  }
  if (dim === 'composant') {
    composants.push(n);
    return;
  }
  if (dim === 'energy') {
    energy.push(n);
    return;
  }
  if (dim === 'infrastructure') {
    infrastructure.push(n);
    return;
  }
}

/**
 * Intrants directs du nœud `focusId` : `relation_type` du lien (fiche) ;
 * pour `material`, affinage par niveau matière du nœud (3 colonnes).
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
  const composants: TechNodeBasic[] = [];
  const energy: TechNodeBasic[] = [];
  const infrastructure: TechNodeBasic[] = [];

  const inputs = edges.filter((e) => e.target_id === focusId);
  const seen = new Set<string>();

  for (const e of inputs) {
    const n = byId.get(e.source_id);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    pushByLinkRelation(
      n,
      String(e.relation_type),
      matters,
      process,
      tools,
      composants,
      energy,
      infrastructure
    );
  }

  const nameCmp = (a: TechNodeBasic, b: TechNodeBasic) =>
    a.name.localeCompare(b.name, 'fr');

  for (const k of MATTER_GRID_LEVELS) {
    matters[k].sort(nameCmp);
  }
  process.sort(nameCmp);
  tools.sort(nameCmp);
  composants.sort(nameCmp);
  energy.sort(nameCmp);
  infrastructure.sort(nameCmp);

  return { matters, process, tools, composants, energy, infrastructure };
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
  const composants: TechNodeBasic[] = [];
  const energy: TechNodeBasic[] = [];
  const infrastructure: TechNodeBasic[] = [];

  const outputs = edges.filter((e) => e.source_id === focusId);
  const seen = new Set<string>();

  for (const e of outputs) {
    const n = byId.get(e.target_id);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    pushByLinkRelation(
      n,
      String(e.relation_type),
      matters,
      process,
      tools,
      composants,
      energy,
      infrastructure
    );
  }

  const nameCmp = (a: TechNodeBasic, b: TechNodeBasic) =>
    a.name.localeCompare(b.name, 'fr');

  for (const k of MATTER_GRID_LEVELS) {
    matters[k].sort(nameCmp);
  }
  process.sort(nameCmp);
  tools.sort(nameCmp);
  composants.sort(nameCmp);
  energy.sort(nameCmp);
  infrastructure.sort(nameCmp);

  return { matters, process, tools, composants, energy, infrastructure };
}

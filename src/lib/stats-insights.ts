/**
 * Agrégations pour la page Statistiques (graph-utils + store)
 */

import {
  collectUpstreamDependencyNodeIds,
  computeCentrality,
} from '@/lib/graph-utils';
import { isRawMaterialNode } from '@/lib/node-dimension-helpers';
import type { CraftingLink, Era, NodeCategory, TechNodeBasic } from '@/lib/types';
import { Era as EraEnum, NodeCategory as NC } from '@/lib/types';

export interface RawMaterialRank {
  id: string;
  name: string;
  category: NodeCategory;
  score: number;
}

export interface TechComplexityRank {
  id: string;
  name: string;
  category: NodeCategory;
  complexity_depth: number;
}

export interface CategoryCount {
  category: NodeCategory;
  count: number;
}

export interface EraCount {
  era: Era;
  count: number;
}

export interface HighlightInsight {
  nodeId: string;
  name: string;
  rawMaterialCount: number;
  /** Niveaux de dépendance (complexity_depth du modèle) */
  dependencyLevels: number;
  /** Taille de la chaîne amont (hors le nœud racine) */
  upstreamNodeCount: number;
}

const ERA_ORDER: Era[] = [
  EraEnum.PREHISTORIC,
  EraEnum.ANCIENT,
  EraEnum.MEDIEVAL,
  EraEnum.RENAISSANCE,
  EraEnum.INDUSTRIAL,
  EraEnum.MODERN,
  EraEnum.DIGITAL,
  EraEnum.CONTEMPORARY,
];

export function computeStatsInsights(nodes: TechNodeBasic[], edges: CraftingLink[]) {
  const centrality = computeCentrality(nodes, edges);

  const rawMaterials = nodes.filter(isRawMaterialNode);
  const topRaw: RawMaterialRank[] = [...rawMaterials]
    .map((n) => ({
      id: n.id,
      name: n.name,
      category: n.category,
      score: centrality.get(n.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const techNodes = nodes.filter((n) => !isRawMaterialNode(n));
  const topComplex: TechComplexityRank[] = [...techNodes]
    .sort((a, b) => b.complexity_depth - a.complexity_depth)
    .slice(0, 10)
    .map((n) => ({
      id: n.id,
      name: n.name,
      category: n.category,
      complexity_depth: n.complexity_depth,
    }));

  const byCategory = new Map<NodeCategory, number>();
  for (const c of Object.values(NC) as NodeCategory[]) {
    byCategory.set(c, 0);
  }
  for (const n of nodes) {
    byCategory.set(n.category, (byCategory.get(n.category) ?? 0) + 1);
  }
  const categoryRows: CategoryCount[] = (Object.values(NC) as NodeCategory[])
    .map((category) => ({
      category,
      count: byCategory.get(category) ?? 0,
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const byEra = new Map<Era, number>();
  for (const e of ERA_ORDER) byEra.set(e, 0);
  for (const n of nodes) {
    byEra.set(n.era, (byEra.get(n.era) ?? 0) + 1);
  }
  const eraRows: EraCount[] = ERA_ORDER.map((era) => ({
    era,
    count: byEra.get(era) ?? 0,
  }));

  /** Fait marquant : microprocesseur si présent, sinon nœud tech avec profondeur max */
  let highlight: HighlightInsight | null = null;
  const preferredId = 'microprocesseur';
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const candidate =
    byId.get(preferredId) ??
    techNodes.sort((a, b) => b.complexity_depth - a.complexity_depth)[0];

  if (candidate) {
    const upstream = collectUpstreamDependencyNodeIds(candidate.id, edges);
    let rawMaterialCount = 0;
    for (const id of upstream) {
      if (byId.get(id) && isRawMaterialNode(byId.get(id)!)) rawMaterialCount += 1;
    }
    highlight = {
      nodeId: candidate.id,
      name: candidate.name,
      rawMaterialCount,
      dependencyLevels: candidate.complexity_depth,
      upstreamNodeCount: Math.max(0, upstream.size - 1),
    };
  }

  const maxCentRaw = topRaw[0]?.score ?? 1;
  const maxComplex = topComplex[0]?.complexity_depth ?? 1;
  const maxCat = Math.max(1, ...categoryRows.map((r) => r.count));
  const maxEra = Math.max(1, ...eraRows.map((r) => r.count));

  return {
    topRaw,
    maxCentRaw,
    topComplex,
    maxComplex,
    categoryRows,
    totalNodes: nodes.length,
    maxCat,
    eraRows,
    maxEra,
    highlight,
  };
}

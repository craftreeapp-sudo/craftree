import { collectUpstreamDependencyNodeIds } from '@/lib/graph-utils';
import {
  bucketDirectDependencies,
  type BuiltUponBuckets,
} from '@/lib/built-upon-utils';
import { getAllLinks, getAllNodes } from '@/lib/data';
import type {
  CraftingLink,
  Era,
  NodeCategory,
  RelationType,
  SeedNode,
  TechNodeBasic,
  TechNodeType,
} from '@/lib/types';

export type OgLocale = 'fr' | 'en';

export type DirectInputCard = {
  name: string;
  relation_type: RelationType;
};

function seedNodeToTechBasic(n: SeedNode): TechNodeBasic {
  return {
    id: n.id,
    name: n.name,
    name_en: n.name_en,
    category: n.category as NodeCategory,
    type: n.type as TechNodeType,
    era: n.era as Era,
    year_approx:
      n.year_approx === null || n.year_approx === undefined
        ? undefined
        : n.year_approx,
    complexity_depth: n.complexity_depth ?? 0,
    tags: n.tags ?? [],
    origin: n.origin,
    image_url: n.image_url,
    dimension: n.dimension ?? null,
    materialLevel: n.materialLevel ?? null,
    naturalOrigin: n.naturalOrigin ?? null,
    chemicalNature: n.chemicalNature ?? null,
    origin_type: n.origin_type ?? null,
    nature_type: n.nature_type ?? null,
  };
}

function relationSortOrder(r: RelationType): number {
  const order: Record<RelationType, number> = {
    material: 0,
    energy: 1,
    tool: 2,
    knowledge: 3,
    catalyst: 4,
  };
  return order[r] ?? 9;
}

export type OgTreePayload =
  | { kind: 'fallback'; locale: OgLocale }
  | {
      kind: 'recipe';
      id: string;
      name: string;
      year_approx?: number | null;
      origin?: string;
      upstreamCount: number;
      cards: DirectInputCard[];
      locale: OgLocale;
    }
  | {
      kind: 'pyramid';
      id: string;
      name: string;
      year_approx?: number | null;
      origin?: string;
      upstreamCount: number;
      buckets: BuiltUponBuckets;
      locale: OgLocale;
    };

/**
 * Données pour l’image OG /tree/[id] — Supabase ou seed local (getAllNodes / getAllLinks).
 */
export async function loadOgTreeInventionData(
  id: string,
  locale: OgLocale
): Promise<OgTreePayload> {
  const [nodes, links] = await Promise.all([getAllNodes(), getAllLinks()]);
  const focus = nodes.find((n) => n.id === id);
  if (!focus) {
    return { kind: 'fallback', locale };
  }

  const basics = nodes.map(seedNodeToTechBasic);
  const byId = new Map(basics.map((n) => [n.id, n]));

  const directCards: DirectInputCard[] = [];
  for (const l of links) {
    if (l.target_id !== id) continue;
    const p = byId.get(l.source_id);
    if (!p) continue;
    directCards.push({ name: p.name, relation_type: l.relation_type });
  }
  directCards.sort((a, b) => {
    const d = relationSortOrder(a.relation_type) - relationSortOrder(b.relation_type);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, 'fr');
  });

  const upstream = collectUpstreamDependencyNodeIds(
    id,
    links as Pick<CraftingLink, 'source_id' | 'target_id'>[]
  );
  const upstreamCount = Math.max(0, upstream.size - 1);

  const common = {
    id: focus.id,
    name: focus.name,
    year_approx: focus.year_approx,
    origin: focus.origin,
    upstreamCount,
    locale,
  };

  if (directCards.length === 0) {
    return { kind: 'fallback', locale };
  }

  if (directCards.length <= 6) {
    return {
      kind: 'recipe',
      ...common,
      cards: directCards.slice(0, 6),
    };
  }

  const buckets = bucketDirectDependencies(id, basics, links);
  return {
    kind: 'pyramid',
    ...common,
    buckets,
  };
}

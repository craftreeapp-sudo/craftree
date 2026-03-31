/**
 * SEO /tree/[id] — descriptions uniques, variantes réseaux, JSON-LD.
 */
import { collectUpstreamDependencyNodeIds } from '@/lib/graph-utils';
import type { CraftingLink } from '@/lib/types';

export type TreeSeoBundle = {
  /** Meta description principale (≈120–160 caractères) */
  description: string;
  openGraphDescription: string;
  twitterDescription: string;
};

type EdgeSlice = Pick<CraftingLink, 'source_id' | 'target_id'>;

function nameFor(id: string, nameById: Map<string, string>): string {
  return nameById.get(id) ?? id;
}

/** Intrants directs (built upon) : source → target = invention */
function directUpstreamIds(nodeId: string, edges: EdgeSlice[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of edges) {
    if (e.target_id !== nodeId) continue;
    if (seen.has(e.source_id)) continue;
    seen.add(e.source_id);
    out.push(e.source_id);
  }
  return out;
}

/** Nombre de technologies en aval (liens sortants uniques). */
function downstreamCount(nodeId: string, edges: EdgeSlice[]): number {
  const set = new Set<string>();
  for (const e of edges) {
    if (e.source_id === nodeId) set.add(e.target_id);
  }
  return set.size;
}

function clampDescription(s: string, max = 160): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > 80 ? cut.slice(0, lastSpace) : cut;
  return `${base}…`;
}

/** Meta description : entre ~120 et 160 caractères. */
function finalizeMetaDescription(s: string, min = 120, max = 160): string {
  let t = s.trim();
  if (t.length > max) t = clampDescription(t, max);
  if (t.length < min) {
    t = `${t} Explorez la chaîne sur Craftree.`.trim();
    if (t.length > max) t = clampDescription(t, max);
  }
  return t;
}

/**
 * Titres + descriptions pour meta / OG / Twitter.
 */
export function buildTreeSeoBundle(params: {
  displayName: string;
  nodeId: string;
  edges: EdgeSlice[];
  nameById: Map<string, string>;
}): TreeSeoBundle {
  const { displayName, nodeId, edges, nameById } = params;

  const upstream = collectUpstreamDependencyNodeIds(nodeId, edges);
  const depCount = Math.max(0, upstream.size - 1);

  const directIds = directUpstreamIds(nodeId, edges);
  const directNames = directIds
    .slice(0, 3)
    .map((id) => nameFor(id, nameById));

  if (directIds.length > 0) {
    const depList =
      directNames.length === 1
        ? directNames[0]
        : directNames.length === 2
          ? `${directNames[0]}, ${directNames[1]}`
          : `${directNames[0]}, ${directNames[1]}, ${directNames[2]}`;

    const full = `Que faut-il pour fabriquer ${displayName} ? ${depCount} inventions nécessaires : ${depList} et plus. Explorez l'arbre complet des dépendances sur Craftree.`;
    const description = finalizeMetaDescription(full);

    const og = `Que faut-il pour fabriquer ${displayName} ? Découvrez les ${depCount} inventions nécessaires : ${depList} et plus.`;
    const tw = `Que faut-il pour fabriquer ${displayName} ? ${depCount} inventions en amont.`;

    return {
      description,
      openGraphDescription: clampDescription(og, 300),
      twitterDescription: clampDescription(tw, 200),
    };
  }

  const down = downstreamCount(nodeId, edges);
  const full = `${displayName} : matière première fondamentale utilisée dans ${down} technologies. Découvrez tout ce qu'elle permet de fabriquer sur Craftree.`;
  const description = finalizeMetaDescription(full);

  const og = `${displayName} : matière première utilisée dans ${down} technologies. Chaîne de fabrication sur Craftree.`;
  const tw = `${displayName} — ${down} technologies en aval sur Craftree.`;

  return {
    description,
    openGraphDescription: clampDescription(og, 300),
    twitterDescription: clampDescription(tw, 200),
  };
}

/** JSON-LD Article pour une page invention (injecté côté serveur). */
export function buildTreeArticleJsonLd(params: {
  name: string;
  alternateName?: string | null;
  description?: string | null;
  canonicalUrl: string;
  siteUrl: string;
  yearApprox?: number | null;
}): Record<string, unknown> {
  const {
    name,
    alternateName,
    description,
    canonicalUrl,
    siteUrl,
    yearApprox,
  } = params;

  const desc =
    description && description.trim().length > 0
      ? description.trim().slice(0, 500)
      : undefined;

  const article: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    name,
    url: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Craftree',
      url: siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl,
    },
  };

  if (alternateName && alternateName.trim()) {
    article.alternateName = alternateName.trim();
  }
  if (desc) {
    article.description = desc;
  }
  if (yearApprox != null && Number.isFinite(yearApprox)) {
    article.dateCreated = String(Math.trunc(yearApprox));
  }

  return article;
}

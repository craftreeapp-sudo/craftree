import nodesIndex from '@/data/nodes-index.json';
import linksJson from '@/data/links.json';
import { computeComplexityDepth, filterValidCraftingLinks } from '@/lib/graph-utils';
import type { CraftingLink, TechNodeBasic } from '@/lib/types';

export interface LandingStats {
  techCount: number;
  recipeCount: number;
  rawMaterialCount: number;
  maxDepth: number;
}

/**
 * Agrégats pour la landing (section 7 BRIEF) — calculés depuis nodes-index + links
 */
export function getLandingStats(): LandingStats {
  const nodes = nodesIndex.nodes.map((n) => ({
    ...n,
    tags: [] as string[],
  })) as TechNodeBasic[];
  const dataLinks = linksJson.links as CraftingLink[];
  const links = filterValidCraftingLinks(nodes, dataLinks);

  const rawMaterialCount = nodes.filter((n) => n.type === 'raw_material').length;
  const depthMap = computeComplexityDepth(nodes, links);
  let maxDepth = 0;
  for (const d of depthMap.values()) {
    if (d > maxDepth) maxDepth = d;
  }

  return {
    techCount: nodes.length,
    recipeCount: links.length,
    rawMaterialCount,
    maxDepth,
  };
}

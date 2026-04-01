/**
 * Fusion nodes-index + nodes-details pour métadonnées / SEO (import côté serveur ou build).
 */
import nodesIndex from '@/data/nodes-index.json';
import nodesDetails from '@/data/nodes-details.json';
import linksJson from '@/data/links.json';
import type {
  ChemicalNature,
  CraftingLink,
  MaterialLevel,
  NaturalOrigin,
  NodeDimension,
  SeedNode,
} from '@/lib/types';

type DetailsRow = {
  name_en?: string;
  description?: string;
  tags?: string[];
  origin?: string | null;
  wikipedia_url?: string;
  image_url?: string;
  _ai_built_upon?: string[];
  _ai_led_to?: string[];
};

const details = nodesDetails as unknown as Record<string, DetailsRow>;

type IndexNode = (typeof nodesIndex.nodes)[number] & {
  dimension?: NodeDimension | null;
  materialLevel?: MaterialLevel | null;
};

export function getMergedSeedNode(id: string): SeedNode | undefined {
  const n = nodesIndex.nodes.find((x) => x.id === id) as IndexNode | undefined;
  if (!n) return undefined;
  const d = details[id] ?? {};
  const row = n as Record<string, unknown>;
  return {
    id: n.id,
    name: n.name,
    name_en: d.name_en ?? '',
    description: d.description ?? '',
    category: n.category,
    era: n.era,
    year_approx: n.year_approx,
    complexity_depth: n.complexity_depth,
    dimension: n.dimension ?? null,
    materialLevel: n.materialLevel ?? null,
    ...(row.naturalOrigin != null && row.naturalOrigin !== ''
      ? { naturalOrigin: row.naturalOrigin as NaturalOrigin }
      : {}),
    ...(row.chemicalNature != null && row.chemicalNature !== ''
      ? { chemicalNature: row.chemicalNature as ChemicalNature }
      : {}),
    tags: d.tags ?? [],
    origin: d.origin ?? undefined,
    image_url: n.image_url ?? d.image_url,
    wikipedia_url: d.wikipedia_url,
    ...(d._ai_built_upon ? { _ai_built_upon: d._ai_built_upon } : {}),
    ...(d._ai_led_to ? { _ai_led_to: d._ai_led_to } : {}),
  };
}

export function getAllNodeIds(): string[] {
  return nodesIndex.nodes.map((x) => x.id);
}

export function getExploreMetadataNodes(): {
  id: string;
  name: string;
  description?: string;
}[] {
  return nodesIndex.nodes.map((n) => ({
    id: n.id,
    name: n.name,
    description: details[n.id]?.description,
  }));
}

export function getTreeMetadataNode(id: string): { id: string; name: string } | undefined {
  const n = nodesIndex.nodes.find((x) => x.id === id);
  return n ? { id: n.id, name: n.name } : undefined;
}

export function getLinksForMetadata(): Pick<CraftingLink, 'source_id' | 'target_id'>[] {
  return (linksJson.links as { source_id: string; target_id: string }[]).map((l) => ({
    source_id: l.source_id,
    target_id: l.target_id,
  }));
}

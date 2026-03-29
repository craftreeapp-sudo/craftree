import { createSupabaseServerReadClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import {
  getExploreMetadataNodes as getExploreMetadataNodesFromSeed,
  getLinksForMetadata as getLinksForMetadataFromSeed,
} from '@/lib/seed-merge';
import type {
  CraftingLink,
  MaterialLevel,
  NodeDimension,
  SeedNode,
} from '@/lib/types';
import { getEraFromYear } from '@/lib/utils';

function mapRowDimension(row: Record<string, unknown>): NodeDimension | null {
  const d = row.dimension;
  if (d == null || d === '') return null;
  return String(d) as NodeDimension;
}

function mapRowMaterialLevel(row: Record<string, unknown>): MaterialLevel | null {
  const m = row.material_level;
  if (m == null || m === '') return null;
  return String(m) as MaterialLevel;
}

/** Colonnes minimales pour le graphe /explore (pas de textes longs). */
export const GRAPH_NODES_SELECT =
  'id, name, name_en, category, type, era, year_approx, image_url, complexity_depth, dimension, material_level';

/** Liens : champs nécessaires au rendu et à l’éditeur (pas de métadonnées inutiles). */
export const GRAPH_LINKS_SELECT =
  'id, source_id, target_id, relation_type, is_optional, notes';

/**
 * Projection graphe → SeedNode : champs lourds vides jusqu’à chargement détail / ?full=1.
 */
export function mapGraphNodeRowToSeedNode(row: Record<string, unknown>): SeedNode {
  const year =
    row.year_approx === null || row.year_approx === undefined
      ? undefined
      : Number(row.year_approx);
  const eraFromDb = row.era != null && String(row.era).trim() !== ''
    ? String(row.era)
    : String(getEraFromYear(year ?? null));
  return {
    id: String(row.id),
    name: String(row.name),
    name_en: row.name_en != null ? String(row.name_en) : '',
    description: '',
    description_en: undefined,
    category: String(row.category),
    type: String(row.type),
    era: eraFromDb,
    year_approx: year,
    complexity_depth: Number(row.complexity_depth ?? 0),
    tags: [],
    origin: undefined,
    image_url: row.image_url != null ? String(row.image_url) : undefined,
    wikipedia_url: undefined,
    dimension: mapRowDimension(row),
    materialLevel: mapRowMaterialLevel(row),
  };
}

/** Mappe une ligne `nodes` Supabase vers le format SeedNode attendu par l’app. */
export function mapNodeRowToSeedNode(row: Record<string, unknown>): SeedNode {
  return {
    id: String(row.id),
    name: String(row.name),
    name_en: row.name_en != null ? String(row.name_en) : '',
    description: row.description != null ? String(row.description) : '',
    description_en:
      row.description_en != null ? String(row.description_en) : undefined,
    category: String(row.category),
    type: String(row.type),
    era: String(row.era ?? ''),
    year_approx:
      row.year_approx === null || row.year_approx === undefined
        ? undefined
        : Number(row.year_approx),
    complexity_depth: Number(row.complexity_depth ?? 0),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    origin: row.origin != null ? String(row.origin) : undefined,
    image_url: row.image_url != null ? String(row.image_url) : undefined,
    wikipedia_url: row.wikipedia_url != null ? String(row.wikipedia_url) : undefined,
    dimension: mapRowDimension(row),
    materialLevel: mapRowMaterialLevel(row),
  };
}

export function mapLinkRowToCraftingLink(
  row: Record<string, unknown>
): CraftingLink {
  return {
    id: String(row.id),
    source_id: String(row.source_id),
    target_id: String(row.target_id),
    relation_type: row.relation_type as CraftingLink['relation_type'],
    is_optional: Boolean(row.is_optional),
    notes: row.notes != null ? String(row.notes) : undefined,
  };
}

export async function getAllNodes(): Promise<SeedNode[]> {
  if (!isSupabaseConfigured()) {
    const { readSeedData } = await import('@/lib/seed-data-fs');
    return readSeedData().nodes;
  }
  const supabase = createSupabaseServerReadClient();
  const { data, error } = await supabase
    .from('nodes')
    .select(GRAPH_NODES_SELECT)
    .order('name');
  if (error) throw error;
  return (data ?? []).map((r) =>
    mapGraphNodeRowToSeedNode(r as Record<string, unknown>)
  );
}

export async function getNodeDetailsRow(id: string) {
  if (!isSupabaseConfigured()) {
    const { readSeedData } = await import('@/lib/seed-data-fs');
    const n = readSeedData().nodes.find((x) => x.id === id);
    return n ?? null;
  }
  const supabase = createSupabaseServerReadClient();
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllLinks(): Promise<CraftingLink[]> {
  if (!isSupabaseConfigured()) {
    const { readSeedData } = await import('@/lib/seed-data-fs');
    return readSeedData().links;
  }
  const supabase = createSupabaseServerReadClient();
  const { data, error } = await supabase.from('links').select(GRAPH_LINKS_SELECT);
  if (error) throw error;
  return (data ?? []).map((r) => mapLinkRowToCraftingLink(r as Record<string, unknown>));
}

export async function getLinksForNode(nodeId: string): Promise<CraftingLink[]> {
  if (!isSupabaseConfigured()) {
    return (await getAllLinks()).filter(
      (l) => l.source_id === nodeId || l.target_id === nodeId
    );
  }
  const supabase = createSupabaseServerReadClient();
  const { data, error } = await supabase
    .from('links')
    .select(GRAPH_LINKS_SELECT)
    .or(`source_id.eq.${nodeId},target_id.eq.${nodeId}`);
  if (error) throw error;
  return (data ?? []).map((r) => mapLinkRowToCraftingLink(r as Record<string, unknown>));
}

/** Métadonnées SEO / explore (titres, descriptions courtes). */
export async function getExploreMetadataNodes(): Promise<
  { id: string; name: string; description?: string }[]
> {
  if (!isSupabaseConfigured()) {
    return getExploreMetadataNodesFromSeed();
  }
  const supabase = createSupabaseServerReadClient();
  const { data, error } = await supabase
    .from('nodes')
    .select('id, name, description')
    .order('name');
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: String((n as { id: string }).id),
    name: String((n as { name: string }).name),
    description: (n as { description?: string | null }).description ?? undefined,
  }));
}

/** Liens minimalistes pour SEO (graphe de description). */
export async function getExploreMetadataLinks(): Promise<
  Pick<CraftingLink, 'source_id' | 'target_id'>[]
> {
  if (!isSupabaseConfigured()) {
    return getLinksForMetadataFromSeed();
  }
  const links = await getAllLinks();
  return links.map((l) => ({
    source_id: l.source_id,
    target_id: l.target_id,
  }));
}

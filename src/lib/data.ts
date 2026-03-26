import { createSupabaseServerReadClient } from '@/lib/supabase-server';
import {
  getExploreMetadataNodes as getExploreMetadataNodesFromSeed,
  getLinksForMetadata as getLinksForMetadataFromSeed,
} from '@/lib/seed-merge';
import type { CraftingLink, SeedNode } from '@/lib/types';

function useSupabaseEnv(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
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
    quantity_hint:
      row.quantity_hint != null ? String(row.quantity_hint) : undefined,
    is_optional: Boolean(row.is_optional),
    notes: row.notes != null ? String(row.notes) : undefined,
  };
}

export async function getAllNodes(): Promise<SeedNode[]> {
  if (!useSupabaseEnv()) {
    const { readSeedData } = await import('@/lib/seed-data-fs');
    return readSeedData().nodes;
  }
  const supabase = createSupabaseServerReadClient();
  const { data, error } = await supabase
    .from('nodes')
    .select(
      'id, name, name_en, description, description_en, category, type, era, year_approx, origin, image_url, wikipedia_url, tags, complexity_depth'
    )
    .order('name');
  if (error) throw error;
  return (data ?? []).map((r) => mapNodeRowToSeedNode(r as Record<string, unknown>));
}

export async function getNodeDetailsRow(id: string) {
  if (!useSupabaseEnv()) {
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
  if (!useSupabaseEnv()) {
    const { readSeedData } = await import('@/lib/seed-data-fs');
    return readSeedData().links;
  }
  const supabase = createSupabaseServerReadClient();
  const { data, error } = await supabase.from('links').select('*');
  if (error) throw error;
  return (data ?? []).map((r) => mapLinkRowToCraftingLink(r as Record<string, unknown>));
}

export async function getLinksForNode(nodeId: string): Promise<CraftingLink[]> {
  if (!useSupabaseEnv()) {
    return (await getAllLinks()).filter(
      (l) => l.source_id === nodeId || l.target_id === nodeId
    );
  }
  const supabase = createSupabaseServerReadClient();
  const { data, error } = await supabase
    .from('links')
    .select('*')
    .or(`source_id.eq.${nodeId},target_id.eq.${nodeId}`);
  if (error) throw error;
  return (data ?? []).map((r) => mapLinkRowToCraftingLink(r as Record<string, unknown>));
}

/** Métadonnées SEO / explore (titres, descriptions courtes). */
export async function getExploreMetadataNodes(): Promise<
  { id: string; name: string; description?: string }[]
> {
  if (!useSupabaseEnv()) {
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
  if (!useSupabaseEnv()) {
    return getLinksForMetadataFromSeed();
  }
  const links = await getAllLinks();
  return links.map((l) => ({
    source_id: l.source_id,
    target_id: l.target_id,
  }));
}

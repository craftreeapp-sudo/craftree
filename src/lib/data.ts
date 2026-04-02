import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerReadClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import {
  getExploreMetadataNodes as getExploreMetadataNodesFromSeed,
  getLinksForMetadata as getLinksForMetadataFromSeed,
  getTreeMetadataNode,
} from '@/lib/seed-merge';
import type {
  ChemicalNature,
  CraftingLink,
  MaterialLevel,
  NaturalOrigin,
  NatureType,
  NodeDimension,
  OriginType,
  SeedNode,
} from '@/lib/types';
import { rowIsDraft } from '@/lib/draft-flag';
import { getEraFromYear } from '@/lib/utils';

export { rowIsDraft };

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

function mapRowNaturalOrigin(
  row: Record<string, unknown>
): NaturalOrigin | null {
  const v = row.natural_origin;
  if (v == null || v === '') return null;
  return String(v) as NaturalOrigin;
}

function mapRowChemicalNature(
  row: Record<string, unknown>
): ChemicalNature | null {
  const v = row.chemical_nature;
  if (v == null || v === '') return null;
  return String(v) as ChemicalNature;
}

function mapRowOriginType(row: Record<string, unknown>): OriginType | null {
  const v = row.origin_type;
  if (v == null || v === '') return null;
  const s = String(v);
  if (s === 'mineral' || s === 'vegetal' || s === 'animal') return s;
  return null;
}

function mapRowNatureType(row: Record<string, unknown>): NatureType | null {
  const v = row.nature_type;
  if (v == null || v === '') return null;
  const s = String(v);
  if (s === 'element' || s === 'compose' || s === 'materiau') return s;
  return null;
}

/** Colonnes minimales pour le graphe /explore (pas de textes longs). Sans colonne legacy `type`. */
export const GRAPH_NODES_SELECT =
  'id, name, name_en, category, era, year_approx, image_url, complexity_depth, dimension, material_level, natural_origin, chemical_nature, origin_type, nature_type, is_draft';

/** Même projection sans `natural_origin` / `chemical_nature` (bases non migrées). */
export const GRAPH_NODES_SELECT_LEGACY =
  'id, name, name_en, category, era, year_approx, image_url, complexity_depth, dimension, material_level, is_draft';

/** Liste admin / API `?full=1` — avec colonnes nature. */
export const FULL_NODES_SELECT =
  'id, name, name_en, description, description_en, category, era, year_approx, origin, image_url, wikipedia_url, tags, complexity_depth, dimension, material_level, natural_origin, chemical_nature, origin_type, nature_type, is_draft';

export const FULL_NODES_SELECT_LEGACY =
  'id, name, name_en, description, description_en, category, era, year_approx, origin, image_url, wikipedia_url, tags, complexity_depth, dimension, material_level, is_draft';

/** Même projection sans `is_draft` (migration non appliquée sur Supabase). */
export const GRAPH_NODES_SELECT_NO_DRAFT =
  'id, name, name_en, category, era, year_approx, image_url, complexity_depth, dimension, material_level, natural_origin, chemical_nature, origin_type, nature_type';

export const GRAPH_NODES_SELECT_LEGACY_NO_DRAFT =
  'id, name, name_en, category, era, year_approx, image_url, complexity_depth, dimension, material_level';

export const FULL_NODES_SELECT_NO_DRAFT =
  'id, name, name_en, description, description_en, category, era, year_approx, origin, image_url, wikipedia_url, tags, complexity_depth, dimension, material_level, natural_origin, chemical_nature, origin_type, nature_type';

export const FULL_NODES_SELECT_LEGACY_NO_DRAFT =
  'id, name, name_en, description, description_en, category, era, year_approx, origin, image_url, wikipedia_url, tags, complexity_depth, dimension, material_level';

export function isMissingNatureColumnsError(
  err: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null
): boolean {
  if (!err) return false;
  const m = [
    String(err.message ?? ''),
    String(err.details ?? ''),
    String(err.hint ?? ''),
  ].join(' ');
  return m.includes('natural_origin') || m.includes('chemical_nature');
}

/** Colonne `is_draft` absente (migration non appliquée). */
export function isMissingDraftColumnError(
  err: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null
): boolean {
  if (!err) return false;
  const m = [
    String(err.message ?? ''),
    String(err.details ?? ''),
    String(err.hint ?? ''),
  ].join(' ');
  return m.includes('is_draft');
}

type NodesFetchMode = 'graph' | 'full';

/**
 * Lecture `nodes` avec repli : nature legacy, puis `is_draft` absent (ordre couvre les combinaisons).
 */
export async function fetchNodesOrdered(
  supabase: ReturnType<typeof createSupabaseServerReadClient>,
  mode: NodesFetchMode
): Promise<{ rows: Record<string, unknown>[] }> {
  const chain =
    mode === 'graph'
      ? [
          GRAPH_NODES_SELECT,
          GRAPH_NODES_SELECT_NO_DRAFT,
          GRAPH_NODES_SELECT_LEGACY,
          GRAPH_NODES_SELECT_LEGACY_NO_DRAFT,
        ]
      : [
          FULL_NODES_SELECT,
          FULL_NODES_SELECT_NO_DRAFT,
          FULL_NODES_SELECT_LEGACY,
          FULL_NODES_SELECT_LEGACY_NO_DRAFT,
        ];

  let lastError: unknown = null;
  for (const select of chain) {
    const { data, error } = await supabase
      .from('nodes')
      .select(select as never)
      .order('name');
    if (!error) {
      return {
        rows: (data ?? []) as unknown as Record<string, unknown>[],
      };
    }
    lastError = error;
  }
  throw lastError;
}

/** Une ligne `nodes` complète (lecture fiche) avec la même chaîne de repli que `fetchNodesOrdered`. */
export async function fetchFullNodeRowById(
  supabase: ReturnType<typeof createSupabaseServerReadClient>,
  id: string
): Promise<Record<string, unknown> | null> {
  const chain = [
    FULL_NODES_SELECT,
    FULL_NODES_SELECT_NO_DRAFT,
    FULL_NODES_SELECT_LEGACY,
    FULL_NODES_SELECT_LEGACY_NO_DRAFT,
  ];
  let lastError: unknown = null;
  for (const select of chain) {
    const { data, error } = await supabase
      .from('nodes')
      .select(select as never)
      .eq('id', id)
      .maybeSingle();
    if (!error) {
      return (data ?? null) as Record<string, unknown> | null;
    }
    lastError = error;
  }
  throw lastError;
}

/** Liens : champs nécessaires au rendu et à l’éditeur (pas de métadonnées inutiles). */
export const GRAPH_LINKS_SELECT =
  'id, source_id, target_id, relation_type, is_optional, notes';

const LINKS_PAGE_SIZE = 1000;

/**
 * PostgREST limite le nombre de lignes par réponse ; parcourir toutes les pages.
 * Utilisé par `getAllLinks` (SSR `/tree`) et par l’API `GET/POST /api/links`.
 */
export async function fetchAllLinkRowsPaginated(
  sb: SupabaseClient,
  columns: string
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from('links')
      .select(columns)
      .range(from, from + LINKS_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < LINKS_PAGE_SIZE) break;
    from += LINKS_PAGE_SIZE;
  }
  return rows;
}

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
    era: eraFromDb,
    year_approx: year,
    complexity_depth: Number(row.complexity_depth ?? 0),
    tags: [],
    origin: undefined,
    image_url: row.image_url != null ? String(row.image_url) : undefined,
    wikipedia_url: undefined,
    dimension: mapRowDimension(row),
    materialLevel: mapRowMaterialLevel(row),
    naturalOrigin: mapRowNaturalOrigin(row),
    chemicalNature: mapRowChemicalNature(row),
    origin_type: mapRowOriginType(row),
    nature_type: mapRowNatureType(row),
    is_draft: rowIsDraft(row),
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
    naturalOrigin: mapRowNaturalOrigin(row),
    chemicalNature: mapRowChemicalNature(row),
    origin_type: mapRowOriginType(row),
    nature_type: mapRowNatureType(row),
    is_draft: rowIsDraft(row),
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

export async function getAllNodes(options?: {
  /** Inclure les fiches brouillon (admin). Défaut : false. */
  includeDrafts?: boolean;
}): Promise<SeedNode[]> {
  if (!isSupabaseConfigured()) {
    const { readSeedData } = await import('@/lib/seed-data-fs');
    const all = readSeedData().nodes;
    if (options?.includeDrafts) return all;
    return all.filter((n) => !n.is_draft);
  }
  const supabase = createSupabaseServerReadClient();
  const { rows } = await fetchNodesOrdered(supabase, 'graph');
  const mapped = rows.map((r) => mapGraphNodeRowToSeedNode(r));
  if (options?.includeDrafts) return mapped;
  return mapped.filter((n) => !n.is_draft);
}

export async function getNodeDetailsRow(id: string) {
  if (!isSupabaseConfigured()) {
    const { readSeedData } = await import('@/lib/seed-data-fs');
    const n = readSeedData().nodes.find((x) => x.id === id);
    return n ?? null;
  }
  const supabase = createSupabaseServerReadClient();
  return fetchFullNodeRowById(supabase, id);
}

/**
 * Existence + nom pour `/tree/[id]` : base Supabase si configurée, sinon `nodes-index.json` (build).
 */
export async function getTreePageNodeMeta(
  id: string,
  options?: { viewerIsAdmin?: boolean }
): Promise<{ id: string; name: string } | null> {
  if (!isSupabaseConfigured()) {
    const n = getTreeMetadataNode(id);
    if (!n) return null;
    if (n.is_draft && !options?.viewerIsAdmin) return null;
    return { id: n.id, name: n.name };
  }
  const supabase = createSupabaseServerReadClient();
  const first = await supabase
    .from('nodes')
    .select('id, name, is_draft')
    .eq('id', id)
    .maybeSingle();
  let data = first.data as { id: string; name: string; is_draft?: boolean } | null;
  let error = first.error;
  if (error && isMissingDraftColumnError(error)) {
    const second = await supabase
      .from('nodes')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();
    data = second.data as { id: string; name: string; is_draft?: boolean } | null;
    error = second.error;
  }
  if (error) throw error;
  if (!data) return null;
  const row = data;
  if (row.is_draft && !options?.viewerIsAdmin) return null;
  return { id: String(row.id), name: String(row.name) };
}

export async function getAllLinks(): Promise<CraftingLink[]> {
  if (!isSupabaseConfigured()) {
    const { readSeedData } = await import('@/lib/seed-data-fs');
    return readSeedData().links;
  }
  const supabase = createSupabaseServerReadClient();
  const linkRows = await fetchAllLinkRowsPaginated(supabase, GRAPH_LINKS_SELECT);
  return linkRows.map((r) => mapLinkRowToCraftingLink(r));
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
  const firstMeta = await supabase
    .from('nodes')
    .select('id, name, description, is_draft')
    .order('name');
  let data = firstMeta.data as
    | { id: string; name: string; description?: string | null; is_draft?: boolean }[]
    | null;
  let error = firstMeta.error;
  if (error && isMissingDraftColumnError(error)) {
    const second = await supabase
      .from('nodes')
      .select('id, name, description')
      .order('name');
    data = second.data as typeof data;
    error = second.error;
  }
  if (error) throw error;
  return (data ?? [])
    .filter((row) => !row.is_draft)
    .map((n) => ({
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

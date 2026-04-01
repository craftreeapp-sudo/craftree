/**
 * Construction du patch Supabase `nodes` pour l’approbation admin (aligné sur PATCH /api/nodes/[id]).
 */
import { mergeDimensionMaterialLevel } from '@/lib/node-dimension';
import {
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';
import type { SeedNode } from '@/lib/types';

const ORIGIN_TYPES = new Set(['mineral', 'vegetal', 'animal']);
const NATURE_TYPES = new Set(['element', 'compose', 'materiau']);

function parseOriginTypeCol(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v);
  return ORIGIN_TYPES.has(s) ? s : undefined;
}

function parseNatureTypeCol(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v);
  return NATURE_TYPES.has(s) ? s : undefined;
}

/**
 * @param body — `proposed` fusionné (sans `linkEdits`)
 */
export function buildSupabaseNodePatchFromBody(
  body: Record<string, unknown>,
  cur: SeedNode
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  let tags: string[] | undefined;
  const rawTags = body.tags;
  if (Array.isArray(rawTags)) tags = rawTags.map(String);
  else if (typeof rawTags === 'string') {
    tags = rawTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }
  if (tags) patch.tags = tags;

  if (typeof body.name === 'string') patch.name = body.name.trim();
  if (typeof body.description === 'string') patch.description = body.description;
  if (typeof body.description_en === 'string') {
    patch.description_en = body.description_en.trim();
  }
  if (typeof body.name_en === 'string') patch.name_en = body.name_en.trim();
  if (typeof body.category === 'string') patch.category = body.category;
  if (typeof body.type === 'string') patch.type = body.type;
  if (typeof body.era === 'string') patch.era = body.era;
  if (typeof body.origin === 'string') patch.origin = body.origin.trim();
  if (typeof body.image_url === 'string') patch.image_url = body.image_url.trim();
  if (typeof body.wikipedia_url === 'string') {
    patch.wikipedia_url = body.wikipedia_url.trim();
  }
  if (body.year_approx !== undefined) {
    patch.year_approx =
      body.year_approx === null ? null : Number(body.year_approx);
  }

  const dm = mergeDimensionMaterialLevel(cur, body);
  patch.dimension = dm.dimension;
  patch.material_level = dm.materialLevel;

  if (body.naturalOrigin !== undefined) {
    if (body.naturalOrigin === null || body.naturalOrigin === '') {
      patch.natural_origin = null;
    } else {
      const p = parseNaturalOrigin(String(body.naturalOrigin));
      patch.natural_origin = p === '' ? null : p;
    }
  }
  if (body.chemicalNature !== undefined) {
    if (body.chemicalNature === null || body.chemicalNature === '') {
      patch.chemical_nature = null;
    } else {
      const p = parseChemicalNature(String(body.chemicalNature));
      patch.chemical_nature = p === '' ? null : p;
    }
  }

  const ot = parseOriginTypeCol(body.origin_type);
  if (ot !== undefined) patch.origin_type = ot;
  const nt = parseNatureTypeCol(body.nature_type);
  if (nt !== undefined) patch.nature_type = nt;

  return patch;
}

import { RelationType } from '@/lib/types';

export type ClaudeReviewJson = {
  has_issues?: boolean;
  issues?: Array<{
    field?: string;
    current_value?: unknown;
    suggested_value?: unknown;
    reason?: string;
  }>;
  missing_links?: Array<{
    type?: string;
    suggested_name?: string;
    reason?: string;
  }>;
  suspect_links?: Array<{
    link_id?: string;
    from?: string;
    to?: string;
    reason?: string;
  }>;
  confidence?: number;
};

function normalizeNatureTypeForDb(
  v: unknown
): 'element' | 'compose' | 'materiau' | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).toLowerCase().trim();
  if (s === 'element') return 'element';
  if (s === 'compound' || s === 'compose') return 'compose';
  if (s === 'material' || s === 'materiau') return 'materiau';
  return undefined;
}

function coerceYearApprox(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (Number.isNaN(n)) return undefined;
  if (n < -10000 || n > 2030) return undefined;
  return n;
}

/**
 * Applique une issue Claude sur une copie de `proposed` (clé = champs formulaire edit_node).
 * Retourne false si le champ n'a pas été reconnu.
 */
export function applyIssueToProposed(
  proposed: Record<string, unknown>,
  rawField: string,
  suggested: unknown
): boolean {
  const f = rawField.toLowerCase().trim().replace(/\s+/g, '_');

  if (f === 'dimension') {
    const s = String(suggested ?? '').trim();
    if (['matter', 'process', 'tool'].includes(s)) proposed.dimension = s;
    return true;
  }
  if (f === 'material_level' || f === 'materiallevel') {
    const s = String(suggested ?? '').trim();
    if (['raw', 'processed', 'industrial', 'component'].includes(s)) {
      proposed.materialLevel = s;
    }
    return true;
  }
  if (f === 'year_approx' || f === 'year') {
    const y = coerceYearApprox(suggested);
    if (y !== undefined) proposed.year_approx = y;
    return true;
  }
  if (f === 'origin_type' || f === 'origintype') {
    const s = String(suggested ?? '').trim();
    if (['mineral', 'vegetal', 'animal'].includes(s)) proposed.origin_type = s;
    else if (s === '' || suggested === null) proposed.origin_type = null;
    return true;
  }
  if (f === 'nature_type' || f === 'naturetype') {
    const nt = normalizeNatureTypeForDb(suggested);
    if (nt !== undefined) proposed.nature_type = nt;
    return true;
  }
  if (f === 'natural_origin' || f === 'naturalorigin') {
    const s = String(suggested ?? '').trim();
    if (['mineral', 'vegetal', 'animal'].includes(s)) proposed.naturalOrigin = s;
    else if (s === '' || suggested === null) proposed.naturalOrigin = null;
    return true;
  }
  if (f === 'chemical_nature' || f === 'chemicalnature') {
    const s = String(suggested ?? '').trim();
    if (['element', 'compound', 'material'].includes(s)) {
      proposed.chemicalNature =
        s === 'compound' ? 'compound' : s === 'material' ? 'material' : 'element';
    } else if (s === '' || suggested === null) proposed.chemicalNature = null;
    return true;
  }
  if (f === 'category') {
    proposed.category = String(suggested ?? '').trim();
    return true;
  }
  if (f === 'era') {
    proposed.era = String(suggested ?? '').trim();
    return true;
  }
  if (f === 'name') {
    proposed.name = String(suggested ?? '').trim();
    return true;
  }
  if (f === 'name_en' || f === 'nameen') {
    proposed.name_en = String(suggested ?? '').trim();
    return true;
  }
  if (f === 'origin') {
    proposed.origin = String(suggested ?? '').trim();
    return true;
  }
  if (f === 'description') {
    proposed.description = String(suggested ?? '').trim();
    return true;
  }
  if (f === 'description_en' || f === 'descriptionen') {
    proposed.description_en = String(suggested ?? '').trim();
    return true;
  }
  if (f === 'wikipedia_url' || f === 'wikipediaurl') {
    const w = String(suggested ?? '').trim();
    proposed.wikipedia_url = w === '' ? null : w;
    return true;
  }

  return false;
}

export function parseClaudeJson(text: string): ClaudeReviewJson | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]!) as ClaudeReviewJson;
  } catch {
    return null;
  }
}

export const DEFAULT_ADD_LINK_RELATION = RelationType.MATERIAL;

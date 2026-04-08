import { NODE_DIMENSION_ORDER, RelationType } from '@/lib/types';

const REVIEW_DIM_SET = new Set<string>(NODE_DIMENSION_ORDER);

export type ClaudeReviewJson = {
  has_issues?: boolean;
  issues?: Array<{
    field?: string;
    current_value?: unknown;
    suggested_value?: unknown;
    reason?: string;
  }>;
  /** @deprecated Préférer missing_nodes + missing_edges ; conservé pour compatibilité. */
  missing_links?: Array<{
    type?: string;
    suggested_name?: string;
    reason?: string;
  }>;
  /** Cartes absentes du graphe : id logique stable (ex. mn_thermostat) pour missing_edges. */
  missing_nodes?: Array<{
    id?: string;
    suggested_name?: string;
    reason?: string;
    /** Lien avec la fiche courante : prérequis ou aval. */
    link_to_current?: 'built_upon' | 'led_to' | string;
  }>;
  /** Liens entre current, ids logiques (missing_nodes.id) ou id nœud existant. */
  missing_edges?: Array<{
    source?: string;
    target?: string;
    relation_type?: string;
    notes?: string;
  }>;
  suspect_links?: Array<{
    link_id?: string;
    from?: string;
    to?: string;
    reason?: string;
  }>;
  confidence?: number;
};

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
    if (REVIEW_DIM_SET.has(s)) {
      proposed.dimension = s;
    }
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
  if (
    f === 'natural_origin' ||
    f === 'naturalorigin' ||
    f === 'origin_type' ||
    f === 'origintype'
  ) {
    const s = String(suggested ?? '').trim();
    if (['mineral', 'plant', 'vegetal', 'animal'].includes(s)) {
      proposed.naturalOrigin = s === 'vegetal' ? 'plant' : s;
    } else if (s === '' || suggested === null) proposed.naturalOrigin = null;
    return true;
  }
  if (
    f === 'chemical_nature' ||
    f === 'chemicalnature' ||
    f === 'nature_type' ||
    f === 'naturetype'
  ) {
    const s = String(suggested ?? '').trim().toLowerCase();
    if (
      s === 'element' ||
      s === 'compound' ||
      s === 'material' ||
      s === 'compose' ||
      s === 'materiau'
    ) {
      proposed.chemicalNature =
        s === 'compose'
          ? 'compound'
          : s === 'materiau'
            ? 'material'
            : (s as 'element' | 'compound' | 'material');
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
    proposed.description = String(suggested ?? '');
    return true;
  }
  if (f === 'description_en' || f === 'descriptionen') {
    proposed.description_en = String(suggested ?? '');
    return true;
  }
  if (f === 'tags') {
    if (Array.isArray(suggested)) {
      proposed.tags = suggested.map((x) => String(x).trim()).filter(Boolean);
    } else if (typeof suggested === 'string') {
      proposed.tags = suggested
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
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

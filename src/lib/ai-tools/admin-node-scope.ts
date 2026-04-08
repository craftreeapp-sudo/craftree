/** Filtres communs pour les outils IA admin (ciblage par métadonnées nœud). */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { NodeDimension } from '@/lib/types';

export type DraftScope = 'all' | 'drafts_only' | 'published_only';

export type AdminNodeScope = {
  filterCategory?: string | null;
  filterEra?: string | null;
  filterYearMin?: number | null;
  filterYearMax?: number | null;
  excludeLocked?: boolean;
  draftScope?: DraftScope;
  complexityMin?: number | null;
  complexityMax?: number | null;
  /** Uniquement les cartes avec URL Wikipédia non vide. */
  requireWikipediaUrl?: boolean;
  /** Filtrer par dimension Craftree. */
  dimension?: 'all' | NodeDimension;
};

export function clampYearBound(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(2030, Math.max(-10000, Math.round(n)));
}

/** Si min > max, échange (même logique que les filtres année). */
export function normalizeComplexityBounds(
  min: number | null,
  max: number | null
): { complexityMin: number | null; complexityMax: number | null } {
  let complexityMin = min;
  let complexityMax = max;
  if (
    complexityMin != null &&
    complexityMax != null &&
    complexityMin > complexityMax
  ) {
    const t = complexityMin;
    complexityMin = complexityMax;
    complexityMax = t;
  }
  return { complexityMin, complexityMax };
}

export function normalizeYearBounds(
  min: number | null,
  max: number | null
): { yearMin: number | null; yearMax: number | null } {
  let yearMin = min;
  let yearMax = max;
  if (yearMin != null && yearMax != null && yearMin > yearMax) {
    const t = yearMin;
    yearMin = yearMax;
    yearMax = t;
  }
  return { yearMin, yearMax };
}

type NodeRow = Record<string, unknown>;

/** Filtre une ligne `nodes` déjà chargée (colonnes alignées sur le scope). */
export function nodeRowMatchesAdminScope(
  r: NodeRow,
  scope: AdminNodeScope
): boolean {
  const cat = scope.filterCategory;
  if (cat && cat !== 'all' && String(r.category ?? '') !== cat) return false;

  const era = scope.filterEra;
  if (era && era !== 'all' && String(r.era ?? '') !== era) return false;

  const { yearMin, yearMax } = normalizeYearBounds(
    scope.filterYearMin ?? null,
    scope.filterYearMax ?? null
  );
  if (yearMin != null || yearMax != null) {
    if (r.year_approx === null || r.year_approx === undefined) return false;
    const y = Number(r.year_approx);
    if (!Number.isFinite(y)) return false;
    if (yearMin != null && y < yearMin) return false;
    if (yearMax != null && y > yearMax) return false;
  }

  if (scope.excludeLocked && r.is_locked === true) return false;

  const ds = scope.draftScope ?? 'all';
  if (ds === 'drafts_only' && r.is_draft !== true) return false;
  if (ds === 'published_only' && r.is_draft === true) return false;

  const cmin = scope.complexityMin;
  const cmax = scope.complexityMax;
  const cd = Number(r.complexity_depth ?? 0);
  if (cmin != null && (!Number.isFinite(cd) || cd < cmin)) return false;
  if (cmax != null && (!Number.isFinite(cd) || cd > cmax)) return false;

  if (scope.requireWikipediaUrl) {
    const w = r.wikipedia_url;
    if (w == null || String(w).trim() === '') return false;
  }

  const dim = scope.dimension;
  if (dim && dim !== 'all') {
    if (String(r.dimension ?? '').trim() !== dim) return false;
  }

  return true;
}

/** Colonnes `nodes` nécessaires au scope — évite de sélectionner des colonnes absentes sur certaines bases. */
function nodeScopeSelectColumns(scope: AdminNodeScope): string {
  const cols = new Set<string>(['id']);
  if (scope.filterCategory && scope.filterCategory !== 'all') {
    cols.add('category');
  }
  if (scope.filterEra && scope.filterEra !== 'all') {
    cols.add('era');
  }
  const { yearMin, yearMax } = normalizeYearBounds(
    scope.filterYearMin ?? null,
    scope.filterYearMax ?? null
  );
  if (yearMin != null || yearMax != null) {
    cols.add('year_approx');
  }
  if (scope.excludeLocked === true) {
    cols.add('is_locked');
  }
  const ds = scope.draftScope ?? 'all';
  if (ds === 'drafts_only' || ds === 'published_only') {
    cols.add('is_draft');
  }
  if (scope.complexityMin != null || scope.complexityMax != null) {
    cols.add('complexity_depth');
  }
  if (scope.requireWikipediaUrl === true) {
    cols.add('wikipedia_url');
  }
  if (scope.dimension && scope.dimension !== 'all') {
    cols.add('dimension');
  }
  return [...cols].join(', ');
}

function throwPostgrest(error: { message?: string; details?: string; hint?: string }): never {
  const msg = [error.message, error.details, error.hint].filter(Boolean).join(' — ');
  throw new Error(msg || 'Erreur Supabase');
}

/**
 * Filtre une liste d’ids en chargeant les métadonnées nécessaires (par paquets).
 */
export async function filterNodeIdsByAdminScope(
  sb: SupabaseClient,
  ids: string[],
  scope: AdminNodeScope
): Promise<string[]> {
  if (ids.length === 0) return [];

  const needsMeta =
    (scope.filterCategory && scope.filterCategory !== 'all') ||
    (scope.filterEra && scope.filterEra !== 'all') ||
    scope.filterYearMin != null ||
    scope.filterYearMax != null ||
    scope.excludeLocked === true ||
    (scope.draftScope && scope.draftScope !== 'all') ||
    scope.complexityMin != null ||
    scope.complexityMax != null ||
    scope.requireWikipediaUrl === true ||
    (scope.dimension && scope.dimension !== 'all');

  if (!needsMeta) return [...new Set(ids)];

  const selectList = nodeScopeSelectColumns(scope);
  const out: string[] = [];
  const chunk = 120;
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await sb
      .from('nodes')
      .select(selectList)
      .in('id', slice);
    if (error) throwPostgrest(error);
    for (const row of data ?? []) {
      const r = row as unknown as NodeRow;
      if (nodeRowMatchesAdminScope(r, scope)) {
        out.push(String(r.id));
      }
    }
  }
  return out;
}

/** Parse une liste d’ids (retours ligne, virgules, espaces). */
export function parseInventionIdList(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  const parts = s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  return [...new Set(parts)];
}

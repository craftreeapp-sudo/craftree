import type { RelationType } from '@/lib/types';
import { RelationType as RT } from '@/lib/types';

export type LinkSnap = {
  id: string;
  relation_type: string;
  notes: string;
  is_optional: boolean;
};

export const ADMIN_DRAFT_REMOVED_IDS = '__admin_removedLinkIds';
export const ADMIN_DRAFT_PROPOSED_ADD = '__admin_proposedAddLinks';

export const VALID_RELATIONS = new Set<string>(Object.values(RT));

/** Champs nœud éditables en vue détail admin (alignés sur `buildSupabaseNodePatchFromBody`). */
export const EDIT_NODE_FULL_KEYS = [
  'name',
  'name_en',
  'description',
  'description_en',
  'category',
  'type',
  'era',
  'year_approx',
  'origin',
  'tags',
  'wikipedia_url',
  'image_url',
  'dimension',
  'materialLevel',
  'naturalOrigin',
  'chemicalNature',
  'origin_type',
  'nature_type',
] as const;

export type SuggestionRow = {
  id: string;
  user_id: string | null;
  contributor_ip?: string | null;
  suggestion_type: string;
  status: string;
  node_id: string | null;
  data: Record<string, unknown>;
  admin_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
};

/** Nœud Tree lié à une ligne suggestion (pour lien « voir »). */
export function getExploreNodeId(
  row: Pick<SuggestionRow, 'node_id' | 'suggestion_type' | 'data'>
): string | null {
  const top = row.node_id?.trim();
  if (top) return top;
  if (row.suggestion_type === 'anonymous_feedback') {
    const d = row.data as { node_id?: string };
    if (typeof d.node_id === 'string' && d.node_id.trim()) return d.node_id.trim();
  }
  return null;
}

export function stripLinkEditsFromPayload(o: Record<string, unknown>) {
  const rest = { ...o };
  delete rest.linkEdits;
  return rest;
}

export function formatLinkSnapLine(
  s: LinkSnap,
  relLabel: (code: string) => string
): string {
  const rel = relLabel(s.relation_type) ?? s.relation_type;
  const n = s.notes?.trim() || '—';
  return `${rel} · ${n}`;
}

export type AdminEditNodeLinkListsOverride = {
  removedLinkIds?: string[];
  proposedAddLinks?: Array<{
    source_id: string;
    target_id: string;
    relation_type: RelationType;
    section?: 'ledTo' | 'builtUpon';
  }>;
};

export function sanitizeAdminProposedAddLinks(
  raw: unknown
): NonNullable<AdminEditNodeLinkListsOverride['proposedAddLinks']> {
  if (!Array.isArray(raw)) return [];
  const out: NonNullable<AdminEditNodeLinkListsOverride['proposedAddLinks']> =
    [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const source_id = typeof o.source_id === 'string' ? o.source_id : '';
    const target_id = typeof o.target_id === 'string' ? o.target_id : '';
    const rel = String(o.relation_type ?? '');
    if (!source_id || !target_id || !VALID_RELATIONS.has(rel)) continue;
    const entry: (typeof out)[0] = {
      source_id,
      target_id,
      relation_type: rel as (typeof out)[0]['relation_type'],
    };
    if (o.section === 'ledTo' || o.section === 'builtUpon') {
      entry.section = o.section;
    }
    out.push(entry);
  }
  return out;
}

/** Brouillon initial pour la page détail (fusion original + proposé pour edit_node). */
export function initSuggestionEditDraft(
  row: Pick<SuggestionRow, 'suggestion_type' | 'data' | 'node_id'>
): Record<string, unknown> | null {
  if (row.suggestion_type === 'edit_node') {
    const d = row.data as {
      original?: Record<string, unknown>;
      proposed?: Record<string, unknown>;
      removedLinkIds?: unknown;
      proposedAddLinks?: unknown;
    };
    const proposedFull = { ...(d.proposed ?? {}) };
    const linkEdits = proposedFull.linkEdits;
    const proposedNoLe = stripLinkEditsFromPayload(proposedFull);
    const origNoLe = stripLinkEditsFromPayload(d.original ?? {});
    const merged = { ...origNoLe, ...proposedNoLe };
    const draft: Record<string, unknown> = { ...merged };
    if (linkEdits && typeof linkEdits === 'object') {
      draft.linkEdits = linkEdits;
    }
    draft[ADMIN_DRAFT_REMOVED_IDS] = Array.isArray(d.removedLinkIds)
      ? d.removedLinkIds.map((x) => String(x))
      : [];
    draft[ADMIN_DRAFT_PROPOSED_ADD] = Array.isArray(d.proposedAddLinks)
      ? d.proposedAddLinks.map((x) =>
          x && typeof x === 'object' ? { ...(x as Record<string, unknown>) } : {}
        )
      : [];
    return draft;
  }
  if (row.suggestion_type === 'add_link') {
    const d = row.data as {
      relation_type?: string;
      is_optional?: boolean;
      notes?: string | null;
    };
    return {
      relation_type: d.relation_type ?? RT.MATERIAL,
      is_optional: Boolean(d.is_optional),
      notes: typeof d.notes === 'string' ? d.notes : '',
    };
  }
  if (row.suggestion_type === 'new_node') {
    const d = row.data as {
      node: Record<string, unknown>;
      link?: Record<string, unknown>;
      links?: unknown[];
    };
    const links = Array.isArray(d.links)
      ? d.links.map((x) =>
          x && typeof x === 'object' ? { ...(x as Record<string, unknown>) } : {}
        )
      : d.link
        ? [d.link]
        : [];
    return {
      node: { ...d.node },
      link: d.link ? { ...d.link } : {},
      links,
    };
  }
  return {};
}

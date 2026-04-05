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

/** Évite qu’un `proposedAddLinks` mal placé dans `proposed` pollue le diff nœud. */
export function stripProposedAddLinksFromPayload(o: Record<string, unknown>) {
  const rest = { ...o };
  delete rest.proposedAddLinks;
  return rest;
}

/** Texte libre laissé par le contributeur (correction, ajout de carte, etc.). Retours anonymes : `data.message`. */
export function getContributorFacingMessageFromSuggestion(
  row: Pick<SuggestionRow, 'suggestion_type' | 'data'>
): string | null {
  const data = row.data;
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (row.suggestion_type === 'anonymous_feedback') {
    const msg = d.message;
    return typeof msg === 'string' && msg.trim() ? msg.trim() : null;
  }
  const m = d.contributorMessage;
  if (typeof m === 'string' && m.trim()) return m.trim();
  return null;
}

/** E-mail de contact optionnel (suggestion anonyme / non connecté). */
export function getContributorContactHintFromSuggestion(
  row: Pick<SuggestionRow, 'data'>
): string | null {
  const data = row.data;
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const c = d.contactEmail ?? d.email;
  if (typeof c === 'string' && c.includes('@')) return c.trim().slice(0, 320);
  return null;
}

/**
 * Texte d’explication agrégé pour les suggestions générées par l’IA (panneau admin).
 * Ne remplace pas `contributorMessage` (contributeurs humains).
 */
export function getAiExplanationFromSuggestion(
  row: Pick<SuggestionRow, 'suggestion_type' | 'data'>
): string | null {
  const data = row.data;
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.source !== 'ai') return null;

  const parts: string[] = [];

  if (row.suggestion_type === 'ai_review') {
    const ar = d.ai_review as Record<string, unknown> | undefined;
    if (ar && typeof ar === 'object') {
      const low = ar.low_confidence_warning;
      if (low === true) {
        parts.push(
          'Confiance faible : une vérification humaine approfondie est recommandée.'
        );
      }
      const conf = ar.confidence;
      if (typeof conf === 'number' && Number.isFinite(conf)) {
        parts.push(`Confiance estimée : ${Math.round(conf * 100)} %.`);
      }
      const raw = ar.raw_issues as
        | Array<{ reason?: string; field?: string }>
        | undefined;
      if (Array.isArray(raw)) {
        for (const issue of raw) {
          const r = issue?.reason;
          if (typeof r === 'string' && r.trim()) parts.push(r.trim());
        }
      }
      const un = ar.unresolved_missing_links as
        | Array<{ reason?: string; suggested_name?: string; type?: string }>
        | undefined;
      if (Array.isArray(un)) {
        for (const u of un) {
          const name = typeof u.suggested_name === 'string' ? u.suggested_name : '';
          const rs = typeof u.reason === 'string' ? u.reason : '';
          const bit = [name, rs].filter(Boolean).join(' — ');
          if (bit) parts.push(`Lien suggéré non résolu : ${bit}`);
        }
      }
      const suspects = ar.raw_suspect_links as
        | Array<{ reason?: string; link_id?: string }>
        | undefined;
      if (Array.isArray(suspects)) {
        for (const s of suspects) {
          const r = s?.reason;
          if (typeof r === 'string' && r.trim()) {
            parts.push(`Suppression de lien proposée : ${r.trim()}`);
          }
        }
      }
    }
  }

  if (row.suggestion_type === 'enrichment') {
    const em = d.enrichment_meta as {
      notes?: string;
      confidence?: number | null;
    } | null;
    if (em && typeof em === 'object') {
      if (typeof em.notes === 'string' && em.notes.trim()) {
        parts.push(em.notes.trim());
      }
      if (typeof em.confidence === 'number' && Number.isFinite(em.confidence)) {
        parts.push(`Confiance estimée : ${Math.round(em.confidence * 100)} %.`);
      }
    }
  }

  if (row.suggestion_type === 'delete_link') {
    const r = d.ai_reason;
    if (typeof r === 'string' && r.trim()) parts.push(r.trim());
  }

  if (parts.length === 0) return null;
  return parts.join('\n\n');
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
    notes?: string | null;
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
    if (typeof o.notes === 'string' && o.notes.trim()) {
      entry.notes = o.notes.trim();
    }
    out.push(entry);
  }
  return out;
}

export function isEditNodeSuggestionType(
  suggestionType: string
): boolean {
  return (
    suggestionType === 'edit_node' ||
    suggestionType === 'ai_review' ||
    suggestionType === 'enrichment'
  );
}

/** Brouillon initial pour la page détail (fusion original + proposé pour edit_node). */
export function initSuggestionEditDraft(
  row: Pick<SuggestionRow, 'suggestion_type' | 'data' | 'node_id'>
): Record<string, unknown> | null {
  if (isEditNodeSuggestionType(row.suggestion_type)) {
    const d = row.data as {
      original?: Record<string, unknown>;
      proposed?: Record<string, unknown>;
      removedLinkIds?: unknown;
      proposedAddLinks?: unknown;
    };
    const proposedFull = { ...(d.proposed ?? {}) };
    const linkEdits = proposedFull.linkEdits;
    const proposedNoLe = stripProposedAddLinksFromPayload(
      stripLinkEditsFromPayload(proposedFull)
    );
    const origNoLe = stripProposedAddLinksFromPayload(
      stripLinkEditsFromPayload(d.original ?? {})
    );
    const merged = { ...origNoLe, ...proposedNoLe };
    const draft: Record<string, unknown> = { ...merged };
    if (linkEdits && typeof linkEdits === 'object') {
      draft.linkEdits = linkEdits;
    }
    draft[ADMIN_DRAFT_REMOVED_IDS] = Array.isArray(d.removedLinkIds)
      ? d.removedLinkIds.map((x) => String(x))
      : [];
    const nestedAdds = (() => {
      const p = d.proposed;
      if (!p || typeof p !== 'object') return [];
      const pa = (p as { proposedAddLinks?: unknown }).proposedAddLinks;
      return Array.isArray(pa) ? pa : [];
    })();
    const topAdds = Array.isArray(d.proposedAddLinks) ? d.proposedAddLinks : [];
    const addsRaw = topAdds.length ? topAdds : nestedAdds;
    draft[ADMIN_DRAFT_PROPOSED_ADD] = addsRaw.map((x) =>
      x && typeof x === 'object' ? { ...(x as Record<string, unknown>) } : {}
    );
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

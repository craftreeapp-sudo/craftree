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

/** Quand `section` manque (ex. ai_review), déduit ledTo / builtUpon depuis source_id / target_id. */
export function inferProposedAddSection(
  nodeId: string | null | undefined,
  add: Record<string, unknown>
): 'ledTo' | 'builtUpon' | undefined {
  const s = add.section;
  if (s === 'ledTo' || s === 'builtUpon') return s;
  const nid = nodeId?.trim();
  if (!nid) return undefined;
  const src = String(add.source_id ?? '').trim();
  const tgt = String(add.target_id ?? '').trim();
  if (src === nid) return 'ledTo';
  if (tgt === nid) return 'builtUpon';
  return undefined;
}

/**
 * Suggestions IA sans carte résolue dans le graphe : stockées dans `ai_review.unresolved_missing_links`,
 * pas dans `proposedAddLinks`. On les ajoute au brouillon pour l’UI d’approbation (affichage + retrait ×).
 */
export function mergeUnresolvedMissingIntoProposedAdds(
  suggestionData: Record<string, unknown>,
  resolvedAdds: Record<string, unknown>[]
): Record<string, unknown>[] {
  const ar = suggestionData.ai_review as
    | { unresolved_missing_links?: unknown }
    | undefined;
  const raw = ar?.unresolved_missing_links;
  if (!Array.isArray(raw) || raw.length === 0) return resolvedAdds;
  const out = [...resolvedAdds];
  for (const u of raw) {
    if (!u || typeof u !== 'object') continue;
    const o = u as Record<string, unknown>;
    const name = String(o.suggested_name ?? '').trim();
    if (!name) continue;
    const reason =
      o.reason != null && String(o.reason).trim()
        ? String(o.reason).trim()
        : '';
    const secRaw = String(o.section ?? 'built_upon').toLowerCase();
    const section: 'ledTo' | 'builtUpon' =
      secRaw === 'led_to' || secRaw === 'ledto' ? 'ledTo' : 'builtUpon';
    const logicalId =
      typeof o.id === 'string' && o.id.trim() ? o.id.trim() : undefined;
    out.push({
      unresolved: true,
      suggested_name: name,
      ...(logicalId ? { logical_id: logicalId } : {}),
      section,
      relation_type: RT.MATERIAL,
      notes: reason ? `AI: ${reason}` : null,
    });
  }
  return out;
}

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

/** Clé de champ issue IA normalisée (alignée sur `applyIssueToProposed`). */
export function normalizeAiReviewFieldKey(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw.toLowerCase().trim().replace(/\s+/g, '_');
}

/**
 * Clé de message `admin.*` pour le libellé d’un champ (ex. `field_dimension`).
 * `null` → utiliser `rawField` ou le libellé générique.
 */
export function adminFieldMessageKeyForAiExplanation(
  normalizedFieldKey: string
): string | null {
  const m: Record<string, string> = {
    dimension: 'field_dimension',
    material_level: 'field_materialLevel',
    materiallevel: 'field_materialLevel',
    year_approx: 'field_year_approx',
    year: 'field_year_approx',
    natural_origin: 'field_naturalOrigin',
    chemical_nature: 'field_chemicalNature',
    category: 'field_category',
    era: 'field_era',
    name: 'field_name',
    name_en: 'field_name_en',
    origin: 'field_origin',
    description: 'field_description',
    description_en: 'field_description_en',
    tags: 'field_tags',
    wikipedia_url: 'field_wikipedia_url',
    image_url: 'field_image_url',
    delete_link: 'aiExplanationDeleteLinkField',
  };
  return m[normalizedFieldKey] ?? null;
}

export type AiExplanationFieldBlock = {
  /** Clé normalisée ; vide si inconnu. */
  fieldKey: string;
  /** Valeur `field` brute renvoyée par le modèle (affichage secours). */
  rawField?: string;
  text: string;
};

export type AiExplanationLinkBlock = {
  kind: 'unresolved_add' | 'suspect_remove';
  /** Nom suggéré (lien non résolu) ; vide pour une suppression. */
  title: string;
  body: string;
};

export type AiExplanationBlocks = {
  /** Confiance / alertes — hors champs et hors liens. */
  preamble: string[];
  fieldBlocks: AiExplanationFieldBlock[];
  linkBlocks: AiExplanationLinkBlock[];
};

function aiExplanationBlocksIsEmpty(b: AiExplanationBlocks): boolean {
  return (
    b.preamble.length === 0 &&
    b.fieldBlocks.length === 0 &&
    b.linkBlocks.length === 0
  );
}

/**
 * Structure l’explication IA pour le panneau admin (sections champs vs liens).
 */
export function getAiExplanationBlocksFromSuggestion(
  row: Pick<SuggestionRow, 'suggestion_type' | 'data'>
): AiExplanationBlocks | null {
  const data = row.data;
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.source !== 'ai') return null;

  const preamble: string[] = [];
  const fieldBlocks: AiExplanationFieldBlock[] = [];
  const linkBlocks: AiExplanationLinkBlock[] = [];

  if (row.suggestion_type === 'ai_review') {
    const ar = d.ai_review as Record<string, unknown> | undefined;
    if (ar && typeof ar === 'object') {
      const low = ar.low_confidence_warning;
      if (low === true) {
        preamble.push(
          'Confiance faible : une vérification humaine approfondie est recommandée.'
        );
      }
      const conf = ar.confidence;
      if (typeof conf === 'number' && Number.isFinite(conf)) {
        preamble.push(`Confiance estimée : ${Math.round(conf * 100)} %.`);
      }
      const raw = ar.raw_issues as
        | Array<{ reason?: string; field?: string }>
        | undefined;
      if (Array.isArray(raw)) {
        for (const issue of raw) {
          const r = issue?.reason;
          if (typeof r !== 'string' || !r.trim()) continue;
          const rawF =
            typeof issue.field === 'string' && issue.field.trim()
              ? issue.field.trim()
              : undefined;
          const fk = normalizeAiReviewFieldKey(issue.field);
          fieldBlocks.push({
            fieldKey: fk,
            rawField: rawF,
            text: r.trim(),
          });
        }
      }
      const suspects = ar.raw_suspect_links as
        | Array<{ reason?: string; link_id?: string }>
        | undefined;
      if (Array.isArray(suspects)) {
        for (const s of suspects) {
          const r = s?.reason;
          if (typeof r === 'string' && r.trim()) {
            linkBlocks.push({
              kind: 'suspect_remove',
              title: '',
              body: r.trim(),
            });
          }
        }
      }
      const un = ar.unresolved_missing_links as
        | Array<{ reason?: string; suggested_name?: string; type?: string }>
        | undefined;
      if (Array.isArray(un)) {
        for (const u of un) {
          const name = typeof u.suggested_name === 'string' ? u.suggested_name : '';
          const rs = typeof u.reason === 'string' ? u.reason : '';
          if (!name.trim() && !rs.trim()) continue;
          linkBlocks.push({
            kind: 'unresolved_add',
            title: name.trim(),
            body: rs.trim(),
          });
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
        preamble.push(em.notes.trim());
      }
      if (typeof em.confidence === 'number' && Number.isFinite(em.confidence)) {
        preamble.push(`Confiance estimée : ${Math.round(em.confidence * 100)} %.`);
      }
    }
  }

  if (row.suggestion_type === 'delete_link') {
    const r = d.ai_reason;
    if (typeof r === 'string' && r.trim()) {
      fieldBlocks.push({
        fieldKey: 'delete_link',
        text: r.trim(),
      });
    }
  }

  const blocks: AiExplanationBlocks = { preamble, fieldBlocks, linkBlocks };
  if (aiExplanationBlocksIsEmpty(blocks)) return null;
  return blocks;
}

function formatAiExplanationBlocksAsPlainText(b: AiExplanationBlocks): string {
  const parts: string[] = [...b.preamble];
  for (const f of b.fieldBlocks) {
    parts.push(f.text);
  }
  for (const l of b.linkBlocks) {
    if (l.kind === 'unresolved_add') {
      const bit = [l.title, l.body].filter(Boolean).join(' — ');
      if (bit) parts.push(`Lien suggéré non résolu : ${bit}`);
    } else {
      parts.push(`Suppression de lien proposée : ${l.body}`);
    }
  }
  return parts.join('\n\n');
}

/**
 * Texte d’explication agrégé pour les suggestions générées par l’IA (panneau admin).
 * Ne remplace pas `contributorMessage` (contributeurs humains).
 */
export function getAiExplanationFromSuggestion(
  row: Pick<SuggestionRow, 'suggestion_type' | 'data'>
): string | null {
  const b = getAiExplanationBlocksFromSuggestion(row);
  if (!b) return null;
  return formatAiExplanationBlocksAsPlainText(b);
}

export function formatLinkSnapLine(
  s: LinkSnap,
  relLabel: (code: string, peerId?: string) => string,
  peerId?: string
): string {
  const rel = relLabel(s.relation_type, peerId) ?? s.relation_type;
  const n = s.notes?.trim() || '—';
  return `${rel} · ${n}`;
}

/** Entrées « sans UUID » (brouillon admin) : à la résolution par nom ou création de fiche à l’approbation. */
export type AdminUnresolvedPeerCreate = {
  suggested_name: string;
  /** Id logique issu de missing_nodes (ex. mn_a), pour missing_edges à l’approbation. */
  logical_id?: string;
  section?: 'ledTo' | 'builtUpon';
  relation_type: RelationType;
  notes?: string | null;
};

export type AdminEditNodeLinkListsOverride = {
  removedLinkIds?: string[];
  proposedAddLinks?: Array<{
    source_id: string;
    target_id: string;
    relation_type: RelationType;
    section?: 'ledTo' | 'builtUpon';
    notes?: string | null;
    is_optional?: boolean;
  }>;
  proposedUnresolvedPeers?: AdminUnresolvedPeerCreate[];
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
    if (o.unresolved === true) continue;
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
    if (o.is_optional === true) {
      entry.is_optional = true;
    }
    out.push(entry);
  }
  return out;
}

/** Extrait les lignes `unresolved` du brouillon pour l’API d’approbation (non filtrées par sanitize). */
export function extractUnresolvedPeerCreatesFromDraftAdds(
  raw: unknown
): AdminUnresolvedPeerCreate[] {
  if (!Array.isArray(raw)) return [];
  const out: AdminUnresolvedPeerCreate[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    if (o.unresolved !== true) continue;
    const suggested_name = String(o.suggested_name ?? '').trim();
    if (!suggested_name) continue;
    const rel = String(o.relation_type ?? '');
    if (!VALID_RELATIONS.has(rel)) continue;
    const entry: AdminUnresolvedPeerCreate = {
      suggested_name,
      relation_type: rel as RelationType,
    };
    if (typeof o.logical_id === 'string' && o.logical_id.trim()) {
      entry.logical_id = o.logical_id.trim();
    }
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
    const dataObj = row.data as Record<string, unknown>;
    const mappedAdds = addsRaw.map((x) => {
      const o =
        x && typeof x === 'object'
          ? { ...(x as Record<string, unknown>) }
          : {};
      if (o.section !== 'ledTo' && o.section !== 'builtUpon') {
        const inf = inferProposedAddSection(row.node_id, o);
        if (inf) o.section = inf;
      }
      return o;
    });
    draft[ADMIN_DRAFT_PROPOSED_ADD] =
      mergeUnresolvedMissingIntoProposedAdds(dataObj, mappedAdds);
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

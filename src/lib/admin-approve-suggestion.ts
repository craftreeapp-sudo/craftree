import { buildSupabaseNodePatchFromBody } from '@/lib/admin-node-patch';
import {
  FULL_NODES_SELECT,
  FULL_NODES_SELECT_LEGACY,
  fetchAllLinkRowsPaginated,
  isMissingNatureColumnsError,
  mapNodeRowToSeedNode,
} from '@/lib/data';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { notifyContributorSuggestionResult } from '@/lib/notify-contributor-suggestion';
import { dimensionMaterialLevelFromCreateBody } from '@/lib/node-dimension';
import {
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';
import { slugify } from '@/lib/utils';
import { fetchWikipediaThumbnailUrl } from '@/lib/wikipedia-thumb';
import type { AdminEditNodeLinkListsOverride } from '@/lib/admin-suggestion-shared';
import type { RelationType } from '@/lib/types';

export type { AdminEditNodeLinkListsOverride };

function nextLinkIdFromRows(rows: { id: string }[]): string {
  let max = 0;
  for (const l of rows) {
    const m = /^l(\d+)$/.exec(l.id);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `l${max + 1}`;
}

/** Max suffix `l{n}` sur toutes les lignes (PostgREST limite ~1000 lignes par requête sans pagination). */
function maxNumericLinkSuffixFromRows(rows: { id: string }[]): number {
  let max = 0;
  for (const l of rows) {
    const m = /^l(\d+)$/.exec(l.id);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max;
}

async function nextLinkId(sb: ReturnType<typeof createSupabaseServiceRoleClient>) {
  const rows = (await fetchAllLinkRowsPaginated(sb, 'id')) as { id: string }[];
  return nextLinkIdFromRows(rows);
}

async function uniqueNodeId(
  sb: ReturnType<typeof createSupabaseServiceRoleClient>,
  base: string
): Promise<string> {
  const { data: nodes } = await sb.from('nodes').select('id');
  const existing = new Set((nodes ?? []).map((n: { id: string }) => n.id));
  let id = slugify(base);
  if (!id) id = 'node';
  if (!existing.has(id)) return id;
  let n = 2;
  while (existing.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

type SuggestLinkSnapshot = {
  id: string;
  relation_type: string;
  notes: string;
  is_optional: boolean;
};

type EditNodeData = {
  original: Record<string, unknown>;
  proposed: Record<string, unknown>;
  diff?: Record<string, unknown>;
};

export async function applyApprovedSuggestion(
  suggestionId: string,
  options?: {
    overrideProposed?: Record<string, unknown>;
    /** Si défini (ex. approbation depuis « Modifier puis approuver »), remplace les tableaux de liens de la suggestion. */
    overrideEditNodeLinkLists?: AdminEditNodeLinkListsOverride;
    /** Commentaire admin (email contributeur, colonne `suggestions.admin_comment`). */
    adminComment?: string | null;
  }
): Promise<void> {
  const sb = createSupabaseServiceRoleClient();
  const { data: row, error: fetchErr } = await sb
    .from('suggestions')
    .select('*')
    .eq('id', suggestionId)
    .single();

  if (fetchErr || !row) {
    throw new Error('Suggestion introuvable');
  }

  const status = String(row.status);
  if (status !== 'pending') {
    throw new Error('Suggestion déjà traitée');
  }

  const type = String(row.suggestion_type);
  const data = row.data as Record<string, unknown>;

  if (type === 'edit_node') {
    const nodeId = row.node_id as string | null;
    if (!nodeId) throw new Error('node_id manquant');

    const edit = data as unknown as EditNodeData;
    let proposed = { ...(edit.proposed as Record<string, unknown>) };
    if (options?.overrideProposed) {
      proposed = { ...proposed, ...options.overrideProposed };
    }

    const linkEdits = proposed.linkEdits as
      | Record<string, SuggestLinkSnapshot>
      | undefined;
    if (proposed.linkEdits !== undefined) {
      delete proposed.linkEdits;
    }

    let { data: prevRow, error: prevErr } = await sb
      .from('nodes')
      .select(FULL_NODES_SELECT as never)
      .eq('id', nodeId)
      .maybeSingle();
    if (prevErr && isMissingNatureColumnsError(prevErr)) {
      const second = await sb
        .from('nodes')
        .select(FULL_NODES_SELECT_LEGACY as never)
        .eq('id', nodeId)
        .maybeSingle();
      prevRow = second.data;
      prevErr = second.error;
    }
    if (prevErr || !prevRow) {
      throw new Error('Nœud introuvable');
    }
    const cur = mapNodeRowToSeedNode(prevRow as unknown as Record<string, unknown>);
    const patch = buildSupabaseNodePatchFromBody(proposed, cur);

    let { error: upErr } = await sb.from('nodes').update(patch).eq('id', nodeId);

    if (upErr && isMissingNatureColumnsError(upErr)) {
      const patchLegacy = { ...patch };
      delete patchLegacy.natural_origin;
      delete patchLegacy.chemical_nature;
      const second = await sb
        .from('nodes')
        .update(patchLegacy)
        .eq('id', nodeId);
      upErr = second.error;
    }

    if (upErr) throw upErr;

    const listsOverride = options?.overrideEditNodeLinkLists;
    const removedLinkIds =
      listsOverride &&
      Object.prototype.hasOwnProperty.call(listsOverride, 'removedLinkIds')
        ? Array.isArray(listsOverride.removedLinkIds)
          ? listsOverride.removedLinkIds.filter(
              (x): x is string => typeof x === 'string' && x.length > 0
            )
          : []
        : Array.isArray((data as { removedLinkIds?: unknown }).removedLinkIds)
          ? ((data as { removedLinkIds: string[] }).removedLinkIds as string[])
          : [];

    for (const linkId of removedLinkIds) {
      const { data: linkRow, error: linkFetchErr } = await sb
        .from('links')
        .select('source_id, target_id')
        .eq('id', linkId)
        .maybeSingle();
      if (linkFetchErr || !linkRow) continue;
      const lr = linkRow as { source_id: string; target_id: string };
      if (lr.source_id !== nodeId && lr.target_id !== nodeId) continue;
      const { error: delErr } = await sb.from('links').delete().eq('id', linkId);
      if (delErr) throw delErr;
    }

    if (linkEdits && typeof linkEdits === 'object') {
      for (const [linkId, snap] of Object.entries(linkEdits)) {
        const s = snap as SuggestLinkSnapshot;
        if (!s?.id || s.id !== linkId) continue;
        const { data: linkRow, error: linkFetchErr } = await sb
          .from('links')
          .select('source_id, target_id')
          .eq('id', linkId)
          .maybeSingle();
        if (linkFetchErr || !linkRow) continue;
        const lr = linkRow as { source_id: string; target_id: string };
        if (lr.source_id !== nodeId && lr.target_id !== nodeId) continue;

        const n =
          typeof s.notes === 'string' && s.notes.trim() === ''
            ? null
            : (s.notes ?? null);

        const { error: luErr } = await sb
          .from('links')
          .update({
            relation_type: s.relation_type,
            is_optional: Boolean(s.is_optional),
            notes: n,
          })
          .eq('id', linkId);
        if (luErr) throw luErr;
      }
    }

    const proposedAddRaw =
      listsOverride &&
      Object.prototype.hasOwnProperty.call(listsOverride, 'proposedAddLinks')
        ? listsOverride.proposedAddLinks
        : (data as { proposedAddLinks?: unknown }).proposedAddLinks;
    const proposedAddLinks = Array.isArray(proposedAddRaw)
      ? (proposedAddRaw as {
          source_id: string;
          target_id: string;
          relation_type: RelationType;
        }[])
      : [];

    const validRelations = new Set<string>([
      'material',
      'tool',
      'energy',
      'knowledge',
      'catalyst',
    ]);

    for (const add of proposedAddLinks) {
      if (!add?.source_id || !add?.target_id) continue;
      if (add.source_id !== nodeId && add.target_id !== nodeId) continue;
      const rel = String(add.relation_type ?? '');
      if (!validRelations.has(rel)) continue;

      const { data: dup } = await sb
        .from('links')
        .select('id')
        .eq('source_id', add.source_id)
        .eq('target_id', add.target_id)
        .maybeSingle();
      if (dup) continue;

      const newId = await nextLinkId(sb);
      const { error: insNewErr } = await sb.from('links').insert({
        id: newId,
        source_id: add.source_id,
        target_id: add.target_id,
        relation_type: rel as RelationType,
        is_optional: false,
        notes: null,
      });
      if (insNewErr) throw insNewErr;
    }
  } else if (type === 'add_link') {
    let d = data as {
      source_id: string;
      target_id: string;
      relation_type: RelationType;
      is_optional?: boolean;
      notes?: string | null;
    };
    if (options?.overrideProposed && typeof options.overrideProposed === 'object') {
      d = { ...d, ...(options.overrideProposed as typeof d) };
    }
    const id = await nextLinkId(sb);
    const { error: insErr } = await sb.from('links').insert({
      id,
      source_id: d.source_id,
      target_id: d.target_id,
      relation_type: d.relation_type,
      is_optional: d.is_optional ?? false,
      notes: d.notes ?? null,
    });
    if (insErr) throw insErr;
  } else if (type === 'new_node') {
    type NewNodePayload = {
      node: {
        name: string;
        name_en?: string;
        category: string;
        type?: string;
        era: string;
        year_approx?: number | null;
        origin?: string | null;
        description?: string;
        description_en?: string | null;
        proposed_id?: string;
        tags?: string[];
        wikipedia_url?: string | null;
        image_url?: string | null;
        dimension?: string | null;
        materialLevel?: string | null;
        naturalOrigin?: string | null;
        chemicalNature?: string | null;
        origin_type?: string | null;
        nature_type?: string | null;
      };
      link?: {
        source_id: string;
        target_id: string;
        relation_type: RelationType;
      };
      /** Liens additionnels (même schéma que `link`, id du nœud proposé = `proposed_id`). */
      links?: {
        source_id: string;
        target_id: string;
        relation_type: RelationType;
      }[];
    };

    let d = data as unknown as NewNodePayload;
    if (options?.overrideProposed && typeof options.overrideProposed === 'object') {
      const o = options.overrideProposed as Partial<NewNodePayload>;
      d = {
        node: { ...d.node, ...(o.node ?? {}) },
        link:
          o.link !== undefined
            ? { ...(d.link ?? {}), ...o.link }
            : d.link,
        links: o.links !== undefined ? o.links : d.links,
      };
    }

    let nodeId =
      (d.node.proposed_id && d.node.proposed_id.trim()) ||
      slugify(d.node.name) ||
      'node';
    const { data: clash } = await sb
      .from('nodes')
      .select('id')
      .eq('id', nodeId)
      .maybeSingle();
    if (clash) {
      nodeId = await uniqueNodeId(sb, d.node.name);
    }

    let dm = dimensionMaterialLevelFromCreateBody({
      dimension: d.node.dimension,
      materialLevel: d.node.materialLevel,
    });
    if (dm.dimension === null) {
      dm = { dimension: 'matter', materialLevel: 'component' };
    }

    const tags = Array.isArray(d.node.tags)
      ? (d.node.tags as unknown[]).map(String)
      : [];

    const nameEn =
      typeof d.node.name_en === 'string' && d.node.name_en.trim()
        ? d.node.name_en.trim()
        : d.node.name;

    const wiki =
      d.node.wikipedia_url &&
      typeof d.node.wikipedia_url === 'string' &&
      d.node.wikipedia_url.trim()
        ? d.node.wikipedia_url.trim()
        : null;

    let imageUrl: string | null =
      d.node.image_url &&
      typeof d.node.image_url === 'string' &&
      d.node.image_url.trim()
        ? d.node.image_url.trim()
        : null;
    if (!imageUrl && wiki) {
      imageUrl = await fetchWikipediaThumbnailUrl(wiki);
    }

    const naturalOrigin = parseNaturalOrigin(
      typeof d.node.naturalOrigin === 'string'
        ? d.node.naturalOrigin
        : undefined
    );
    const chemicalNature = parseChemicalNature(
      typeof d.node.chemicalNature === 'string'
        ? d.node.chemicalNature
        : undefined
    );

    const descEn =
      typeof d.node.description_en === 'string'
        ? d.node.description_en.trim()
        : '';

    const otRaw = d.node.origin_type;
    const ntRaw = d.node.nature_type;
    const originTypeVal =
      otRaw === null || otRaw === ''
        ? null
        : typeof otRaw === 'string' &&
            ['mineral', 'vegetal', 'animal'].includes(otRaw)
          ? otRaw
          : null;
    const natureTypeVal =
      ntRaw === null || ntRaw === ''
        ? null
        : typeof ntRaw === 'string' &&
            ['element', 'compose', 'materiau'].includes(ntRaw)
          ? ntRaw
          : null;

    const insertRow = {
      id: nodeId,
      name: d.node.name,
      name_en: nameEn,
      description: d.node.description ?? '',
      description_en: descEn || null,
      category: d.node.category,
      era: d.node.era,
      year_approx: d.node.year_approx ?? null,
      origin: d.node.origin ?? null,
      tags,
      complexity_depth: 0,
      updated_at: new Date().toISOString(),
      wikipedia_url: wiki,
      image_url: imageUrl,
      dimension: dm.dimension,
      material_level: dm.materialLevel,
      natural_origin: naturalOrigin === '' ? null : naturalOrigin,
      chemical_nature: chemicalNature === '' ? null : chemicalNature,
      origin_type: originTypeVal,
      nature_type: natureTypeVal,
    };

    let firstIns = await sb.from('nodes').insert(insertRow);
    let nErr = firstIns.error;

    if (nErr && isMissingNatureColumnsError(nErr)) {
      const {
        natural_origin: _no,
        chemical_nature: _cn,
        ...insertWithoutNature
      } = insertRow;
      const retry = await sb.from('nodes').insert(insertWithoutNature);
      nErr = retry.error;
    }

    if (
      nErr &&
      String((nErr as { message?: string }).message ?? '').includes(
        'origin_type'
      )
    ) {
      const {
        origin_type: _ot,
        nature_type: _nt,
        ...withoutOriginNature
      } = insertRow;
      const retry2 = await sb.from('nodes').insert(withoutOriginNature);
      nErr = retry2.error;
    }

    if (nErr) {
      throw nErr;
    }

    const ph = d.node.proposed_id?.trim() || '';
    const linkItems: {
      source_id: string;
      target_id: string;
      relation_type: RelationType;
    }[] = [];
    const seen = new Set<string>();
    const pushLink = (x: {
      source_id: string;
      target_id: string;
      relation_type: RelationType;
    }) => {
      const k = `${x.source_id}|${x.target_id}|${x.relation_type}`;
      if (seen.has(k)) return;
      seen.add(k);
      linkItems.push(x);
    };
    if (
      d.link &&
      typeof d.link.source_id === 'string' &&
      typeof d.link.target_id === 'string' &&
      d.link.source_id &&
      d.link.target_id &&
      d.link.relation_type
    ) {
      pushLink(d.link);
    }
    if (Array.isArray(d.links)) {
      for (const L of d.links) {
        if (
          L &&
          typeof L.source_id === 'string' &&
          typeof L.target_id === 'string' &&
          L.source_id &&
          L.target_id &&
          L.relation_type
        ) {
          pushLink(L);
        }
      }
    }

    const validRelations = new Set<string>([
      'material',
      'tool',
      'energy',
      'knowledge',
      'catalyst',
    ]);

    const existingLinkRows = (await fetchAllLinkRowsPaginated(
      sb,
      'id'
    )) as { id: string }[];
    let linkSuffix = maxNumericLinkSuffixFromRows(existingLinkRows);

    for (const link of linkItems) {
      const rel = String(link.relation_type);
      if (!validRelations.has(rel)) {
        throw new Error('relation_type invalide');
      }

      const src =
        ph && link.source_id === ph ? nodeId : link.source_id;
      const tgt =
        ph && link.target_id === ph ? nodeId : link.target_id;

      linkSuffix += 1;
      const linkId = `l${linkSuffix}`;
      const { error: lErr } = await sb.from('links').insert({
        id: linkId,
        source_id: src,
        target_id: tgt,
        relation_type: rel as RelationType,
        is_optional: false,
        notes: null,
      });
      if (lErr) throw lErr;
    }
  } else if (type === 'delete_link') {
    const linkId = String(data.link_id ?? '');
    if (!linkId) throw new Error('link_id manquant');
    const { error: delErr } = await sb.from('links').delete().eq('id', linkId);
    if (delErr) throw delErr;
  } else if (type === 'anonymous_feedback') {
    /* Pas d’application automatique : l’admin interprète le message. */
  } else {
    throw new Error(`Type de suggestion inconnu: ${type}`);
  }

  const hasAdminCommentKey =
    options !== undefined && Object.prototype.hasOwnProperty.call(options, 'adminComment');
  const adminCommentForRow = hasAdminCommentKey
    ? String(options!.adminComment ?? '').trim() || null
    : undefined;

  const { error: stErr } = await sb
    .from('suggestions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      ...(hasAdminCommentKey ? { admin_comment: adminCommentForRow ?? null } : {}),
    })
    .eq('id', suggestionId);
  if (stErr) throw stErr;

  const uid = row.user_id as string | null;
  const countsContribution =
    type === 'edit_node' ||
    type === 'new_node' ||
    type === 'add_link' ||
    type === 'delete_link';

  if (uid && countsContribution) {
    const { data: prof } = await sb
      .from('profiles')
      .select('contributions_count')
      .eq('id', uid)
      .maybeSingle();
    const cur = (prof as { contributions_count?: number } | null)?.contributions_count ?? 0;
    await sb
      .from('profiles')
      .update({ contributions_count: cur + 1 })
      .eq('id', uid);
  }

  console.log('[admin-approve] calling notifyContributorSuggestionResult', {
    status: 'approved',
    suggestionId: String(row.id),
  });
  await notifyContributorSuggestionResult({
    status: 'approved',
    row: {
      id: String(row.id),
      user_id: (row.user_id as string | null) ?? null,
      suggestion_type: String(row.suggestion_type),
      node_id: (row.node_id as string | null) ?? null,
      data: row.data,
    },
    adminComment: hasAdminCommentKey ? (adminCommentForRow ?? null) : null,
  });
}

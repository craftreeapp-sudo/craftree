import { buildSupabaseNodePatchFromBody } from '@/lib/admin-node-patch';
import {
  FULL_NODES_SELECT,
  FULL_NODES_SELECT_LEGACY,
  fetchAllLinkRowsPaginated,
  fetchAllNodeIdsSet,
  isMissingDraftColumnError,
  isMissingNatureColumnsError,
  mapNodeRowToSeedNode,
} from '@/lib/data';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { notifyContributorSuggestionResult } from '@/lib/notify-contributor-suggestion';
import { dimensionMaterialLevelFromCreateBody } from '@/lib/node-dimension';
import {
  naturalOriginAppToDb,
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';
import { slugify } from '@/lib/utils';
import { fetchWikipediaThumbnailUrl } from '@/lib/wikipedia-thumb';
import type {
  AdminEditNodeLinkListsOverride,
  AdminUnresolvedPeerCreate,
} from '@/lib/admin-suggestion-shared';
import type { RelationType, SeedNode } from '@/lib/types';
import { resolveNodeIdByName } from '@/lib/resolve-node-by-name';

export type { AdminEditNodeLinkListsOverride };

/** Résumé renvoyé à l’admin après application d’une suggestion (toasts / traçabilité). */
export type AdminApproveSummary = {
  suggestionType: string;
  /** Nouvelles fiches (new_node + pairs résolus par création). */
  nodesCreated: number;
  /** Au moins une fiche existante mise à jour (édition / enrichissement / revue IA). */
  nodeUpdated: boolean;
  linksInserted: number;
  linksUpdated: number;
  linksDeleted: number;
};

async function resolvePeerEdgeRef(
  sb: ReturnType<typeof createSupabaseServiceRoleClient>,
  ref: string,
  inventionId: string,
  logicalToUuid: Map<string, string>,
  nameToPeerId: Map<string, string>,
  logicalIdsMeta: Set<string>
): Promise<string | null> {
  const t = ref.trim();
  if (!t) return null;
  if (t === 'current') return inventionId;
  if (logicalToUuid.has(t)) return logicalToUuid.get(t)!;
  const tl = t.toLowerCase();
  if (nameToPeerId.has(tl)) return nameToPeerId.get(tl)!;
  if (logicalIdsMeta.has(t) && !logicalToUuid.has(t)) return null;
  const { data: row } = await sb
    .from('nodes')
    .select('id')
    .eq('id', t)
    .maybeSingle();
  if (row) return (row as { id: string }).id;
  return resolveNodeIdByName(sb, t);
}

function descriptionFromUnresolvedPeerNotes(
  notes: string | null | undefined
): string {
  if (!notes || !notes.trim()) return '';
  const t = notes.trim();
  if (t.toLowerCase().startsWith('ai:')) return t.slice(3).trim();
  return t;
}

async function insertMinimalPeerNodeFromParentRow(
  sb: ReturnType<typeof createSupabaseServiceRoleClient>,
  parentRow: Record<string, unknown>,
  suggestedName: string,
  aiNotesForDescription: string,
  parentSeed: SeedNode
): Promise<string> {
  const cur = parentSeed;
  let dm = dimensionMaterialLevelFromCreateBody({
    dimension: cur.dimension,
    materialLevel: cur.materialLevel,
  });
  if (dm.dimension === null) {
    dm = { dimension: 'matter', materialLevel: 'component' };
  }
  const nodeId = await uniqueNodeId(sb, suggestedName);

  const descTrim = aiNotesForDescription.trim();
  const description = descTrim
    ? `${suggestedName}\n\n${descTrim}`
    : `Carte créée lors de l’approbation d’une suggestion (lien avec « ${cur.name} »). À compléter : description détaillée, classification, sources et médias.`;

  const parsedParentNaturalOrigin = parseNaturalOrigin(
    (parentRow.natural_origin ?? parentRow.origin_type) as string | undefined
  );

  const insertRow = {
    id: nodeId,
    name: suggestedName,
    name_en: suggestedName,
    description,
    description_en: null as string | null,
    category: cur.category,
    type: String(cur.category),
    era: cur.era,
    year_approx: cur.year_approx ?? null,
    origin:
      parentRow.origin != null && String(parentRow.origin).trim()
        ? String(parentRow.origin)
        : null,
    tags: [] as string[],
    complexity_depth: 0,
    updated_at: new Date().toISOString(),
    wikipedia_url: null,
    image_url: null,
    dimension: dm.dimension,
    material_level: dm.materialLevel,
    /** CHECK SQL : mineral | vegetal | animal — pas la variante app « plant ». */
    natural_origin:
      parsedParentNaturalOrigin === ''
        ? null
        : naturalOriginAppToDb(parsedParentNaturalOrigin),
    chemical_nature:
      parseChemicalNature(
        (parentRow.chemical_nature ?? parentRow.nature_type) as
          | string
          | undefined
      ) || null,
    is_draft: true,
  };

  const rowForInsert: Record<string, unknown> = { ...insertRow };
  let attempt = await sb.from('nodes').insert(rowForInsert);
  let nErr = attempt.error;

  if (nErr && isMissingDraftColumnError(nErr)) {
    delete rowForInsert.is_draft;
    attempt = await sb.from('nodes').insert(rowForInsert);
    nErr = attempt.error;
  }

  if (nErr && isMissingNatureColumnsError(nErr)) {
    delete rowForInsert.natural_origin;
    delete rowForInsert.chemical_nature;
    attempt = await sb.from('nodes').insert(rowForInsert);
    nErr = attempt.error;
  }

  if (nErr) throw nErr;
  return nodeId;
}

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
  const existing = await fetchAllNodeIdsSet(sb);
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
): Promise<AdminApproveSummary> {
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

  const summary: AdminApproveSummary = {
    suggestionType: type,
    nodesCreated: 0,
    nodeUpdated: false,
    linksInserted: 0,
    linksUpdated: 0,
    linksDeleted: 0,
  };

  if (type === 'edit_node' || type === 'ai_review' || type === 'enrichment') {
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
    summary.nodeUpdated = true;

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
      summary.linksDeleted += 1;
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
        summary.linksUpdated += 1;
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
      'component',
      'tool',
      'energy',
      'process',
      'infrastructure',
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

      const addRec = add as {
        notes?: string | null;
      };
      const addNotes =
        typeof addRec.notes === 'string' && addRec.notes.trim() !== ''
          ? addRec.notes.trim()
          : null;

      const newId = await nextLinkId(sb);
      const addOpt = add as { is_optional?: boolean };
      const { error: insNewErr } = await sb.from('links').insert({
        id: newId,
        source_id: add.source_id,
        target_id: add.target_id,
        relation_type: rel as RelationType,
        is_optional: Boolean(addOpt.is_optional),
        notes: addNotes,
      });
      if (insNewErr) throw insNewErr;
      summary.linksInserted += 1;
    }

    const proposedUnresolvedRaw =
      listsOverride &&
      Object.prototype.hasOwnProperty.call(
        listsOverride,
        'proposedUnresolvedPeers'
      )
        ? listsOverride.proposedUnresolvedPeers
        : undefined;
    const proposedUnresolvedPeers: AdminUnresolvedPeerCreate[] = Array.isArray(
      proposedUnresolvedRaw
    )
      ? (proposedUnresolvedRaw as AdminUnresolvedPeerCreate[])
      : [];

    const seenUnresolvedKey = new Set<string>();
    const logicalToUuid = new Map<string, string>();
    const nameToPeerId = new Map<string, string>();
    for (const u of proposedUnresolvedPeers) {
      const name = String(u.suggested_name ?? '').trim();
      if (!name) continue;
      const section = u.section === 'builtUpon' ? 'builtUpon' : 'ledTo';
      const k = `${name.toLowerCase()}|${section}`;
      if (seenUnresolvedKey.has(k)) continue;
      seenUnresolvedKey.add(k);

      const peerResolved = await resolveNodeIdByName(sb, name);
      let peerId: string;
      if (peerResolved) {
        peerId = peerResolved;
      } else {
        peerId = await insertMinimalPeerNodeFromParentRow(
          sb,
          prevRow as unknown as Record<string, unknown>,
          name,
          descriptionFromUnresolvedPeerNotes(u.notes),
          cur
        );
        summary.nodesCreated += 1;
      }
      nameToPeerId.set(name.toLowerCase(), peerId);
      const lid = u.logical_id?.trim();
      if (lid) logicalToUuid.set(lid, peerId);

      const rel = String(u.relation_type ?? '');
      if (!validRelations.has(rel)) continue;

      const linkSource: string =
        section === 'ledTo' ? nodeId : peerId;
      const linkTarget: string =
        section === 'ledTo' ? peerId : nodeId;

      if (linkSource !== nodeId && linkTarget !== nodeId) continue;

      const { data: dupU } = await sb
        .from('links')
        .select('id')
        .eq('source_id', linkSource)
        .eq('target_id', linkTarget)
        .maybeSingle();
      if (dupU) continue;

      const uNotes =
        typeof u.notes === 'string' && u.notes.trim() !== ''
          ? u.notes.trim()
          : null;

      const newUnId = await nextLinkId(sb);
      const { error: insUnErr } = await sb.from('links').insert({
        id: newUnId,
        source_id: linkSource,
        target_id: linkTarget,
        relation_type: rel as RelationType,
        is_optional: false,
        notes: uNotes,
      });
      if (insUnErr) throw insUnErr;
      summary.linksInserted += 1;
    }

    const aiReview = (data as { ai_review?: Record<string, unknown> }).ai_review;
    const peerEdgesRaw = aiReview?.missing_edges;
    const missingNodesRaw = aiReview?.missing_nodes;
    const logicalIdsMeta = new Set<string>();
    if (Array.isArray(missingNodesRaw)) {
      for (const m of missingNodesRaw) {
        if (m && typeof m === 'object') {
          const id = String((m as Record<string, unknown>).id ?? '').trim();
          if (id) logicalIdsMeta.add(id);
        }
      }
    }
    if (Array.isArray(peerEdgesRaw)) {
      for (const e of peerEdgesRaw) {
        if (!e || typeof e !== 'object') continue;
        const o = e as Record<string, unknown>;
        const srcRef = String(o.source ?? '').trim();
        const tgtRef = String(o.target ?? '').trim();
        if (!srcRef || !tgtRef) continue;
        const rel = String(o.relation_type ?? 'material');
        if (!validRelations.has(rel)) continue;
        const srcId = await resolvePeerEdgeRef(
          sb,
          srcRef,
          nodeId,
          logicalToUuid,
          nameToPeerId,
          logicalIdsMeta
        );
        const tgtId = await resolvePeerEdgeRef(
          sb,
          tgtRef,
          nodeId,
          logicalToUuid,
          nameToPeerId,
          logicalIdsMeta
        );
        if (!srcId || !tgtId || srcId === tgtId) continue;
        const { data: dupE } = await sb
          .from('links')
          .select('id')
          .eq('source_id', srcId)
          .eq('target_id', tgtId)
          .maybeSingle();
        if (dupE) continue;
        const edgeNotes =
          o.notes != null && String(o.notes).trim()
            ? String(o.notes).trim()
            : null;
        const newEdgeId = await nextLinkId(sb);
        const { error: insEErr } = await sb.from('links').insert({
          id: newEdgeId,
          source_id: srcId,
          target_id: tgtId,
          relation_type: rel as RelationType,
          is_optional: false,
          notes: edgeNotes,
        });
        if (insEErr) throw insEErr;
        summary.linksInserted += 1;
      }
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
    summary.linksInserted = 1;
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
        /** @deprecated fusionné dans naturalOrigin / chemicalNature via parse* */
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
          o.links !== undefined
            ? undefined
            : o.link !== undefined
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
      typeof d.node.naturalOrigin === 'string' && d.node.naturalOrigin.trim()
        ? d.node.naturalOrigin
        : typeof d.node.origin_type === 'string'
          ? d.node.origin_type
          : undefined
    );
    const chemicalNature = parseChemicalNature(
      typeof d.node.chemicalNature === 'string' && d.node.chemicalNature.trim()
        ? d.node.chemicalNature
        : typeof d.node.nature_type === 'string'
          ? d.node.nature_type
          : undefined
    );

    const descEn =
      typeof d.node.description_en === 'string'
        ? d.node.description_en.trim()
        : '';

    /** Colonne legacy `nodes.type` (NOT NULL en base). */
    const nodeTypeLegacy =
      typeof d.node.type === 'string' && d.node.type.trim()
        ? d.node.type.trim()
        : String(d.node.category);

    const insertRow = {
      id: nodeId,
      name: d.node.name,
      name_en: nameEn,
      description: d.node.description ?? '',
      description_en: descEn || null,
      category: d.node.category,
      type: nodeTypeLegacy,
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
      natural_origin:
        naturalOrigin === '' ? null : naturalOriginAppToDb(naturalOrigin),
      chemical_nature: chemicalNature === '' ? null : chemicalNature,
      is_draft: true,
    };

    const newNodeRowForInsert: Record<string, unknown> = { ...insertRow };
    let attempt = await sb.from('nodes').insert(newNodeRowForInsert);
    let nErr = attempt.error;

    if (nErr && isMissingDraftColumnError(nErr)) {
      delete newNodeRowForInsert.is_draft;
      attempt = await sb.from('nodes').insert(newNodeRowForInsert);
      nErr = attempt.error;
    }

    if (nErr && isMissingNatureColumnsError(nErr)) {
      delete newNodeRowForInsert.natural_origin;
      delete newNodeRowForInsert.chemical_nature;
      attempt = await sb.from('nodes').insert(newNodeRowForInsert);
      nErr = attempt.error;
    }

    if (nErr) {
      throw nErr;
    }
    summary.nodesCreated = 1;

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
      'component',
      'tool',
      'energy',
      'process',
      'infrastructure',
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
      summary.linksInserted += 1;
    }
  } else if (type === 'delete_link') {
    const linkId = String(data.link_id ?? '');
    if (!linkId) throw new Error('link_id manquant');
    const { error: delErr } = await sb.from('links').delete().eq('id', linkId);
    if (delErr) throw delErr;
    summary.linksDeleted = 1;
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
    type === 'ai_review' ||
    type === 'enrichment' ||
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

  return summary;
}

import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { slugify } from '@/lib/utils';
import type { RelationType } from '@/lib/types';

function nextLinkIdFromRows(rows: { id: string }[]): string {
  let max = 0;
  for (const l of rows) {
    const m = /^l(\d+)$/.exec(l.id);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `l${max + 1}`;
}

async function nextLinkId(sb: ReturnType<typeof createSupabaseServiceRoleClient>) {
  const { data } = await sb.from('links').select('id');
  return nextLinkIdFromRows((data ?? []) as { id: string }[]);
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

type EditNodeData = {
  original: Record<string, unknown>;
  proposed: Record<string, unknown>;
  diff?: Record<string, unknown>;
};

export async function applyApprovedSuggestion(
  suggestionId: string,
  options?: { overrideProposed?: Record<string, unknown> }
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

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof proposed.name === 'string') patch.name = proposed.name;
    if (typeof proposed.description === 'string') patch.description = proposed.description;
    if (typeof proposed.category === 'string') patch.category = proposed.category;
    if (typeof proposed.type === 'string') patch.type = proposed.type;
    if (typeof proposed.era === 'string') patch.era = proposed.era;
    if (proposed.year_approx !== undefined) {
      patch.year_approx =
        proposed.year_approx === null ? null : Number(proposed.year_approx);
    }
    if (typeof proposed.origin === 'string') patch.origin = proposed.origin;
    if (typeof proposed.name_en === 'string') patch.name_en = proposed.name_en;
    if (typeof proposed.description_en === 'string') {
      patch.description_en = proposed.description_en;
    }

    const { error: upErr } = await sb.from('nodes').update(patch).eq('id', nodeId);
    if (upErr) throw upErr;
  } else if (type === 'add_link') {
    const d = data as {
      source_id: string;
      target_id: string;
      relation_type: RelationType;
      quantity_hint?: string | null;
      is_optional?: boolean;
      notes?: string | null;
    };
    const id = await nextLinkId(sb);
    const { error: insErr } = await sb.from('links').insert({
      id,
      source_id: d.source_id,
      target_id: d.target_id,
      relation_type: d.relation_type,
      quantity_hint: d.quantity_hint ?? null,
      is_optional: d.is_optional ?? false,
      notes: d.notes ?? null,
    });
    if (insErr) throw insErr;
  } else if (type === 'new_node') {
    const d = data as {
      node: {
        name: string;
        category: string;
        type: string;
        era: string;
        year_approx?: number | null;
        origin?: string | null;
        description?: string;
        proposed_id?: string;
      };
      link: {
        source_id: string;
        target_id: string;
        relation_type: RelationType;
      };
    };

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

    const { error: nErr } = await sb.from('nodes').insert({
      id: nodeId,
      name: d.node.name,
      name_en: d.node.name,
      description: d.node.description ?? '',
      category: d.node.category,
      type: d.node.type,
      era: d.node.era,
      year_approx: d.node.year_approx ?? null,
      origin: d.node.origin ?? null,
      tags: [],
      complexity_depth: 0,
      updated_at: new Date().toISOString(),
    });
    if (nErr) throw nErr;

    const ph = d.node.proposed_id?.trim() || '';
    const src =
      ph && d.link.source_id === ph ? nodeId : d.link.source_id;
    const tgt =
      ph && d.link.target_id === ph ? nodeId : d.link.target_id;

    const linkId = await nextLinkId(sb);
    const { error: lErr } = await sb.from('links').insert({
      id: linkId,
      source_id: src,
      target_id: tgt,
      relation_type: d.link.relation_type,
      quantity_hint: null,
      is_optional: false,
      notes: null,
    });
    if (lErr) throw lErr;
  } else {
    throw new Error(`Type de suggestion inconnu: ${type}`);
  }

  const { error: stErr } = await sb
    .from('suggestions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', suggestionId);
  if (stErr) throw stErr;

  const uid = row.user_id as string | null;
  if (uid) {
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
}

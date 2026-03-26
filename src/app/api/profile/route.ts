import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { isAdminEmail } from '@/lib/auth-utils';
import { slugify } from '@/lib/utils';
import { getCategoryColor } from '@/lib/colors';
import type { NodeCategory } from '@/lib/types';

type SuggestionRow = {
  id: string;
  suggestion_type: string;
  status: string;
  node_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

function extractCategoryForCount(
  s: SuggestionRow,
  nodesById: Map<string, { category: string }>
): string | null {
  if (s.suggestion_type === 'new_node') {
    const d = s.data as { node?: { category?: string } };
    return d.node?.category ?? null;
  }
  if (s.suggestion_type === 'edit_node') {
    const d = s.data as { proposed?: { category?: string } };
    return d.proposed?.category ?? null;
  }
  if (s.suggestion_type === 'add_link') {
    const d = s.data as { target_id?: string };
    const t = d.target_id;
    if (t && nodesById.has(t)) {
      return nodesById.get(t)!.category;
    }
  }
  return null;
}

function buildSummary(
  s: SuggestionRow,
  nodesById: Map<string, { name: string }>
): { summary: string } {
  const st = s.suggestion_type;
  if (st === 'edit_node') {
    const d = s.data as {
      diff?: Record<string, { from: unknown; to: unknown }>;
    };
    const nodeId = s.node_id;
    const nodeName = nodeId
      ? nodesById.get(nodeId)?.name ?? nodeId
      : '?';
    const diffKeys = Object.keys(d.diff ?? {});
    const field = diffKeys[0] ?? '—';
    return {
      summary: `Correction : ${nodeName} - ${field}`,
    };
  }
  if (st === 'add_link') {
    const d = s.data as { source_id: string; target_id: string };
    const sn = nodesById.get(d.source_id)?.name ?? d.source_id;
    const tn = nodesById.get(d.target_id)?.name ?? d.target_id;
    return {
      summary: `Nouveau lien : ${sn} vers ${tn}`,
    };
  }
  if (st === 'new_node') {
    const d = s.data as { node?: { name?: string } };
    const name = d.node?.name ?? '?';
    return {
      summary: `Nouvelle invention : ${name}`,
    };
  }
  return { summary: s.suggestion_type };
}

export async function GET() {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profileRow } = await supabase
      .from('profiles')
      .select(
        'id, email, display_name, avatar_url, contributions_count, created_at'
      )
      .eq('id', user.id)
      .maybeSingle();

    const { data: suggRows, error: suggErr } = await supabase
      .from('suggestions')
      .select('id, suggestion_type, status, node_id, data, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (suggErr) {
      console.error(suggErr);
      return NextResponse.json(
        { error: 'Failed to load suggestions' },
        { status: 500 }
      );
    }

    const suggestions = (suggRows ?? []) as SuggestionRow[];

    const ids = new Set<string>();
    for (const s of suggestions) {
      if (s.node_id) ids.add(s.node_id);
      if (s.suggestion_type === 'add_link') {
        const d = s.data as { source_id?: string; target_id?: string };
        if (d.source_id) ids.add(d.source_id);
        if (d.target_id) ids.add(d.target_id);
      }
    }

    let nodesById = new Map<string, { name: string; category: string }>();
    if (ids.size > 0) {
      const { data: nodes } = await supabase
        .from('nodes')
        .select('id,name,category')
        .in('id', [...ids]);
      for (const n of nodes ?? []) {
        nodesById.set(n.id, {
          name: n.name,
          category: n.category as string,
        });
      }
    }

    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let inventions_created = 0;
    const catCounts = new Map<string, number>();

    for (const s of suggestions) {
      const st = s.status;
      if (st === 'approved') approved += 1;
      else if (st === 'pending') pending += 1;
      else if (st === 'rejected') rejected += 1;
      if (s.suggestion_type === 'new_node' && st === 'approved') {
        inventions_created += 1;
      }
      const cat = extractCategoryForCount(s, nodesById);
      if (cat) {
        catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
      }
    }

    const favoriteCategories = [...catCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => ({
        category,
        count,
        color: getCategoryColor(category as NodeCategory),
      }));

    const recent = suggestions.slice(0, 10).map((s) => ({
      id: s.id,
      suggestion_type: s.suggestion_type,
      status: s.status,
      created_at: s.created_at,
      ...buildSummary(s, nodesById),
    }));

    const inventedNodes: {
      id: string;
      name: string;
      category: string;
    }[] = [];
    const inventedSeen = new Set<string>();

    const approvedNew = suggestions.filter(
      (s) => s.suggestion_type === 'new_node' && s.status === 'approved'
    );
    for (const s of approvedNew) {
      const d = s.data as {
        node: {
          name: string;
          category: string;
          proposed_id?: string;
        };
      };
      const proposed = d.node.proposed_id?.trim();
      const slug = slugify(d.node.name);
      const candidates = [proposed, slug].filter(Boolean) as string[];
      let row: {
        id: string;
        name: string;
        category: string;
      } | null = null;
      for (const cid of candidates) {
        const { data: r } = await supabase
          .from('nodes')
          .select('id,name,category')
          .eq('id', cid)
          .maybeSingle();
        if (r) {
          row = r as { id: string; name: string; category: string };
          break;
        }
      }
      if (!row) {
        const { data: byName } = await supabase
          .from('nodes')
          .select('id,name,category')
          .eq('name', d.node.name)
          .maybeSingle();
        if (byName) {
          row = byName as { id: string; name: string; category: string };
        }
      }
      if (row && !inventedSeen.has(row.id)) {
        inventedSeen.add(row.id);
        inventedNodes.push({
          id: row.id,
          name: row.name,
          category: row.category,
        });
      }
    }

    const meta = user.user_metadata as Record<string, string | undefined>;
    const profile = {
      id: user.id,
      email: profileRow?.email ?? user.email ?? null,
      display_name:
        profileRow?.display_name ??
        meta?.full_name ??
        meta?.name ??
        user.email?.split('@')[0] ??
        null,
      avatar_url:
        profileRow?.avatar_url ??
        meta?.avatar_url ??
        meta?.picture ??
        null,
      contributions_count: profileRow?.contributions_count ?? 0,
      created_at:
        profileRow?.created_at ??
        user.created_at ??
        new Date().toISOString(),
    };

    return NextResponse.json({
      profile,
      stats: {
        approved,
        pending,
        rejected,
        inventions_created,
      },
      suggestions: recent,
      inventedNodes,
      favoriteCategories,
      isAdmin: isAdminEmail(user.email),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createSupabaseRouteHandlerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { display_name?: string };
    const raw = body.display_name?.trim() ?? '';
    if (!raw || raw.length > 120) {
      return NextResponse.json(
        { error: 'Invalid display_name' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('profiles')
      .update({ display_name: raw })
      .eq('id', user.id);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, display_name: raw });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

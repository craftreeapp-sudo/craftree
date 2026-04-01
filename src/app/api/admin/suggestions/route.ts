import { NextResponse } from 'next/server';
import { collectNodeIdsFromSuggestions } from '@/lib/collect-suggestion-node-ids';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';

export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        suggestions: [],
        profiles: {},
        nodeNames: {},
        suggestionCountByUser: {},
      });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? 'all';

    const supabase = await createSupabaseRouteHandlerClient();

    let q = supabase.from('suggestions').select('*');

    if (status === 'pending') {
      q = q.eq('status', 'pending').order('created_at', { ascending: false });
    } else if (status === 'history') {
      q = q
        .in('status', ['approved', 'rejected'])
        .order('reviewed_at', { ascending: false });
    } else {
      q = q.order('created_at', { ascending: false });
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    const list = rows ?? [];

    const { data: allForCounts } = await supabase
      .from('suggestions')
      .select('user_id, contributor_ip');
    const suggestionCountByUser: Record<string, number> = {};
    for (const r of allForCounts ?? []) {
      const row = r as {
        user_id: string | null;
        contributor_ip: string | null;
      };
      if (row.user_id) {
        suggestionCountByUser[row.user_id] =
          (suggestionCountByUser[row.user_id] ?? 0) + 1;
      } else if (row.contributor_ip) {
        const k = `anon:${row.contributor_ip}`;
        suggestionCountByUser[k] = (suggestionCountByUser[k] ?? 0) + 1;
      }
    }

    const nodeIds = [...new Set(collectNodeIdsFromSuggestions(list))];
    const nodeNames: Record<string, string> = {};

    if (nodeIds.length > 0) {
      const { data: nodes, error: nErr } = await supabase
        .from('nodes')
        .select('id, name')
        .in('id', nodeIds);
      if (nErr) throw nErr;
      for (const n of nodes ?? []) {
        const row = n as { id: string; name: string };
        nodeNames[row.id] = row.name;
      }
    }

    const userIds = [
      ...new Set(
        list
          .map((r) => r.user_id as string | null)
          .filter((x): x is string => Boolean(x))
      ),
    ];

    const profileMap: Record<
      string,
      {
        email: string | null;
        display_name: string | null;
        avatar_url: string | null;
        contributions_count: number;
      }
    > = {};

    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url, contributions_count')
        .in('id', userIds);
      for (const p of profs ?? []) {
        const pr = p as {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          contributions_count: number | null;
        };
        profileMap[pr.id] = {
          email: pr.email,
          display_name: pr.display_name,
          avatar_url: pr.avatar_url,
          contributions_count: pr.contributions_count ?? 0,
        };
      }
    }

    return NextResponse.json({
      suggestions: list,
      profiles: profileMap,
      nodeNames,
      suggestionCountByUser,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to list suggestions' },
      { status: 500 }
    );
  }
}

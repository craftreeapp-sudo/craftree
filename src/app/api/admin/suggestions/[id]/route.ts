import { NextResponse } from 'next/server';
import {
  collectNodeIdsFromSuggestionRow,
} from '@/lib/collect-suggestion-node-ids';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase required' }, { status: 503 });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const supabase = await createSupabaseRouteHandlerClient();
    const { data: row, error } = await supabase
      .from('suggestions')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const nodeIds = [...new Set(collectNodeIdsFromSuggestionRow(row))];
    const nodeNames: Record<string, string> = {};
    if (nodeIds.length > 0) {
      const { data: nodes, error: nErr } = await supabase
        .from('nodes')
        .select('id, name')
        .in('id', nodeIds);
      if (nErr) throw nErr;
      for (const n of nodes ?? []) {
        const r = n as { id: string; name: string };
        nodeNames[r.id] = r.name;
      }
    }

    const uid = row.user_id as string | null;
    const profileMap: Record<
      string,
      {
        email: string | null;
        display_name: string | null;
        avatar_url: string | null;
        contributions_count: number;
      }
    > = {};

    if (uid) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url, contributions_count')
        .eq('id', uid)
        .maybeSingle();
      const pr = prof as {
        id: string;
        email: string | null;
        display_name: string | null;
        avatar_url: string | null;
        contributions_count: number | null;
      } | null;
      if (pr) {
        profileMap[pr.id] = {
          email: pr.email,
          display_name: pr.display_name,
          avatar_url: pr.avatar_url,
          contributions_count: pr.contributions_count ?? 0,
        };
      }
    }

    return NextResponse.json({
      suggestion: row,
      profiles: profileMap,
      nodeNames,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load suggestion' },
      { status: 500 }
    );
  }
}

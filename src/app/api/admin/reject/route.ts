import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import { notifyContributorSuggestionResult } from '@/lib/notify-contributor-suggestion';

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase required' }, { status: 503 });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      id?: string;
      admin_comment?: string | null;
    };

    const id = body.id;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const routeSb = await createSupabaseRouteHandlerClient();
    const { data: row } = await routeSb
      .from('suggestions')
      .select('status')
      .eq('id', id)
      .single();

    if (!row || String((row as { status: string }).status) !== 'pending') {
      return NextResponse.json({ error: 'Invalid suggestion' }, { status: 400 });
    }

    const sb = createSupabaseServiceRoleClient();
    const { data: fullRow, error: fetchFullErr } = await sb
      .from('suggestions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchFullErr || !fullRow) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 400 });
    }

    const { error } = await sb
      .from('suggestions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        admin_comment: body.admin_comment ?? null,
      })
      .eq('id', id);

    if (error) throw error;

    const fr = fullRow as {
      id: string;
      user_id: string | null;
      suggestion_type: string;
      node_id: string | null;
      data: unknown;
    };
    void notifyContributorSuggestionResult({
      status: 'rejected',
      row: {
        id: fr.id,
        user_id: fr.user_id,
        suggestion_type: fr.suggestion_type,
        node_id: fr.node_id,
        data: fr.data,
      },
      adminComment: body.admin_comment ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Reject failed' }, { status: 500 });
  }
}

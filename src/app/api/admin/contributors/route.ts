import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ contributors: [] });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createSupabaseRouteHandlerClient();

    const { data: suggestions, error: sugErr } = await supabase
      .from('suggestions')
      .select('user_id, status');

    if (sugErr) throw sugErr;

    const approvedByUser = new Map<string, number>();
    const rejectedByUser = new Map<string, number>();
    const totalByUser = new Map<string, number>();
    const hasSuggestion = new Set<string>();

    for (const s of suggestions ?? []) {
      const row = s as { user_id: string | null; status: string };
      if (!row.user_id) continue;
      hasSuggestion.add(row.user_id);
      totalByUser.set(row.user_id, (totalByUser.get(row.user_id) ?? 0) + 1);
      if (row.status === 'approved') {
        approvedByUser.set(
          row.user_id,
          (approvedByUser.get(row.user_id) ?? 0) + 1
        );
      } else if (row.status === 'rejected') {
        rejectedByUser.set(
          row.user_id,
          (rejectedByUser.get(row.user_id) ?? 0) + 1
        );
      }
    }

    const userIds = [...hasSuggestion];
    if (userIds.length === 0) {
      return NextResponse.json({ contributors: [] });
    }

    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select(
        'id, email, display_name, avatar_url, contributions_count, created_at'
      )
      .in('id', userIds);

    if (profErr) throw profErr;

    const list = (profiles ?? []).map((p) => {
      const pr = p as {
        id: string;
        email: string | null;
        display_name: string | null;
        avatar_url: string | null;
        contributions_count: number | null;
        created_at: string;
      };
      return {
        id: pr.id,
        email: pr.email,
        display_name: pr.display_name,
        avatar_url: pr.avatar_url,
        contributions_count: pr.contributions_count ?? 0,
        created_at: pr.created_at,
        approved_suggestions: approvedByUser.get(pr.id) ?? 0,
        rejected_suggestions: rejectedByUser.get(pr.id) ?? 0,
        total_suggestions: totalByUser.get(pr.id) ?? 0,
      };
    });

    list.sort((a, b) => b.contributions_count - a.contributions_count);

    return NextResponse.json({ contributors: list });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to list contributors' },
      { status: 500 }
    );
  }
}

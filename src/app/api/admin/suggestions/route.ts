import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { requireAdminFromRequest } from '@/lib/auth-server';

function useSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export async function GET(request: Request) {
  try {
    if (!useSupabase()) {
      return NextResponse.json({ suggestions: [] });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status') ?? 'all';

    const supabase = await createSupabaseRouteHandlerClient();

    let q = supabase.from('suggestions').select('*').order('created_at', { ascending: false });

    if (status === 'pending') {
      q = q.eq('status', 'pending');
    } else if (status === 'history') {
      q = q.in('status', ['approved', 'rejected']);
    }

    const { data: rows, error } = await q;
    if (error) throw error;

    const userIds = [
      ...new Set(
        (rows ?? [])
          .map((r) => r.user_id as string | null)
          .filter((x): x is string => Boolean(x))
      ),
    ];

    const profileMap: Record<
      string,
      { email: string | null; display_name: string | null; avatar_url: string | null; contributions_count: number }
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
      suggestions: rows ?? [],
      profiles: profileMap,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to list suggestions' },
      { status: 500 }
    );
  }
}

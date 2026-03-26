import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { requireAdminFromRequest } from '@/lib/auth-server';

function useSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export async function GET() {
  try {
    if (!useSupabase()) {
      return NextResponse.json({ profiles: [] });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createSupabaseRouteHandlerClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, avatar_url, contributions_count, created_at')
      .order('contributions_count', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ profiles: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to list profiles' },
      { status: 500 }
    );
  }
}

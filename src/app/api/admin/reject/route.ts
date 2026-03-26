import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';

function useSupabase(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export async function POST(request: Request) {
  try {
    if (!useSupabase()) {
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
    const { error } = await sb
      .from('suggestions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        admin_comment: body.admin_comment ?? null,
      })
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Reject failed' }, { status: 500 });
  }
}

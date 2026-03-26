import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { applyApprovedSuggestion } from '@/lib/admin-approve-suggestion';

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
      overrideProposed?: Record<string, unknown>;
    };

    const id = body.id;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await applyApprovedSuggestion(id, {
      overrideProposed: body.overrideProposed,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : 'Approve failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import {
  applyApprovedSuggestion,
  type AdminEditNodeLinkListsOverride,
} from '@/lib/admin-approve-suggestion';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';

function approveErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (
    e &&
    typeof e === 'object' &&
    'message' in e &&
    typeof (e as { message?: unknown }).message === 'string'
  ) {
    return String((e as { message: string }).message);
  }
  return 'Approve failed';
}

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
      overrideProposed?: Record<string, unknown>;
      overrideEditNodeLinkLists?: AdminEditNodeLinkListsOverride;
      admin_comment?: string | null;
    };

    const id = body.id;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const opts: Parameters<typeof applyApprovedSuggestion>[1] = {
      overrideProposed: body.overrideProposed,
      overrideEditNodeLinkLists: body.overrideEditNodeLinkLists,
    };
    if (Object.prototype.hasOwnProperty.call(body, 'admin_comment')) {
      opts.adminComment = body.admin_comment ?? null;
    }

    console.log('[admin/approve] POST applyApprovedSuggestion', { id });
    const summary = await applyApprovedSuggestion(id, opts);
    console.log(
      '[admin/approve] applyApprovedSuggestion finished (contributor notify awaited inside)'
    );

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error(e);
    const msg = approveErrorMessage(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

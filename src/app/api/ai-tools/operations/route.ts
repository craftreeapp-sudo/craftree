import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase requis' }, { status: 503 });
    }
    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = createSupabaseServiceRoleClient();
    const { data, error } = await sb
      .from('ai_operations')
      .select(
        'id, tool, status, params, results, cards_processed, cards_modified, cost_estimate, started_at, completed_at, created_by'
      )
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error(error);
      const missingTable =
        error.code === 'PGRST205' ||
        (typeof error.message === 'string' &&
          error.message.includes("Could not find the table") &&
          error.message.includes('ai_operations'));
      return NextResponse.json(
        {
          error: missingTable
            ? "Table ai_operations absente : dans Supabase → SQL Editor, exécutez le contenu de supabase/migrations/20250404120000_ai_operations.sql puis rechargez la page."
            : 'Impossible de lire le journal',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ operations: data ?? [] });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'operations failed' }, { status: 500 });
  }
}

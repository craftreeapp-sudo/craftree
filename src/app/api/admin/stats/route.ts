import { NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        pending: 0,
        approved: 0,
        rejected: 0,
        contributorsWithSuggestions: 0,
      });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await createSupabaseRouteHandlerClient();

    const [pendingRes, approvedRes, rejectedRes, allSug] = await Promise.all([
      supabase
        .from('suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved'),
      supabase
        .from('suggestions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rejected'),
      supabase.from('suggestions').select('user_id, contributor_ip'),
    ]);

    if (pendingRes.error) throw pendingRes.error;
    if (approvedRes.error) throw approvedRes.error;
    if (rejectedRes.error) throw rejectedRes.error;
    if (allSug.error) throw allSug.error;

    const userIds = new Set<string>();
    const anonIps = new Set<string>();
    for (const row of allSug.data ?? []) {
      const r = row as {
        user_id: string | null;
        contributor_ip: string | null;
      };
      if (r.user_id) userIds.add(r.user_id);
      else if (r.contributor_ip) anonIps.add(r.contributor_ip);
    }

    return NextResponse.json({
      pending: pendingRes.count ?? 0,
      approved: approvedRes.count ?? 0,
      rejected: rejectedRes.count ?? 0,
      contributorsWithSuggestions: userIds.size + anonIps.size,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load stats' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        summary: {
          sessionsToday: 0,
          clicksToday: 0,
          searchesToday: 0,
          sharesToday: 0,
        },
        topNodes: [],
        topSearches: [],
        topPaths: [],
        languageDistribution: [],
      });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = createSupabaseServiceRoleClient();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const { data: rows, error } = await sb
      .from('analytics_events')
      .select('event_type, node_id, session_id, metadata, created_at')
      .limit(100000);

    if (error) throw error;
    const list = (rows ?? []) as {
      event_type: string;
      node_id: string | null;
      session_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }[];

    const todayStart = startOfDay.getTime();
    const todayRows = list.filter(
      (r) => new Date(r.created_at).getTime() >= todayStart
    );

    const sessionsToday = new Set(
      todayRows.map((r) => r.session_id).filter(Boolean)
    ).size;
    const clicksToday = todayRows.filter(
      (r) => r.event_type === 'node_click'
    ).length;
    const searchesToday = todayRows.filter(
      (r) => r.event_type === 'search'
    ).length;
    const sharesToday = todayRows.filter(
      (r) => r.event_type === 'share'
    ).length;

    const nodeClickCounts: Record<string, number> = {};
    for (const r of list) {
      if (r.event_type !== 'node_click' || !r.node_id) continue;
      nodeClickCounts[r.node_id] = (nodeClickCounts[r.node_id] ?? 0) + 1;
    }
    const topNodeIds = Object.entries(nodeClickCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const nodeIds = topNodeIds.map(([id]) => id);
    const nameById: Record<string, string> = {};
    if (nodeIds.length > 0) {
      const { data: nodesRows } = await sb
        .from('nodes')
        .select('id, name')
        .in('id', nodeIds);
      for (const n of nodesRows ?? []) {
        const row = n as { id: string; name: string };
        nameById[row.id] = row.name;
      }
    }

    const topNodes = topNodeIds.map(([nodeId, count]) => ({
      nodeId,
      name: nameById[nodeId] ?? nodeId,
      count,
    }));

    const searchQueries: Record<string, number> = {};
    for (const r of list) {
      if (r.event_type !== 'search') continue;
      const q = r.metadata?.query;
      const key =
        typeof q === 'string' && q.trim() ? q.trim().slice(0, 200) : ''
      if (!key) continue;
      searchQueries[key] = (searchQueries[key] ?? 0) + 1;
    }
    const topSearches = Object.entries(searchQueries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    const pathPairCounts: Record<string, { from: string; to: string; count: number }> =
      {};
    for (const r of list) {
      if (r.event_type !== 'navigate_link' || !r.node_id) continue;
      const from = r.metadata?.from;
      if (typeof from !== 'string' || !from) continue;
      const to = r.node_id;
      const key = `${from}→${to}`;
      if (!pathPairCounts[key]) {
        pathPairCounts[key] = { from, to, count: 0 };
      }
      pathPairCounts[key].count += 1;
    }
    const topPathEntries = Object.values(pathPairCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const pathIds = new Set<string>();
    for (const p of topPathEntries) {
      pathIds.add(p.from);
      pathIds.add(p.to);
    }
    const pathIdList = [...pathIds];
    if (pathIdList.length > 0) {
      const { data: pathNodes } = await sb
        .from('nodes')
        .select('id, name')
        .in('id', pathIdList);
      for (const n of pathNodes ?? []) {
        const row = n as { id: string; name: string };
        nameById[row.id] = row.name;
      }
    }

    const topPaths = topPathEntries.map((p) => ({
      fromId: p.from,
      fromName: nameById[p.from] ?? p.from,
      toId: p.to,
      toName: nameById[p.to] ?? p.to,
      count: p.count,
    }));

    const langCounts: Record<string, number> = {};
    let langTotal = 0;
    for (const r of list) {
      if (r.event_type !== 'language_change') continue;
      const to = r.metadata?.to;
      const key = typeof to === 'string' && to ? to : 'unknown';
      langCounts[key] = (langCounts[key] ?? 0) + 1;
      langTotal += 1;
    }
    const languageDistribution = Object.entries(langCounts)
      .map(([locale, count]) => ({
        locale,
        count,
        percent: langTotal > 0 ? Math.round((count / langTotal) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      summary: {
        sessionsToday,
        clicksToday,
        searchesToday,
        sharesToday,
      },
      topNodes,
      topSearches,
      topPaths,
      languageDistribution,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load analytics' },
      { status: 500 }
    );
  }
}

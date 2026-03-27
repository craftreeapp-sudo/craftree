import { createSupabaseServerReadClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import type { CraftingLink } from '@/lib/types';
import {
  computeLandingPageData,
  type LandingIndexNode,
  type LandingStats,
} from '@/lib/landing-ssg';
import nodesIndex from '@/data/nodes-index.json';
import linksData from '@/data/links.json';

export async function getPublicGraphStats(): Promise<LandingStats> {
  if (!isSupabaseConfigured()) {
    const landing = computeLandingPageData(
      nodesIndex.nodes as LandingIndexNode[],
      linksData.links as Pick<CraftingLink, 'source_id' | 'target_id'>[]
    );
    return landing.stats;
  }

  const sb = createSupabaseServerReadClient();

  const [nodesCountRes, linksCountRes, maxDepthRes] = await Promise.all([
    sb.from('nodes').select('*', { count: 'exact', head: true }),
    sb.from('links').select('*', { count: 'exact', head: true }),
    sb
      .from('nodes')
      .select('complexity_depth')
      .order('complexity_depth', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const nodeCount = nodesCountRes.count ?? 0;
  const linkCount = linksCountRes.count ?? 0;
  const row = maxDepthRes.data as { complexity_depth?: number } | null;
  const maxComplexityDepth = Number(row?.complexity_depth ?? 0);

  return {
    nodeCount,
    linkCount,
    maxComplexityDepth,
  };
}

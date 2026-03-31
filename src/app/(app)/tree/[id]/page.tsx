import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { collectUpstreamDependencyNodeIds } from '@/lib/graph-utils';
import type { CraftingLink } from '@/lib/types';
import { getSiteUrl } from '@/lib/seo';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';
import { TreePageClient } from './TreePageClient';
import {
  getAllNodes,
  getAllLinks,
  getExploreMetadataLinks,
  getTreePageNodeMeta,
} from '@/lib/data';
import type { SeedNode } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const base = getSiteUrl();
  const n = await getTreePageNodeMeta(id);
  const edgeLinks = await getExploreMetadataLinks();

  if (!n) {
    return {
      title: { absolute: 'Craftree — Arbre de dépendances' },
      description:
        'Visualisez toutes les matières premières et étapes nécessaires pour fabriquer une technologie.',
    };
  }

  const edgeSlice = edgeLinks.map((e) => ({
    source_id: e.source_id,
    target_id: e.target_id,
  }));
  const upstream = collectUpstreamDependencyNodeIds(id, edgeSlice);
  const depCount = Math.max(0, upstream.size - 1);

  const title = `${n.name} — Craftree`;
  const description = `Que faut-il pour fabriquer ${n.name} ? Découvrez les ${depCount} inventions nécessaires.`;
  const canonical = `${base}${treeInventionPath(id)}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Craftree',
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@Craftree_app',
      title,
      description,
    },
  };
}

export default async function TreePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meta = await getTreePageNodeMeta(id);
  if (!meta) {
    redirect(treeInventionPath(getDefaultTreeNodeId()));
  }

  let initialGraph: { nodes: SeedNode[]; links: CraftingLink[] } | null = null;
  if (isSupabaseConfigured()) {
    const [nodes, links] = await Promise.all([getAllNodes(), getAllLinks()]);
    initialGraph = { nodes, links };
  }

  return (
    <TreePageClient params={params} initialGraph={initialGraph} />
  );
}

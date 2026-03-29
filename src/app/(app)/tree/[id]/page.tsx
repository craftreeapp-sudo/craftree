import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import linksJson from '@/data/links.json';
import { collectUpstreamDependencyNodeIds } from '@/lib/graph-utils';
import type { CraftingLink } from '@/lib/types';
import { getSiteUrl } from '@/lib/seo';
import { getTreeMetadataNode } from '@/lib/seed-merge';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';
import { TreePageClient } from './TreePageClient';
import {
  getAllNodes,
  getAllLinks,
} from '@/lib/data';
import type { SeedNode } from '@/lib/types';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const base = getSiteUrl();
  const n = getTreeMetadataNode(id);
  const links = linksJson.links as CraftingLink[];

  if (!n) {
    return {
      title: { absolute: 'Craftree — Arbre de dépendances' },
      description:
        'Visualisez toutes les matières premières et étapes nécessaires pour fabriquer une technologie.',
    };
  }

  const edgeSlice = links.map((e) => ({
    source_id: e.source_id,
    target_id: e.target_id,
  }));
  const upstream = collectUpstreamDependencyNodeIds(id, edgeSlice);
  const depCount = Math.max(0, upstream.size - 1);

  const title = `Craftree — ${n.name}`;
  const description = `Explorez les ${depCount} dépendances nécessaires pour fabriquer ${n.name}.`;
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
      images: [{ url: `${base}/og-default.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
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
  const exists = Boolean(getTreeMetadataNode(id));
  if (!exists) {
    redirect(treeInventionPath(getDefaultTreeNodeId()));
  }

  let initialGraph: { nodes: SeedNode[]; links: CraftingLink[] } | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const [nodes, links] = await Promise.all([getAllNodes(), getAllLinks()]);
    initialGraph = { nodes, links };
  }

  return (
    <TreePageClient params={params} initialGraph={initialGraph} />
  );
}

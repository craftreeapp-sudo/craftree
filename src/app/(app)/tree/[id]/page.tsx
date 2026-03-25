import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import linksJson from '@/data/links.json';
import { collectUpstreamDependencyNodeIds } from '@/lib/graph-utils';
import type { CraftingLink } from '@/lib/types';
import { getSiteUrl } from '@/lib/seo';
import { getTreeMetadataNode } from '@/lib/seed-merge';
import { TreePageClient } from './TreePageClient';

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

  const title = `Craftree — Arbre de ${n.name}`;
  const description = `Explorez les ${depCount} dépendances nécessaires pour fabriquer ${n.name}.`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url: `${base}/tree/${encodeURIComponent(id)}`,
      siteName: 'Craftree',
      locale: 'fr_FR',
      type: 'website',
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
    redirect('/explore');
  }
  return <TreePageClient params={params} />;
}

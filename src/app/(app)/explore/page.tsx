import type { Metadata } from 'next';
import { buildExploreNodeDescription, getSiteUrl } from '@/lib/seo';
import {
  getExploreMetadataNodes,
  getExploreMetadataLinks,
  getAllNodes,
  getAllLinks,
} from '@/lib/data';
import { ExploreClient } from './ExploreClient';
import type { CraftingLink, SeedNode } from '@/lib/types';

const defaultDescription =
  'Explorez l’arbre des technologies humaines : matières premières, recettes et dépendances, du néolithique au numérique.';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ node?: string }>;
}): Promise<Metadata> {
  const { node: nodeId } = await searchParams;
  const base = getSiteUrl();

  if (!nodeId) {
    return {
      title: {
        absolute: 'Craftree — Tree',
      },
      description: defaultDescription,
      openGraph: {
        title: 'Craftree — Tree',
        description: defaultDescription,
        url: `${base}/explore`,
        siteName: 'Craftree',
        locale: 'fr_FR',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Craftree — Tree',
        description: defaultDescription,
      },
    };
  }

  const [nodes, links] = await Promise.all([
    getExploreMetadataNodes(),
    getExploreMetadataLinks(),
  ]);
  const n = nodes.find((x) => x.id === nodeId);

  if (!n) {
    return {
      title: { absolute: 'Craftree — Tree' },
      description: defaultDescription,
    };
  }

  const description = buildExploreNodeDescription(nodeId, nodes, links);
  const title = `Craftree — ${n.name}`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url: `${base}/explore?node=${encodeURIComponent(nodeId)}`,
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

export default async function ExplorePage() {
  let initialGraph: { nodes: SeedNode[]; links: CraftingLink[] } | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const [nodes, links] = await Promise.all([getAllNodes(), getAllLinks()]);
    initialGraph = { nodes, links };
  }

  return <ExploreClient initialGraph={initialGraph} />;
}

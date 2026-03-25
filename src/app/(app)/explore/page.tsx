import type { Metadata } from 'next';
import linksJson from '@/data/links.json';
import { buildExploreNodeDescription, getSiteUrl } from '@/lib/seo';
import { getExploreMetadataNodes } from '@/lib/seed-merge';
import { ExploreClient } from './ExploreClient';

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

  const nodes = getExploreMetadataNodes();
  const links = linksJson.links as { source_id: string; target_id: string }[];
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

export default function ExplorePage() {
  return <ExploreClient />;
}

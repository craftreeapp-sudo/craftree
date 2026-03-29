import type { Metadata } from 'next';
import { getMergedSeedNode } from '@/lib/seed-merge';
import { getSiteUrl } from '@/lib/seo';
import { treeInventionPath } from '@/lib/tree-routes';
import { NODE_CATEGORY_LABELS_FR } from '@/lib/node-labels';
import type { NodeCategory, SeedNode } from '@/lib/types';

export function getInventionNodeById(id: string): SeedNode | undefined {
  return getMergedSeedNode(id);
}

export function buildInventionMetadata(id: string): Metadata {
  const node = getInventionNodeById(id);
  const base = getSiteUrl();

  if (!node) {
    return {
      title: { absolute: 'Invention non trouvée — Craftree' },
    };
  }

  const categoryLabel =
    NODE_CATEGORY_LABELS_FR[node.category as NodeCategory] ?? node.category;
  const year =
    node.year_approx !== null && node.year_approx !== undefined
      ? String(node.year_approx)
      : '';
  const title = `${node.name} — Craftree`;
  const description =
    node.description?.trim() ||
    `${node.name}${year ? ` (${year})` : ''} — ${categoryLabel}. Explorez ses intrants de fabrication sur Craftree.`;

  const imagePath = node.image_url?.trim() || '/og-default.png';
  const ogImage =
    imagePath.startsWith('http') ? imagePath : `${base}${imagePath}`;
  const canonicalUrl = `${base}${treeInventionPath(id)}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${node.name} — De quoi est-ce fait ?`,
      description,
      type: 'article',
      locale: 'fr_FR',
      siteName: 'Craftree',
      url: canonicalUrl,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: node.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${node.name} — De quoi est-ce fait ?`,
      description,
      images: [ogImage],
    },
  };
}

export function buildInventionJsonLd(node: SeedNode) {
  const base = getSiteUrl();
  const pageUrl = `${base}${treeInventionPath(node.id)}`;
  const image = node.image_url?.trim()
    ? node.image_url.startsWith('http')
      ? node.image_url
      : `${base}${node.image_url}`
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    name: node.name,
    description: node.description,
    image,
    url: pageUrl,
    ...(node.year_approx !== null && node.year_approx !== undefined
      ? { dateCreated: String(node.year_approx) }
      : {}),
  };
}

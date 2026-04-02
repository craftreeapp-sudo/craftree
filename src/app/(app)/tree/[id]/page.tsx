import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { CraftingLink } from '@/lib/types';
import { getSiteUrl } from '@/lib/seo';
import { buildTreeArticleJsonLd, buildTreeSeoBundle } from '@/lib/tree-seo';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import { getMergedSeedNode } from '@/lib/seed-merge';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';
import { TreePageClient } from './TreePageClient';
import {
  getAllNodes,
  getAllLinks,
  getExploreMetadataLinks,
  getExploreMetadataNodes,
  getTreePageNodeMeta,
} from '@/lib/data';
import type { SeedNode } from '@/lib/types';
import { getViewerIsAdminFromCookies } from '@/lib/auth-server';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const base = getSiteUrl();

  const isAdmin = await getViewerIsAdminFromCookies();
  const [n, edgeLinks, metaNodes] = await Promise.all([
    getTreePageNodeMeta(id, { viewerIsAdmin: isAdmin }),
    getExploreMetadataLinks(),
    getExploreMetadataNodes(),
  ]);

  if (!n) {
    return {
      title: { absolute: 'Craftree — Arbre de dépendances' },
      description:
        'Visualisez toutes les matières premières et étapes nécessaires pour fabriquer une technologie.',
    };
  }

  const nameById = new Map(metaNodes.map((m) => [m.id, m.name]));
  const edgeSlice = edgeLinks.map((e) => ({
    source_id: e.source_id,
    target_id: e.target_id,
  }));

  const seo = buildTreeSeoBundle({
    displayName: n.name,
    nodeId: id,
    edges: edgeSlice,
    nameById,
  });

  const title = `${n.name} — Craftree`;
  const canonical = `${base}${treeInventionPath(id)}`;

  return {
    title: { absolute: title },
    description: seo.description,
    alternates: { canonical },
    openGraph: {
      title,
      description: seo.openGraphDescription,
      url: canonical,
      siteName: 'Craftree',
      locale: 'fr_FR',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@Craftree_app',
      title,
      description: seo.twitterDescription,
    },
  };
}

export default async function TreePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewerIsAdmin = await getViewerIsAdminFromCookies();
  const meta = await getTreePageNodeMeta(id, { viewerIsAdmin });
  if (!meta) {
    redirect(treeInventionPath(getDefaultTreeNodeId()));
  }

  let initialGraph: { nodes: SeedNode[]; links: CraftingLink[] } | null = null;
  if (isSupabaseConfigured()) {
    const [nodes, links] = await Promise.all([
      getAllNodes({ includeDrafts: viewerIsAdmin }),
      getAllLinks(),
    ]);
    const visibleIds = new Set(nodes.map((n) => n.id));
    const filteredLinks = links.filter(
      (l) => visibleIds.has(l.source_id) && visibleIds.has(l.target_id)
    );
    initialGraph = { nodes, links: filteredLinks };
  }

  const base = getSiteUrl();
  const merged = getMergedSeedNode(id);
  const canonicalUrl = `${base}${treeInventionPath(id)}`;
  const jsonLd = buildTreeArticleJsonLd({
    name: meta.name,
    alternateName: merged?.name_en,
    description: merged?.description,
    canonicalUrl,
    siteUrl: base,
    yearApprox: merged?.year_approx ?? null,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
      <TreePageClient params={params} initialGraph={initialGraph} />
    </>
  );
}

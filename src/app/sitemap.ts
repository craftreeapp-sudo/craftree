import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';
import { getAllNodeIds } from '@/lib/seed-merge';
import { treeInventionPath, getDefaultTreeNodeId } from '@/lib/tree-routes';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const nodeIds = getAllNodeIds();
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}${treeInventionPath(getDefaultTreeNodeId())}`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.95,
    },
    {
      url: `${base}/timeline`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/stats`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${base}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.65,
    },
  ];

  const fromNodes: MetadataRoute.Sitemap = [];

  for (const id of nodeIds) {
    fromNodes.push({
      url: `${base}/invention/${encodeURIComponent(id)}`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
    fromNodes.push({
      url: `${base}/tree/${encodeURIComponent(id)}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.72,
    });
  }

  return [...staticRoutes, ...fromNodes];
}

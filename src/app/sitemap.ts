import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo';
import { getAllNodeIds } from '@/lib/seed-merge';

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
      url: `${base}/about`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  const fromNodes: MetadataRoute.Sitemap = nodeIds.map((id) => ({
    url: `${base}/tree/${encodeURIComponent(id)}`,
    lastModified,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...fromNodes];
}

import path from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import nodesIndex from './src/data/nodes-index.json';

/** Aligné sur `getDefaultTreeNodeId` (tree-routes) — import JSON direct pour éviter @/ dans next.config. */
function exploreRedirectDestination(): string {
  const nodes = nodesIndex.nodes as { id: string; name: string }[];
  if (nodes.length === 0) return '/tree/feu';
  const sorted = [...nodes].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr')
  );
  return `/tree/${encodeURIComponent(sorted[0]!.id)}`;
}

/** Répertoire du dépôt craftree (évite que Turbopack prenne un parent à cause d’un autre lockfile). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  turbopack: {
    // Racine explicite si un lockfile parent fait croire à Next que le projet est au-dessus de craftree.
    root: projectRoot,
  },
  compress: true,
  async redirects() {
    const exploreDestination = exploreRedirectDestination();
    return [
      {
        source: '/explore',
        destination: exploreDestination,
        permanent: true,
      },
      {
        source: '/admin/inventions',
        destination: '/admin',
        permanent: true,
      },
      {
        source: '/editor',
        destination: '/admin',
        permanent: false,
      },
      {
        source: '/categories/type/process',
        destination: '/categories/dimension/process',
        permanent: true,
      },
      {
        source: '/categories/type/tool',
        destination: '/categories/dimension/tool',
        permanent: true,
      },
      {
        source: '/categories/type/raw_material',
        destination: '/categories/materialLevel/raw',
        permanent: true,
      },
      {
        source: '/categories/type/component',
        destination: '/categories/materialLevel/component',
        permanent: true,
      },
      {
        source: '/categories/type/material',
        destination: '/categories/dimension/matter',
        permanent: true,
      },
      {
        source: '/categories/type/end_product',
        destination: '/categories/materialLevel/component',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.wikipedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);

import path from 'path';
import { fileURLToPath } from 'url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

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
    return [
      {
        source: '/admin/inventions',
        destination: '/editor',
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

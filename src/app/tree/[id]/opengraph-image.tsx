import { ImageResponse } from 'next/og';
import { headers } from 'next/headers';
import {
  loadOgTreeInventionData,
  type OgLocale,
} from '@/lib/og-tree-invention-data';
import { renderOgTreeImage } from '@/lib/og-tree-image-render';

export const runtime = 'nodejs';

export const alt = 'Craftree';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 86400;

async function detectOgLocale(): Promise<OgLocale> {
  const h = await headers();
  const al = h.get('accept-language') ?? '';
  const first = al.split(',')[0]?.trim().toLowerCase() ?? '';
  if (!first) return 'fr';
  if (first.startsWith('fr')) return 'fr';
  if (first.startsWith('en')) return 'en';
  return 'en';
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const decoded = decodeURIComponent(id);
  const locale = await detectOgLocale();
  const payload = await loadOgTreeInventionData(decoded, locale);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        {renderOgTreeImage(payload, decoded)}
      </div>
    ),
    {
      ...size,
      headers: {
        'Cache-Control':
          'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  );
}

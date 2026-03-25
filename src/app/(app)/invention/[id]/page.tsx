import type { Metadata } from 'next';
import {
  buildInventionJsonLd,
  buildInventionMetadata,
  getInventionNodeById,
} from '@/lib/invention-seo';
import { getAllNodeIds } from '@/lib/seed-merge';
import { InventionRedirect } from './InventionRedirect';

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return buildInventionMetadata(id);
}

export async function generateStaticParams() {
  return getAllNodeIds().map((id) => ({
    id,
  }));
}

export default async function InventionPage({ params }: Props) {
  const { id } = await params;
  const node = getInventionNodeById(id);

  if (!node) {
    return (
      <InventionRedirect
        to={`/explore?node=${encodeURIComponent(id)}`}
      />
    );
  }

  const jsonLd = buildInventionJsonLd(node);
  const explore = `/explore?node=${encodeURIComponent(id)}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <InventionRedirect to={explore} />
    </>
  );
}

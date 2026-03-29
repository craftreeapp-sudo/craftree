import type { Metadata } from 'next';
import Script from 'next/script';
import {
  buildInventionJsonLd,
  buildInventionMetadata,
  getInventionNodeById,
} from '@/lib/invention-seo';
import { getAllNodeIds } from '@/lib/seed-merge';
import { treeInventionPath } from '@/lib/tree-routes';
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
      <InventionRedirect to={treeInventionPath(id)} />
    );
  }

  const jsonLd = buildInventionJsonLd(node);
  const treeUrl = treeInventionPath(id);

  return (
    <>
      <Script
        id={`invention-ld-json-${id}`}
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <InventionRedirect to={treeUrl} />
    </>
  );
}

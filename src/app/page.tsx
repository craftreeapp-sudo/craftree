import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { HomePage } from '@/components/home/HomePage';
import nodesIndex from '@/data/nodes-index.json';

export const metadata: Metadata = {
  title: 'Craftree — De quoi est faite la civilisation ?',
  description:
    'Explorez l’arbre complet des technologies humaines. Chaque invention décomposée en ses matériaux, procédés et outils, des matières premières au produit final.',
};

type IndexNode = (typeof nodesIndex.nodes)[number];

const floatingPool = nodesIndex.nodes
  .filter((n: IndexNode) => Boolean(n.image_url?.trim()))
  .filter((_: IndexNode, i: number) => i % 5 === 0)
  .slice(0, 48)
  .map((n: IndexNode) => ({
    id: n.id,
    name: n.name,
    category: n.category,
    image_url: n.image_url,
  }));

export default async function Home() {
  await getLocale();
  return <HomePage floatingPool={floatingPool} />;
}

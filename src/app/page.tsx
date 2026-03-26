import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { LandingPage } from '@/components/landing/LandingPage';
import {
  computeLandingPageData,
  type LandingIndexNode,
} from '@/lib/landing-ssg';
import { resolveLandingHeroCards } from '@/lib/landing-hero-cards';
import { getLandingDemoTreeNodes } from '@/lib/landing-demo-tree';
import nodesIndex from '@/data/nodes-index.json';
import linksData from '@/data/links.json';

export const metadata: Metadata = {
  title: 'Craftree — De quoi est faite la civilisation ?',
  description:
    "Explorez l'arbre complet des technologies humaines, de la matière première au produit final.",
};

const landing = computeLandingPageData(
  nodesIndex.nodes as LandingIndexNode[],
  linksData.links
);

const heroCards = resolveLandingHeroCards(
  nodesIndex.nodes as Array<{ id: string; name: string; category: string }>
);

export default async function Home() {
  const locale = await getLocale();
  const demoNodes = getLandingDemoTreeNodes(locale);

  return (
    <LandingPage
      stats={landing.stats}
      feature={landing.feature}
      heroCards={heroCards}
      demoNodes={demoNodes}
    />
  );
}

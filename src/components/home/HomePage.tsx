import { LandingPage } from '@/components/landing/LandingPage';
import type { LandingFloatingNode } from '@/components/landing/LandingFloatingCards';

type Props = {
  floatingPool: LandingFloatingNode[];
};

/** Page d'accueil : hero, recherche et démo visuelle (cartes flottantes). */
export function HomePage({ floatingPool }: Props) {
  return <LandingPage floatingPool={floatingPool} />;
}

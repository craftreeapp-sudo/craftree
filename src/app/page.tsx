import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';

export const metadata: Metadata = {
  title: 'Craftree — De quoi est faite la civilisation ?',
  description:
    'Explorez l\'arbre complet des technologies humaines, de la matière première au produit final.',
};

export default function Home() {
  return <LandingPage />;
}

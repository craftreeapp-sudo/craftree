import { Header } from '@/components/layout/Header';
import { ConditionalFooter } from '@/components/layout/ConditionalFooter';

/**
 * Routes avec barre globale (recherche, filtres) : graphe, vues dérivées.
 * Sur /explore, pas de pied de page (liens secondaires dans ExploreWireframeHeader).
 */
export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-page text-foreground">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <ConditionalFooter />
    </div>
  );
}

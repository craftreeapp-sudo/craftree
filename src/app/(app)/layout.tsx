import { Header } from '@/components/layout/Header';
import { SiteFooter } from '@/components/layout/SiteFooter';

/**
 * Routes avec barre globale (recherche, filtres) : graphe, vues dérivées.
 * Timeline, Stats et navigation secondaire dans le pied de page, pas dans la barre du haut.
 */
export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-[#0A0E17] text-[#E8ECF4]">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <SiteFooter />
    </div>
  );
}

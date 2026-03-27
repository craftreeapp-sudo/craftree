import { ConditionalFooter } from '@/components/layout/ConditionalFooter';

/**
 * Routes avec barre globale (recherche, filtres) : graphe, vues dérivées.
 * Header global dans app/layout.tsx. Sur /explore, pas de pied de page.
 */
export default function AppShellLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen min-h-[100dvh] flex-col bg-page text-foreground">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <ConditionalFooter />
    </div>
  );
}

import { ConditionalFooter } from '@/components/layout/ConditionalFooter';

/**
 * Même coquille que (app)/layout : /tree/* doit garder le pied de page et le fond.
 * Les routes tree sont regroupées ici avec opengraph-image (hors route group) pour une URL stable.
 */
export default function TreeLayout({
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

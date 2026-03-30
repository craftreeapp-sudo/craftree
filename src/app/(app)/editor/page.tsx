import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EditorPageClient } from '@/components/editor/EditorPageClient';

export const metadata: Metadata = {
  title: { absolute: 'Craftree — Éditeur' },
  description: 'Gestion des inventions et des liens du graphe.',
};

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50dvh] items-center justify-center pt-14 text-muted-foreground">
          …
        </div>
      }
    >
      <EditorPageClient />
    </Suspense>
  );
}

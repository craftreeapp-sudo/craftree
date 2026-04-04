import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EditorPageClient } from '@/components/editor/EditorPageClient';

export const metadata: Metadata = {
  title: { absolute: 'Craftree — Administration' },
  description:
    'Administration : inventions, suggestions des contributeurs et liens du graphe.',
};

export default function AdminPage() {
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

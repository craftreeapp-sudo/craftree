'use client';

import { use } from 'react';
import Link from 'next/link';
import { ExplosionTreeView } from '@/components/graph/ExplosionTreeView';
import { useGraphStore } from '@/stores/graph-store';

export function TreePageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const root = useGraphStore((s) => s.getNodeById(id));
  const label = root?.name ?? id;

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-14">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#2A3042] bg-[#0A0E17]/95 px-4 py-2.5 backdrop-blur-md">
        <nav
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm"
          aria-label="Fil d’Ariane"
        >
          <Link
            href="/"
            className="shrink-0 text-[#3B82F6] transition-colors hover:underline"
          >
            Craftree
          </Link>
          <span className="text-[#8B95A8]" aria-hidden>
            ›
          </span>
          <span
            className="truncate font-medium text-[#E8ECF4]"
            title={label}
          >
            {label}
          </span>
          <span className="text-[#8B95A8]" aria-hidden>
            ›
          </span>
          <span className="text-[#8B95A8]">Arbre de dépendances</span>
        </nav>
        <Link
          href={`/explore?node=${encodeURIComponent(id)}`}
          className="shrink-0 rounded-lg border border-[#2A3042] bg-[#1A1F2E] px-3 py-1.5 text-xs font-medium text-[#E8ECF4] transition-colors hover:bg-[#2A3042]"
        >
          Retour au Tree
        </Link>
      </div>
      <div className="relative min-h-0 flex-1">
        <ExplosionTreeView rootId={id} />
      </div>
    </main>
  );
}

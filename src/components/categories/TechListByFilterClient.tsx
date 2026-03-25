'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useGraphStore } from '@/stores/graph-store';
import { useUIStore } from '@/stores/ui-store';
import { getCategoryColor } from '@/lib/colors';
import {
  ERA_LABELS_FR,
  NODE_CATEGORY_LABELS_FR,
  TECH_NODE_TYPE_LABELS_FR,
} from '@/lib/node-labels';
import type { FilterKind } from '@/lib/category-filter-routes';
import type {
  Era,
  NodeCategory,
  TechNodeType,
  TechNodeBasic,
} from '@/lib/types';

interface TechListByFilterClientProps {
  kind: FilterKind;
  id: string;
  title: string;
  subtitle?: string;
}

function filterNodes(
  nodes: TechNodeBasic[],
  kind: FilterKind,
  rawId: string
): TechNodeBasic[] {
  if (kind === 'category') {
    const cat = rawId as NodeCategory;
    return nodes.filter((n) => n.category === cat);
  }
  if (kind === 'era') {
    const era = rawId as Era;
    return nodes.filter((n) => n.era === era);
  }
  const t = rawId as TechNodeType;
  return nodes.filter((n) => n.type === t);
}

export function TechListByFilterClient({
  kind,
  id,
  title,
  subtitle,
}: TechListByFilterClientProps) {
  const router = useRouter();
  const allNodes = useGraphStore((s) => s.nodes);
  const setOnlyCategory = useUIStore((s) => s.setOnlyCategory);
  const setOnlyEra = useUIStore((s) => s.setOnlyEra);
  const setOnlyType = useUIStore((s) => s.setOnlyType);

  const items = useMemo(
    () =>
      [...filterNodes(allNodes, kind, id)].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr')
      ),
    [allNodes, kind, id]
  );

  const openFilteredGraph = () => {
    if (kind === 'category') setOnlyCategory(id as NodeCategory);
    else if (kind === 'era') setOnlyEra(id as Era);
    else setOnlyType(id as TechNodeType);
    router.push('/explore');
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-1 flex-col px-4 pb-24 pt-20 md:px-6 md:pt-24">
      <nav className="mb-6 text-sm text-[#8B95A8]">
        <Link
          href="/categories"
          className="text-[#3B82F6] transition-colors hover:underline"
        >
          ← Catégories
        </Link>
      </nav>

      <header className="mb-8 md:mb-10">
        <h1
          className="text-2xl font-semibold tracking-tight text-[#E8ECF4] md:text-3xl"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 text-sm text-[#8B95A8] md:text-base">{subtitle}</p>
        ) : null}
        <p className="mt-3 text-sm text-[#8B95A8]">
          {items.length} technologie{items.length > 1 ? 's' : ''} dans le jeu de
          données
        </p>
        <button
          type="button"
          onClick={openFilteredGraph}
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#3B82F6] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#3B82F6]/25 transition-colors hover:bg-[#60A5FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
        >
          Voir le Tree filtré
        </button>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl border border-[#2A3042] bg-[#1A1F2E] px-4 py-8 text-center text-sm text-[#8B95A8]">
          Aucune technologie ne correspond à ce filtre pour l’instant.
        </p>
      ) : (
        <ul
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          role="list"
        >
          {items.map((node) => {
            const c = getCategoryColor(node.category);
            return (
              <li key={node.id}>
                <Link
                  href={`/explore?node=${encodeURIComponent(node.id)}`}
                  className="flex h-full flex-col rounded-xl border border-[#2A3042] bg-[#1A1F2E] p-4 shadow-md transition-colors hover:border-[#3B82F6]/50 hover:bg-[#111827]/80"
                >
                  <span
                    className="mb-2 h-1 w-12 shrink-0 rounded-full"
                    style={{ backgroundColor: c }}
                    aria-hidden
                  />
                  <span className="font-medium leading-snug text-[#E8ECF4]">
                    {node.name}
                  </span>
                  <span className="mt-2 text-xs text-[#8B95A8]">
                    {NODE_CATEGORY_LABELS_FR[node.category]} ·{' '}
                    {ERA_LABELS_FR[node.era]} ·{' '}
                    {TECH_NODE_TYPE_LABELS_FR[node.type]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

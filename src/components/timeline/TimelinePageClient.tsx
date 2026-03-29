'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { NodeDetailSidebar } from '@/components/ui/NodeDetailSidebar';
import { ERA_ORDER } from '@/lib/node-labels';
import { treeInventionPath } from '@/lib/tree-routes';
import type { Era, TechNodeBasic } from '@/lib/types';
import { formatYear } from '@/lib/utils';
import { getCategoryColor } from '@/lib/colors';
import { safeCategoryLabel } from '@/lib/safe-category-label';

export function TimelinePageClient() {
  const tCat = useTranslations('categories');
  const tTypes = useTranslations('types');
  const tEra = useTranslations('eras');
  const tNav = useTranslations('nav');
  const nodes = useGraphStore((s) => s.nodes);
  const refreshData = useGraphStore((s) => s.refreshData);

  useEffect(() => {
    if (nodes.length === 0) void refreshData();
  }, [nodes.length, refreshData]);

  const byEra = useMemo(() => {
    const map = new Map<Era, TechNodeBasic[]>();
    for (const e of ERA_ORDER) map.set(e, []);
    for (const n of nodes) {
      const list = map.get(n.era as Era);
      if (list) list.push(n);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const ya = a.year_approx ?? 0;
        const yb = b.year_approx ?? 0;
        if (ya !== yb) return ya - yb;
        return a.name.localeCompare(b.name, 'fr');
      });
    }
    return map;
  }, [nodes]);

  return (
    <main className="relative min-h-[calc(100dvh-3.5rem)] flex-1 overflow-y-auto bg-page pt-14">
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        <h1
          className="mb-6 text-2xl font-bold text-foreground"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          {tNav('timeline')}
        </h1>
        {ERA_ORDER.map((era) => {
          const list = byEra.get(era) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={era} className="mb-10">
              <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {tEra(era)}
              </h2>
              <ul className="space-y-2">
                {list.map((n) => {
                  const cat = getCategoryColor(n.category);
                  return (
                    <li key={n.id}>
                      <Link
                        href={treeInventionPath(n.id)}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-left shadow-sm transition-[transform,box-shadow] hover:scale-[1.01] hover:shadow-md"
                      >
                        <span className="font-medium text-foreground">
                          {n.name}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className="rounded px-1.5 py-0.5 font-medium"
                            style={{
                              backgroundColor: `${cat}22`,
                              color: cat,
                            }}
                          >
                            {safeCategoryLabel(tCat, String(n.category), tTypes)}
                          </span>
                          <span className="tabular-nums">
                            {formatYear(n.year_approx ?? null)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <NodeDetailSidebar />
    </main>
  );
}

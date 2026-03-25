'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { getCategoryColor } from '@/lib/colors';
import {
  ERA_DATE_RANGES,
  ERA_LABELS_FR,
  ERA_ORDER,
  NODE_CATEGORY_LABELS_FR,
  NODE_CATEGORY_ORDER,
} from '@/lib/node-labels';

const CATEGORY_PREVIEW_COUNT = 5;

export function ExploreFilterDrawer() {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const open = useUIStore((s) => s.filterDrawerOpen);
  const setOpen = useUIStore((s) => s.setFilterDrawerOpen);
  const activeCategories = useUIStore((s) => s.activeCategories);
  const activeEras = useUIStore((s) => s.activeEras);
  const toggleCategory = useUIStore((s) => s.toggleCategory);
  const toggleEra = useUIStore((s) => s.toggleEra);
  const setAllCategories = useUIStore((s) => s.setAllCategories);
  const setAllEras = useUIStore((s) => s.setAllEras);

  return (
    <>
      <button
        type="button"
        aria-hidden={!open}
        className={`fixed inset-0 top-14 z-[45] bg-black/50 transition-opacity md:top-14 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`fixed left-0 top-14 z-[50] flex h-[calc(100dvh-3.5rem)] w-[280px] flex-col border-r border-[#2A3042] bg-[#111827] shadow-xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#2A3042] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#E8ECF4]">Filtres</h2>
          <button
            type="button"
            className="rounded p-1 text-[#8B95A8] hover:bg-[#1A1F2E] hover:text-[#E8ECF4]"
            aria-label="Fermer les filtres"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <section className="mb-8">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B95A8]">
              Catégories
            </h3>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                className="rounded bg-[#1A1F2E] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#2A3042]"
                onClick={() => setAllCategories(true)}
              >
                Tout
              </button>
              <button
                type="button"
                className="rounded bg-[#1A1F2E] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#2A3042]"
                onClick={() => setAllCategories(false)}
              >
                Aucun
              </button>
            </div>
            <ul className="space-y-1">
              {(showAllCategories
                ? NODE_CATEGORY_ORDER
                : NODE_CATEGORY_ORDER.slice(0, CATEGORY_PREVIEW_COUNT)
              ).map((cat) => {
                const active = activeCategories.has(cat);
                const color = getCategoryColor(cat);
                return (
                  <li key={cat}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#1A1F2E]/80">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleCategory(cat)}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#2A3042] bg-[#0A0E17] accent-[#3B82F6] ring-offset-[#0A0E17] focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                      />
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className={active ? 'text-[#E8ECF4]' : 'text-[#8B95A8]'}>
                        {NODE_CATEGORY_LABELS_FR[cat]}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {NODE_CATEGORY_ORDER.length > CATEGORY_PREVIEW_COUNT ? (
              <button
                type="button"
                className="mt-2 w-full rounded-md border border-[#2A3042] bg-[#1A1F2E] py-2 text-xs font-medium text-[#3B82F6] transition-colors hover:bg-[#2A3042]"
                onClick={() => setShowAllCategories((v) => !v)}
              >
                {showAllCategories ? 'Afficher moins' : 'Afficher tout'}
              </button>
            ) : null}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B95A8]">
              Époques
            </h3>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                className="rounded bg-[#1A1F2E] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#2A3042]"
                onClick={() => setAllEras(true)}
              >
                Tout
              </button>
              <button
                type="button"
                className="rounded bg-[#1A1F2E] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#2A3042]"
                onClick={() => setAllEras(false)}
              >
                Aucun
              </button>
            </div>
            <ul className="space-y-1">
              {ERA_ORDER.map((era) => {
                const active = activeEras.has(era);
                return (
                  <li key={era}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#1A1F2E]/80">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleEra(era)}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#2A3042] bg-[#0A0E17] accent-[#3B82F6] ring-offset-[#0A0E17] focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                      />
                      <span className={active ? 'text-[#E8ECF4]' : 'text-[#8B95A8]'}>
                        {ERA_LABELS_FR[era]}{' '}
                        <span className="text-[11px] text-[#6B7280]">
                          ({ERA_DATE_RANGES[era]})
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="shrink-0 border-t border-[#8B95A8]/40 px-4 py-3">
          <Link
            href="/about"
            className="text-sm text-[#8B95A8] transition-colors hover:text-[#3B82F6]"
            onClick={() => setOpen(false)}
          >
            À propos
          </Link>
        </div>
      </aside>
    </>
  );
}

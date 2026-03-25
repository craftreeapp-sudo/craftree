'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { getCategoryColor } from '@/lib/colors';
import {
  ERA_DATE_RANGES,
  ERA_LABELS_FR,
  ERA_ORDER,
  NODE_CATEGORY_LABELS_FR,
  NODE_CATEGORY_ORDER,
  TECH_NODE_TYPE_LABELS_FR,
  TECH_NODE_TYPE_ORDER,
} from '@/lib/node-labels';

type OpenPanel = 'categories' | 'eras' | 'types' | null;

const CATEGORY_PREVIEW_COUNT = 5;

const panelBtnClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-[#2A3042] bg-[#1A1F2E] px-2.5 py-1.5 text-xs font-medium text-[#E8ECF4] transition-colors hover:bg-[#2A3042] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]';

const dropdownClass =
  'absolute right-0 top-full z-[60] mt-1.5 w-[min(100vw-2rem,280px)] max-h-[min(70vh,320px)] overflow-y-auto rounded-lg border border-[#2A3042] bg-[#111827] py-2 shadow-xl';

export function FilterPanel() {
  const [open, setOpen] = useState<OpenPanel>(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const activeCategories = useUIStore((s) => s.activeCategories);
  const activeEras = useUIStore((s) => s.activeEras);
  const activeTypes = useUIStore((s) => s.activeTypes);
  const toggleCategory = useUIStore((s) => s.toggleCategory);
  const toggleEra = useUIStore((s) => s.toggleEra);
  const toggleType = useUIStore((s) => s.toggleType);
  const setAllCategories = useUIStore((s) => s.setAllCategories);
  const setAllEras = useUIStore((s) => s.setAllEras);
  const setAllTypes = useUIStore((s) => s.setAllTypes);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(null);
        setShowAllCategories(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = useCallback((panel: Exclude<OpenPanel, null>) => {
    setOpen((o) => {
      const next = o === panel ? null : panel;
      if (next !== 'categories') setShowAllCategories(false);
      return next;
    });
  }, []);

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-1.5">
      {/* Catégories */}
      <div className="relative">
        <button
          type="button"
          className={panelBtnClass}
          aria-expanded={open === 'categories'}
          aria-haspopup="listbox"
          onClick={() => toggle('categories')}
        >
          Catégories
          <span className="text-[#8B95A8]" aria-hidden>
            ▾
          </span>
        </button>
        {open === 'categories' ? (
          <div className={dropdownClass} role="listbox" aria-label="Filtre par catégorie">
            <div className="mb-2 flex gap-2 border-b border-[#2A3042] px-3 pb-2">
              <button
                type="button"
                className="rounded bg-[#2A3042] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#3B4558]"
                onClick={() => setAllCategories(true)}
              >
                Tout
              </button>
              <button
                type="button"
                className="rounded bg-[#2A3042] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#3B4558]"
                onClick={() => setAllCategories(false)}
              >
                Aucun
              </button>
            </div>
            <ul className="space-y-0.5 px-2">
              {(showAllCategories
                ? NODE_CATEGORY_ORDER
                : NODE_CATEGORY_ORDER.slice(0, CATEGORY_PREVIEW_COUNT)
              ).map((cat) => {
                const active = activeCategories.has(cat);
                const color = getCategoryColor(cat);
                return (
                  <li key={cat}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        active
                          ? 'bg-[#1A1F2E] text-[#E8ECF4]'
                          : 'text-[#8B95A8] hover:bg-[#1A1F2E]/80'
                      }`}
                      onClick={() => toggleCategory(cat)}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                        style={{ backgroundColor: color, opacity: active ? 1 : 0.35 }}
                      />
                      <span className="flex-1">{NODE_CATEGORY_LABELS_FR[cat]}</span>
                      {active ? (
                        <span className="text-[10px] text-[#3B82F6]">✓</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {NODE_CATEGORY_ORDER.length > CATEGORY_PREVIEW_COUNT ? (
              <div className="border-t border-[#2A3042] px-2 pt-2">
                <button
                  type="button"
                  className="w-full rounded-md border border-[#2A3042] bg-[#1A1F2E] py-1.5 text-xs font-medium text-[#3B82F6] transition-colors hover:bg-[#2A3042]"
                  onClick={() => setShowAllCategories((v) => !v)}
                >
                  {showAllCategories ? 'Afficher moins' : 'Afficher tout'}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Époques */}
      <div className="relative">
        <button
          type="button"
          className={panelBtnClass}
          aria-expanded={open === 'eras'}
          aria-haspopup="listbox"
          onClick={() => toggle('eras')}
        >
          Époques
          <span className="text-[#8B95A8]" aria-hidden>
            ▾
          </span>
        </button>
        {open === 'eras' ? (
          <div className={dropdownClass} role="listbox" aria-label="Filtre par époque">
            <div className="mb-2 flex gap-2 border-b border-[#2A3042] px-3 pb-2">
              <button
                type="button"
                className="rounded bg-[#2A3042] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#3B4558]"
                onClick={() => setAllEras(true)}
              >
                Tout
              </button>
              <button
                type="button"
                className="rounded bg-[#2A3042] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#3B4558]"
                onClick={() => setAllEras(false)}
              >
                Aucun
              </button>
            </div>
            <ul className="space-y-0.5 px-2">
              {ERA_ORDER.map((era) => {
                const active = activeEras.has(era);
                return (
                  <li key={era}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                        active
                          ? 'bg-[#1A1F2E] text-[#E8ECF4]'
                          : 'text-[#8B95A8] hover:bg-[#1A1F2E]/80'
                      }`}
                      onClick={() => toggleEra(era)}
                    >
                      <span className="font-medium">
                        {ERA_LABELS_FR[era]}{' '}
                        <span className="font-normal text-[#8B95A8]">
                          ({ERA_DATE_RANGES[era]})
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Types */}
      <div className="relative">
        <button
          type="button"
          className={panelBtnClass}
          aria-expanded={open === 'types'}
          aria-haspopup="listbox"
          onClick={() => toggle('types')}
        >
          Types
          <span className="text-[#8B95A8]" aria-hidden>
            ▾
          </span>
        </button>
        {open === 'types' ? (
          <div className={dropdownClass} role="listbox" aria-label="Filtre par type">
            <div className="mb-2 flex gap-2 border-b border-[#2A3042] px-3 pb-2">
              <button
                type="button"
                className="rounded bg-[#2A3042] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#3B4558]"
                onClick={() => setAllTypes(true)}
              >
                Tout
              </button>
              <button
                type="button"
                className="rounded bg-[#2A3042] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#3B4558]"
                onClick={() => setAllTypes(false)}
              >
                Aucun
              </button>
            </div>
            <ul className="space-y-0.5 px-2">
              {TECH_NODE_TYPE_ORDER.map((t) => {
                const active = activeTypes.has(t);
                return (
                  <li key={t}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm capitalize transition-colors ${
                        active
                          ? 'bg-[#1A1F2E] text-[#E8ECF4]'
                          : 'text-[#8B95A8] hover:bg-[#1A1F2E]/80'
                      }`}
                      onClick={() => toggleType(t)}
                    >
                      <span className="flex-1">{TECH_NODE_TYPE_LABELS_FR[t]}</span>
                      <span className="font-mono text-[10px] text-[#6B7280]">{t}</span>
                      {active ? (
                        <span className="text-[10px] text-[#3B82F6]">✓</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

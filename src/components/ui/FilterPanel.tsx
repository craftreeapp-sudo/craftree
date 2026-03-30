'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { getCategoryColor } from '@/lib/colors';
import {
  ERA_ORDER,
  NODE_CATEGORY_ORDER,
  TECH_NODE_TYPE_ORDER,
} from '@/lib/node-labels';
import { eraLabelFromMessages } from '@/lib/era-display';
import type { Era } from '@/lib/types';

type OpenPanel = 'categories' | 'eras' | 'types' | null;

const CATEGORY_PREVIEW_COUNT = 5;

const panelBtnClass =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus';

const dropdownClass =
  'absolute end-0 top-full z-[60] mt-1.5 w-[min(100vw-2rem,280px)] max-h-[min(70vh,320px)] overflow-y-auto rounded-lg border border-border bg-surface py-2 shadow-xl';

export function FilterPanel() {
  const locale = useLocale();
  const tf = useTranslations('filters');
  const tc = useTranslations('common');
  const tCat = useTranslations('categories');
  const tType = useTranslations('types');

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
          {tf('categories')}
          <span className="text-muted-foreground" aria-hidden>
            ▾
          </span>
        </button>
        {open === 'categories' ? (
          <div className={dropdownClass} role="listbox" aria-label={tf('categories')}>
            <div className="mb-2 flex gap-2 border-b border-border px-3 pb-2">
              <button
                type="button"
                className="rounded bg-border/35 px-2 py-1 text-[11px] text-foreground hover:bg-border/55"
                onClick={() => setAllCategories(true)}
              >
                {tc('all')}
              </button>
              <button
                type="button"
                className="rounded bg-border/35 px-2 py-1 text-[11px] text-foreground hover:bg-border/55"
                onClick={() => setAllCategories(false)}
              >
                {tc('none')}
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
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm transition-colors ${
                        active
                          ? 'bg-surface-elevated text-foreground'
                          : 'text-muted-foreground hover:bg-surface-elevated/80'
                      }`}
                      onClick={() => toggleCategory(cat)}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                        style={{ backgroundColor: color, opacity: active ? 1 : 0.35 }}
                      />
                      <span className="flex-1">{tCat(cat)}</span>
                      {active ? (
                        <span className="text-[10px] text-accent">✓</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
            {NODE_CATEGORY_ORDER.length > CATEGORY_PREVIEW_COUNT ? (
              <div className="border-t border-border px-2 pt-2">
                <button
                  type="button"
                  className="w-full rounded-md border border-border bg-surface-elevated py-1.5 text-xs font-medium text-accent transition-colors hover:bg-border"
                  onClick={() => setShowAllCategories((v) => !v)}
                >
                  {showAllCategories ? tf('showLess') : tf('showMore')}
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
          {tf('eras')}
          <span className="text-muted-foreground" aria-hidden>
            ▾
          </span>
        </button>
        {open === 'eras' ? (
          <div className={dropdownClass} role="listbox" aria-label={tf('eras')}>
            <div className="mb-2 flex gap-2 border-b border-border px-3 pb-2">
              <button
                type="button"
                className="rounded bg-border/35 px-2 py-1 text-[11px] text-foreground hover:bg-border/55"
                onClick={() => setAllEras(true)}
              >
                {tc('all')}
              </button>
              <button
                type="button"
                className="rounded bg-border/35 px-2 py-1 text-[11px] text-foreground hover:bg-border/55"
                onClick={() => setAllEras(false)}
              >
                {tc('none')}
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
                      className={`flex w-full flex-col rounded-md px-2 py-1.5 text-start text-sm transition-colors ${
                        active
                          ? 'bg-surface-elevated text-foreground'
                          : 'text-muted-foreground hover:bg-surface-elevated/80'
                      }`}
                      onClick={() => toggleEra(era)}
                    >
                      <span className="text-start text-sm font-medium">
                        {eraLabelFromMessages(locale, era as Era)}
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
          {tf('types')}
          <span className="text-muted-foreground" aria-hidden>
            ▾
          </span>
        </button>
        {open === 'types' ? (
          <div className={dropdownClass} role="listbox" aria-label={tf('types')}>
            <div className="mb-2 flex gap-2 border-b border-border px-3 pb-2">
              <button
                type="button"
                className="rounded bg-border/35 px-2 py-1 text-[11px] text-foreground hover:bg-border/55"
                onClick={() => setAllTypes(true)}
              >
                {tc('all')}
              </button>
              <button
                type="button"
                className="rounded bg-border/35 px-2 py-1 text-[11px] text-foreground hover:bg-border/55"
                onClick={() => setAllTypes(false)}
              >
                {tc('none')}
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
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm capitalize transition-colors ${
                        active
                          ? 'bg-surface-elevated text-foreground'
                          : 'text-muted-foreground hover:bg-surface-elevated/80'
                      }`}
                      onClick={() => toggleType(t)}
                    >
                      <span className="flex-1">{tType(t)}</span>
                      <span className="font-mono text-[10px] text-[#6B7280]">{t}</span>
                      {active ? (
                        <span className="text-[10px] text-accent">✓</span>
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

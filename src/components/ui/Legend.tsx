'use client';

import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { getCategoryColor } from '@/lib/colors';
import {
  NODE_CATEGORY_LABELS_FR,
  NODE_CATEGORY_ORDER,
} from '@/lib/node-labels';
import type { NodeCategory } from '@/lib/types';

const DRAWER_W_PX = 280;
const LEGEND_MARGIN_PX = 20; /* aligné sur left-5 */

function LegendHelpIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-[#8B95A8]/90 text-[9px] font-bold leading-none text-[#8B95A8]"
    >
      ?
    </span>
  );
}

/**
 * Légende repliable sur la vue /explore (fixed, sous le header — hors zone pied de page).
 * Se décale à droite lorsque le panneau filtres gauche est ouvert.
 */
export function Legend() {
  const [isExpanded, setIsExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const filterDrawerOpen = useUIStore((s) => s.filterDrawerOpen);

  useEffect(() => {
    if (!isExpanded) return;
    const onDoc = (e: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(e.target as globalThis.Node)
      ) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isExpanded]);

  const leftPx =
    LEGEND_MARGIN_PX + (filterDrawerOpen ? DRAWER_W_PX : 0);

  return (
    <div
      ref={rootRef}
      className={`pointer-events-auto fixed top-[4.5rem] z-[60] overflow-hidden rounded-lg border border-[#2A3042] bg-[#1A1F2E] shadow-lg transition-[left,width] duration-300 ease-out ${
        isExpanded ? 'cursor-default' : 'cursor-pointer'
      }`}
      style={{
        left: leftPx,
        width: isExpanded ? 300 : 100,
        height: isExpanded ? 'auto' : 36,
      }}
    >
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 px-2 text-xs font-medium text-[#E8ECF4] hover:bg-[#111827]/80"
        >
          Légende
          <LegendHelpIcon />
        </button>
      ) : (
        <div className="flex flex-col p-3 pb-3.5 text-[11px] text-[#8B95A8]">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#E8ECF4]">
              Légende
              <LegendHelpIcon />
            </span>
            <button
              type="button"
              className="cursor-pointer rounded p-1 text-[#8B95A8] hover:bg-[#2A3042] hover:text-[#E8ECF4]"
              aria-label="Replier la légende"
              onClick={() => setIsExpanded(false)}
            >
              ×
            </button>
          </div>
          <div className="space-y-3 pr-0.5">
            <section>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#5B6478]">
                Types de liens
              </h3>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-px w-7 shrink-0 bg-[#94A3B8]" />
                  <span>Matériau (consommé)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="inline-block h-0 w-7 shrink-0 border-t-2 border-dotted border-[#A78BFA]"
                    style={{ borderStyle: 'dotted' }}
                  />
                  <span>Outil (non consommé)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block w-7 shrink-0 border-t-2 border-dashed border-[#EF4444]" />
                  <span>Énergie</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block w-7 shrink-0 border-t border-dotted border-[#38BDF8]" />
                  <span>Connaissance</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-px w-7 shrink-0 bg-[#8B95A8]/60" />
                  <span>Catalyseur</span>
                </li>
              </ul>
            </section>
            <section>
              <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#5B6478]">
                Catégories
              </h3>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
                {NODE_CATEGORY_ORDER.map((cat: NodeCategory) => (
                  <li key={cat} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: getCategoryColor(cat) }}
                    />
                    <span className="truncate text-[10px] leading-tight">
                      {NODE_CATEGORY_LABELS_FR[cat]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

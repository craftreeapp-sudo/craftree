'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { getCategoryColor } from '@/lib/colors';
import { isRtlLocale } from '@/lib/i18n-config';
import { NODE_CATEGORY_ORDER } from '@/lib/node-labels';
import type { NodeCategory } from '@/lib/types';
import {
  INVENTION_KIND_ORDER,
  type InventionKindKey,
  relationTypeFromInventionKind,
} from '@/lib/invention-classification';
import { RelationType } from '@/lib/types';

const LEGEND_RELATION_DOT: Record<RelationType, string> = {
  [RelationType.MATERIAL]: '#94A3B8',
  [RelationType.COMPONENT]: '#EAB308',
  [RelationType.TOOL]: '#A78BFA',
  [RelationType.ENERGY]: '#EF4444',
  [RelationType.PROCESS]: '#38BDF8',
  [RelationType.INFRASTRUCTURE]: '#64748B',
};

function legendLinkDot(kind: InventionKindKey): string {
  if (
    kind === 'matter_raw' ||
    kind === 'matter_processed' ||
    kind === 'matter_industrial'
  ) {
    return '#94A3B8';
  }
  return LEGEND_RELATION_DOT[relationTypeFromInventionKind(kind)];
}

const LEGEND_MARGIN_PX = 20;
/** Marge cohérente avec la zone principale /explore. */
const CATEGORY_PANEL_W_PX = 200;
const CATEGORY_PANEL_GAP_PX = 8;
/** Bouton « rouvrir » (focus, panneau replié) : `left-3` + w-10 + petit espace. */
const CATEGORY_REOPEN_STRIP_PX = 12 + 40 + CATEGORY_PANEL_GAP_PX;

const LEGEND_COLLAPSED_W_PX = 96;
const LEGEND_EXPANDED_W_PX = 220;

function LegendHelpIcon() {
  return (
    <span
      aria-hidden
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-[#8B95A8]/90 text-[9px] font-bold leading-none text-muted-foreground"
    >
      ?
    </span>
  );
}

/**
 * Légende repliable sur la vue /explore (fixed, sous le header — hors zone pied de page).
 */
export function Legend() {
  const locale = useLocale();
  const isRtl = isRtlLocale(locale);
  const t = useTranslations('legend');
  const tInv = useTranslations('inventionKinds');
  const tc = useTranslations('common');
  const tCat = useTranslations('categories');
  const tSidebar = useTranslations('sidebar');

  const [isExpanded, setIsExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const categoryPanelOpen = useUIStore((s) => s.categoryPanelOpen);
  /** Ancienne fiche latérale supprimée ; la légende ne se décale plus pour ce panneau. */
  const focusExploreActive = false;
  const categoryPanelLegendOffsetPx = (() => {
    if (!focusExploreActive) return 0;
    if (categoryPanelOpen) {
      return (
        CATEGORY_PANEL_W_PX + CATEGORY_PANEL_GAP_PX - LEGEND_MARGIN_PX
      );
    }
    return CATEGORY_REOPEN_STRIP_PX - LEGEND_MARGIN_PX;
  })();

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

  const insetPx = LEGEND_MARGIN_PX + categoryPanelLegendOffsetPx;

  return (
    <div
      ref={rootRef}
      className={`fixed top-[4.5rem] z-[60] overflow-hidden rounded-lg glass-search-field shadow-lg ease-out ${
        isRtl ? 'transition-[right,width,opacity]' : 'transition-[left,width,opacity]'
      } duration-200 ${isExpanded ? 'cursor-default' : 'cursor-pointer'} pointer-events-auto opacity-100`}
      style={{
        ...(isRtl ? { right: insetPx } : { left: insetPx }),
        width: isExpanded ? LEGEND_EXPANDED_W_PX : LEGEND_COLLAPSED_W_PX,
        height: isExpanded ? 'auto' : 36,
      }}
    >
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 px-2 text-xs font-medium text-foreground hover:bg-surface/80"
        >
          {tc('legend')}
          <LegendHelpIcon />
        </button>
      ) : (
        <div className="flex flex-col px-2.5 py-2.5 pb-3 text-xs text-muted-foreground">
          <div className="mb-2 flex shrink-0 items-center gap-1.5">
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
              {tc('legend')}
              <LegendHelpIcon />
            </span>
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-base leading-none text-muted-foreground hover:bg-border hover:text-foreground"
              aria-label={tSidebar('collapseLegend')}
              onClick={() => setIsExpanded(false)}
            >
              ×
            </button>
          </div>
          <div className="space-y-3">
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#5B6478]">
                {t('linkTypes')}
              </h3>
              <ul className="space-y-1.5">
                {INVENTION_KIND_ORDER.map((kind) => (
                  <li key={kind} className="flex items-center gap-2">
                    <span
                      className="inline-block h-1.5 w-7 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: legendLinkDot(kind),
                      }}
                    />
                    <span>{tInv(kind)}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#5B6478]">
                {t('nodeTypes')}
              </h3>
              <ul className="flex flex-col gap-1">
                {NODE_CATEGORY_ORDER.map((cat: NodeCategory) => (
                  <li key={cat} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ backgroundColor: getCategoryColor(cat) }}
                    />
                    <span className="leading-tight">{tCat(cat)}</span>
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

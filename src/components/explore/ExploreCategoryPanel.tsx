'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore, getNodeDetails } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { getCategoryColor } from '@/lib/colors';
import { formatYear } from '@/lib/utils';
import { isRtlLocale } from '@/lib/i18n-config';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { getNameEnForNode } from '@/lib/name-en-lookup';
import type { NodeCategory, TechNodeBasic, TechNodeDetails } from '@/lib/types';

const PANEL_W = 200;
const HOVER_TOOLTIP_MS = 200;
const TOOLTIP_GAP_PX = 10;
const TOOLTIP_MAX_W_PX = 320;

const CATEGORY_TOGGLE_BTN =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-elevated transition-colors hover:bg-border';

/** Icône « déplié » : ouvrir le panneau (barre au bord extérieur + chevron vers l’intérieur). */
function CategoryPanelIconExpand({ isRtl }: { isRtl: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {isRtl ? (
        <>
          <path d="m11 9 3 3-3 3" />
          <line x1="15" y1="5" x2="15" y2="19" />
        </>
      ) : (
        <>
          <line x1="9" y1="5" x2="9" y2="19" />
          <path d="m13 9 3 3-3 3" />
        </>
      )}
    </svg>
  );
}

/** Icône « replié » : rabattre le panneau (chevron vers l’extérieur + barre au bord du graphe). */
function CategoryPanelIconCollapse({ isRtl }: { isRtl: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {isRtl ? (
        <>
          <line x1="9" y1="5" x2="9" y2="19" />
          <path d="m13 9 3 3-3 3" />
        </>
      ) : (
        <>
          <path d="m11 9-3 3 3 3" />
          <line x1="15" y1="5" x2="15" y2="19" />
        </>
      )}
    </svg>
  );
}

function pickPanelDescription(
  detail: TechNodeDetails | null | undefined,
  locale: string
): string {
  if (!detail) return '';
  const frenchUi = locale === 'fr' || locale.startsWith('fr-');
  if (frenchUi) return detail.description?.trim() ?? '';
  const en = detail.description_en?.trim();
  if (en) return en;
  return detail.description?.trim() ?? '';
}

export function ExploreCategoryPanel() {
  const locale = useLocale();
  const isRtl = isRtlLocale(locale);
  const tExplore = useTranslations('explore');
  const tCat = useTranslations('categories');

  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const categoryPanelOpen = useUIStore((s) => s.categoryPanelOpen);
  const setCategoryPanelOpen = useUIStore((s) => s.setCategoryPanelOpen);

  const nodes = useGraphStore((s) => s.nodes);
  const { navigateToNode } = useExploreNavigation();
  const detailsById = useNodeDetailsStore((s) => s.byId);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);

  const [tooltip, setTooltip] = useState<{
    top: number;
    left: number;
    transform: string;
    title: string;
    body: string;
    emptyLabel: string;
  } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** ID de la ligne encore survolée (robuste après await ; évite SyntheticEvent.currentTarget null dans setTimeout). */
  const hoveredRowIdRef = useRef<string | null>(null);

  const focusActive = Boolean(selectedNodeId && isSidebarOpen);
  const selected = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : undefined),
    [nodes, selectedNodeId]
  );

  const sameCategoryList = useMemo(() => {
    if (!selected) return [];
    return [...nodes]
      .filter((n) => n.category === selected.category)
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [nodes, selected, locale]);

  const categoryColor = selected
    ? getCategoryColor(selected.category as NodeCategory)
    : '#3B82F6';

  const panelSideClass = isRtl ? 'right-0 border-l' : 'left-0 border-r';

  const clearTooltip = useCallback(() => {
    hoveredRowIdRef.current = null;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setTooltip(null);
  }, []);

  const openTooltip = useCallback(
    async (n: TechNodeBasic, anchorEl: HTMLElement | null) => {
      if (!anchorEl || hoveredRowIdRef.current !== n.id) return;
      let detail = useNodeDetailsStore.getState().byId[n.id];
      if (detail === undefined) {
        const fetched = await getNodeDetails(n.id);
        if (fetched) mergeDetail(n.id, fetched);
        detail = useNodeDetailsStore.getState().byId[n.id];
      }
      if (!anchorEl.isConnected || hoveredRowIdRef.current !== n.id) return;
      const nameEn =
        detail?.name_en?.trim() || getNameEnForNode(n.id);
      const title = pickNodeDisplayName(locale, n.name, nameEn);
      const body = pickPanelDescription(detail ?? null, locale);
      let rect: DOMRect;
      try {
        rect = anchorEl.getBoundingClientRect();
      } catch {
        return;
      }
      /** À droite du panneau (LTR) ou à gauche de la ligne (RTL) ; centré verticalement sur la carte. */
      const top = rect.top + rect.height / 2;
      let left: number;
      if (isRtl) {
        left = Math.max(
          TOOLTIP_GAP_PX,
          rect.left - TOOLTIP_GAP_PX - TOOLTIP_MAX_W_PX
        );
      } else {
        left = rect.right + TOOLTIP_GAP_PX;
        if (left + TOOLTIP_MAX_W_PX > window.innerWidth - TOOLTIP_GAP_PX) {
          left = Math.max(
            TOOLTIP_GAP_PX,
            window.innerWidth - TOOLTIP_GAP_PX - TOOLTIP_MAX_W_PX
          );
        }
      }
      setTooltip({
        top,
        left,
        transform: 'translateY(-50%)',
        title,
        body,
        emptyLabel: tExplore('focusTooltipNoDescription'),
      });
    },
    [isRtl, locale, mergeDetail, tExplore]
  );

  const onRowPointerEnter = useCallback(
    (n: TechNodeBasic, e: PointerEvent<HTMLElement>) => {
      const anchor = e.currentTarget;
      hoveredRowIdRef.current = n.id;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null;
        void openTooltip(n, anchor);
      }, HOVER_TOOLTIP_MS);
    },
    [openTooltip]
  );

  const onRowPointerLeave = useCallback(() => {
    clearTooltip();
  }, [clearTooltip]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  useEffect(() => {
    queueMicrotask(() => clearTooltip());
  }, [selectedNodeId, categoryPanelOpen, clearTooltip]);

  if (!focusActive) return null;

  return (
    <>
      <AnimatePresence>
        {categoryPanelOpen && selected ? (
          <motion.aside
            key="category-panel"
            initial={{ x: isRtl ? PANEL_W : -PANEL_W }}
            animate={{ x: 0 }}
            exit={{ x: isRtl ? PANEL_W : -PANEL_W }}
            transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
            className={`fixed top-14 z-[45] flex h-[calc(100dvh-3.5rem)] w-[200px] flex-col border-border bg-surface p-3 [border-width:0.5px] ${panelSideClass}`}
            aria-label={tExplore('categoryPanelAria', {
              category: tCat(selected.category as NodeCategory),
            })}
          >
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <h2
                className="min-w-0 flex-1 text-[14px] font-bold leading-tight"
                style={{ color: categoryColor }}
              >
                {tCat(selected.category as NodeCategory)}{' '}
                <span className="font-semibold text-muted-foreground">
                  ({sameCategoryList.length})
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setCategoryPanelOpen(false)}
                className={CATEGORY_TOGGLE_BTN}
                style={{ color: categoryColor }}
                aria-label={tExplore('categoryPanelCloseAria')}
                title={tExplore('categoryPanelCloseAria')}
              >
                <CategoryPanelIconCollapse isRtl={isRtl} />
              </button>
            </div>
            <div
              className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5 [scrollbar-color:var(--scrollbar-thumb)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--scrollbar-thumb)]"
            >
              {sameCategoryList.map((n) => {
                const isCurrent = n.id === selectedNodeId;
                const yearStr = formatYear(n.year_approx ?? null);
                const nameEnResolved =
                  detailsById[n.id]?.name_en?.trim() ||
                  getNameEnForNode(n.id);
                const rowLabel = pickNodeDisplayName(
                  locale,
                  n.name,
                  nameEnResolved
                );
                return (
                  <div key={n.id}>
                    {isCurrent ? (
                      <div
                        role="group"
                        onPointerEnter={(e) => onRowPointerEnter(n, e)}
                        onPointerLeave={onRowPointerLeave}
                        className="flex h-[50px] w-full max-w-full flex-col justify-center rounded-[6px] border border-border border-l-[3px] px-2.5 py-2"
                        style={{
                          borderLeftColor: categoryColor,
                          backgroundColor: 'var(--panel-row-selected-bg)',
                        }}
                        aria-current="true"
                      >
                        <span
                          className="truncate text-[13px] font-bold"
                          style={{ color: 'var(--panel-row-selected-fg)' }}
                        >
                          {rowLabel}
                        </span>
                        {yearStr ? (
                          <span
                            className="truncate text-[11px]"
                            style={{ color: 'var(--panel-row-selected-meta)' }}
                          >
                            {yearStr}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onPointerEnter={(e) => onRowPointerEnter(n, e)}
                        onPointerLeave={onRowPointerLeave}
                        onClick={() =>
                          navigateToNode(n.id, {
                            center: true,
                            forceFocusTransition: true,
                          })
                        }
                        className="flex h-[50px] w-full max-w-full flex-col justify-center rounded-[6px] border border-border bg-surface-elevated px-2.5 py-2 text-left transition-colors hover:border-[color:var(--cat)] hover:bg-[color:var(--panel-row-hover-bg)]"
                        style={{ ['--cat' as string]: categoryColor } as CSSProperties}
                      >
                        <span className="truncate text-[13px] font-bold text-foreground">
                          {rowLabel}
                        </span>
                        {yearStr ? (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {yearStr}
                          </span>
                        ) : null}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {focusActive && selected && !categoryPanelOpen ? (
          <motion.div
            key="category-reopen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`fixed top-14 z-[46] flex h-14 items-start pt-2 ${
              isRtl ? 'right-3 md:right-4' : 'left-3 md:left-4'
            }`}
          >
            <button
              type="button"
              onClick={() => setCategoryPanelOpen(true)}
              className={CATEGORY_TOGGLE_BTN}
              style={{ color: categoryColor }}
              aria-label={tExplore('categoryPanelReopenAria')}
              title={tExplore('categoryPanelReopen')}
            >
              <CategoryPanelIconExpand isRtl={isRtl} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {tooltip && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[99999]"
              style={{
                top: tooltip.top,
                left: tooltip.left,
                transform: tooltip.transform,
              }}
            >
              <div
                className="rounded-lg border border-border bg-surface-elevated px-4 py-3 shadow-xl"
                style={{ maxWidth: TOOLTIP_MAX_W_PX }}
              >
                <div className="text-[14px] font-bold text-foreground">
                  {tooltip.title}
                </div>
                <div
                  className="mt-1 max-h-[min(58vh,520px)] overflow-y-auto break-words text-[12px] leading-relaxed text-muted-foreground"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {tooltip.body.trim() ? (
                    tooltip.body
                  ) : (
                    <span className="italic">{tooltip.emptyLabel}</span>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

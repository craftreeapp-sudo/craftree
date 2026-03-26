'use client';

import { useMemo, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { getCategoryColor } from '@/lib/colors';
import { formatYear } from '@/lib/utils';
import { isRtlLocale } from '@/lib/i18n-config';
import type { NodeCategory } from '@/lib/types';

const PANEL_W = 200;

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
  const reopenSideClass = isRtl ? 'right-4' : 'left-4';

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
            className={`fixed top-14 z-[45] flex h-[calc(100dvh-3.5rem)] w-[200px] flex-col border-[#2A3042] bg-[#111827] p-3 [border-width:0.5px] ${panelSideClass}`}
            aria-label={tExplore('categoryPanelAria', {
              category: tCat(selected.category as NodeCategory),
            })}
          >
            <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
              <h2
                className="min-w-0 flex-1 text-[14px] font-bold leading-tight"
                style={{ color: categoryColor }}
              >
                {tCat(selected.category as NodeCategory)}{' '}
                <span className="font-semibold text-[#8B95A8]">
                  ({sameCategoryList.length})
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setCategoryPanelOpen(false)}
                className="shrink-0 cursor-pointer p-0.5 text-[20px] leading-none text-[#8B95A8] transition-colors hover:text-[#E8ECF4]"
                aria-label={tExplore('categoryPanelCloseAria')}
              >
                ×
              </button>
            </div>
            <div
              className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5 [scrollbar-color:#2A3042_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#2A3042]"
            >
              {sameCategoryList.map((n) => {
                const isCurrent = n.id === selectedNodeId;
                const yearStr = formatYear(n.year_approx ?? null);
                return (
                  <div key={n.id}>
                    {isCurrent ? (
                      <div
                        className="flex h-[50px] w-full max-w-full flex-col justify-center rounded-[6px] border border-[#2A3042] border-l-[3px] bg-[#2A3042] px-2.5 py-2"
                        style={{ borderLeftColor: categoryColor }}
                        aria-current="true"
                      >
                        <span className="truncate text-[13px] font-bold text-[#E8ECF4]">
                          {n.name}
                        </span>
                        {yearStr ? (
                          <span className="truncate text-[11px] text-[#5A6175]">
                            {yearStr}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          navigateToNode(n.id, {
                            center: true,
                            forceFocusTransition: true,
                          })
                        }
                        className="flex h-[50px] w-full max-w-full flex-col justify-center rounded-[6px] border border-[#2A3042] bg-[#1A1F2E] px-2.5 py-2 text-left transition-colors hover:border-[color:var(--cat)] hover:bg-[#222837]"
                        style={{ ['--cat' as string]: categoryColor } as CSSProperties}
                      >
                        <span className="truncate text-[13px] font-bold text-[#E8ECF4]">
                          {n.name}
                        </span>
                        {yearStr ? (
                          <span className="truncate text-[11px] text-[#5A6175]">
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
          <motion.aside
            key="category-reopen"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-6 z-[46] ${reopenSideClass}`}
          >
            <button
              type="button"
              onClick={() => setCategoryPanelOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-[#2A3042] bg-[#1A1F2E] px-3 py-1.5 text-[12px] text-[#8B95A8] transition-colors hover:border-[#3B4558] hover:text-[#E8ECF4]"
              aria-label={tExplore('categoryPanelReopenAria')}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoryColor }}
                aria-hidden
              />
              {tExplore('categoryPanelReopen')}
            </button>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}

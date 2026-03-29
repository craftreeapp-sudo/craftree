'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { useGraphStore } from '@/stores/graph-store';
import { useUIStore } from '@/stores/ui-store';
import { ExploreCardProvider, useExploreCard } from '@/components/explore/explore-card-context';
import { ExploreDetailPanel } from '@/components/explore/DetailPanel';
import { ExploreHoverPopup } from '@/components/explore/HoverPopup';
import { LegendPanel } from '@/components/explore/LegendPanel';
import {
  bucketDirectDependencies,
  directDependencyCount,
  MATERIAL_COLUMNS,
  totalUpstreamCardCount,
} from '@/lib/built-upon-utils';
import { parseExploreViewMode, type ExploreViewMode } from '@/lib/explore-view-mode';
import { treeInventionPath } from '@/lib/tree-routes';
import type { TechNodeBasic } from '@/lib/types';
import { InventionCard } from './InventionCard';
import { LedToView } from './LedToView';

function cardLayoutId(id: string) {
  return `inv-card-${id}`;
}

const VIEW_TRANSITION = {
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

function ExploreScrollArea({ children }: { children: ReactNode }) {
  const { detailNodeId, legendOpen, isMobile } = useExploreCard();
  const detailOpen = detailNodeId !== null;
  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto px-3 pb-8 transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sm:px-4 ${
        detailOpen && !isMobile ? 'sm:mr-[340px]' : ''
      } ${legendOpen && !isMobile ? 'sm:ml-[300px]' : ''}`}
    >
      {children}
    </div>
  );
}

function BuiltUponViewInner({
  focusId,
  focusNode,
}: {
  focusId: string;
  focusNode: TechNodeBasic;
}) {
  const t = useTranslations('explore');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { navigateToNode } = useExploreNavigation();
  const selectNode = useUIStore((s) => s.selectNode);
  const { openDetail, openLegend } = useExploreCard();

  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);

  const viewMode = parseExploreViewMode(searchParams);

  const bucketsBuilt = useMemo(
    () => bucketDirectDependencies(focusId, nodes, edges),
    [focusId, nodes, edges]
  );

  const totalCardsUp = useMemo(
    () => totalUpstreamCardCount(focusId, edges),
    [focusId, edges]
  );

  const mainDirectIn = useMemo(
    () => directDependencyCount(focusId, edges),
    [focusId, edges]
  );

  const goTo = useCallback(
    (id: string) => {
      navigateToNode(id, {
        center: false,
        openSidebar: false,
        exploreView: viewMode,
      });
    },
    [navigateToNode, viewMode]
  );

  const setViewMode = useCallback(
    (mode: ExploreViewMode) => {
      router.replace(
        treeInventionPath(focusId, mode === 'led-to' ? 'led-to' : undefined)
      );
    },
    [focusId, router]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-page text-foreground dark:bg-[#0a0a0f] dark:text-white">
      <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => openLegend()}
          className="rounded-md border border-white/20 bg-transparent px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/35 hover:text-white/90 sm:text-sm"
        >
          {t('legendButton')}
        </button>
        <div
          className="flex rounded-lg border border-white/15 bg-[#1a1a2e] p-0.5"
          role="tablist"
          aria-label={t('builtUponArboAria')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'built-upon'}
            title={t('builtUponArboGrid')}
            onClick={() => setViewMode('built-upon')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold sm:text-sm ${viewMode === 'built-upon' ? 'bg-[#3b5bdb] text-white' : 'text-white/60 hover:text-white'}`}
          >
            <IconGridDown className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t('builtUponArboGrid')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'led-to'}
            title={t('builtUponArboList')}
            onClick={() => setViewMode('led-to')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold sm:text-sm ${viewMode === 'led-to' ? 'bg-[#3b5bdb] text-white' : 'text-white/60 hover:text-white'}`}
          >
            <IconGridUp className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t('builtUponArboList')}</span>
          </button>
        </div>
      </div>

      <ExploreScrollArea>
        <AnimatePresence mode="wait" initial={false}>
          {viewMode === 'led-to' ? (
            <motion.div
              key="led-to"
              role="tabpanel"
              initial={{ opacity: 0, y: 56 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={VIEW_TRANSITION}
              className="mx-auto w-full max-w-6xl"
            >
              <LedToView
                focusId={focusId}
                focusNode={focusNode}
                goTo={goTo}
                openDetail={openDetail}
              />
            </motion.div>
          ) : (
            <motion.div
              key="built-upon"
              role="tabpanel"
              initial={{ opacity: 0, y: -56 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={VIEW_TRANSITION}
              className="mx-auto flex max-w-6xl flex-col gap-8 pt-2"
            >
              <LayoutGroup id="built-upon-cards">
                <div className="flex flex-col items-center gap-3">
                  <InventionCard
                    node={focusNode}
                    directDeps={mainDirectIn}
                    variant="hero"
                    layoutId={cardLayoutId(focusNode.id)}
                    imageBust={imageBustByNodeId[focusNode.id] ?? 0}
                    exploreInteractive
                    onOpenDetail={() => openDetail(focusNode.id)}
                  />
                  <p className="rounded-full border border-white/15 bg-[#1a1a2e] px-4 py-1.5 text-sm text-white/80">
                    {t('builtUponTotalCards', { count: totalCardsUp })}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      selectNode(focusId, { openSidebar: true, center: false })
                    }
                    className="text-sm text-[#7c9cff] underline-offset-2 hover:underline"
                  >
                    {t('builtUponOpenDetails')}
                  </button>
                </div>

                <div className="rounded-xl bg-[#1a1a2e] p-4 shadow-inner">
                  <div className="mb-1 text-xs font-bold uppercase tracking-widest text-white/45">
                    {t('builtUponMatters')}
                  </div>
                  <div className="mb-3 flex min-w-0 gap-2 overflow-x-auto rounded-lg bg-[#2a2a3e] px-2 py-2.5 pb-2 dark:bg-[#2a2a3e] md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-4">
                    {MATERIAL_COLUMNS.map((col) => (
                      <div
                        key={col}
                        className="min-w-[5.5rem] shrink-0 text-center text-[10px] font-semibold uppercase tracking-wide text-white/75 sm:min-w-0 sm:text-xs dark:text-white/75"
                      >
                        {t(`builtUponLevel_${col}`)}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
                    {MATERIAL_COLUMNS.map((col) => (
                      <div key={col} className="flex flex-col gap-3">
                        {bucketsBuilt.matters[col].map((n) => (
                          <InventionCard
                            key={n.id}
                            node={n}
                            directDeps={directDependencyCount(n.id, edges)}
                            variant="compact"
                            layoutId={cardLayoutId(n.id)}
                            imageBust={imageBustByNodeId[n.id] ?? 0}
                            exploreInteractive
                            onClick={() => goTo(n.id)}
                            onOpenDetail={() => openDetail(n.id)}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  {MATERIAL_COLUMNS.every(
                    (c) => bucketsBuilt.matters[c].length === 0
                  ) ? (
                    <p className="py-2 text-sm text-white/40">
                      {t('builtUponNoMatters')}
                    </p>
                  ) : null}
                </div>

                <div className="h-px w-full bg-white/10" />

                <div className="rounded-xl bg-[#1a1a2e] p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/45">
                    {t('builtUponProcess')}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {bucketsBuilt.process.map((n) => (
                      <InventionCard
                        key={n.id}
                        node={n}
                        directDeps={directDependencyCount(n.id, edges)}
                        variant="compact"
                        layoutId={cardLayoutId(n.id)}
                        imageBust={imageBustByNodeId[n.id] ?? 0}
                        exploreInteractive
                        onClick={() => goTo(n.id)}
                        onOpenDetail={() => openDetail(n.id)}
                      />
                    ))}
                    {bucketsBuilt.process.length === 0 ? (
                      <p className="text-sm text-white/40">{t('builtUponEmpty')}</p>
                    ) : null}
                  </div>
                </div>

                <div className="h-px w-full bg-white/10" />

                <div className="rounded-xl bg-[#1a1a2e] p-4">
                  <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/45">
                    {t('builtUponTools')}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {bucketsBuilt.tools.map((n) => (
                      <InventionCard
                        key={n.id}
                        node={n}
                        directDeps={directDependencyCount(n.id, edges)}
                        variant="compact"
                        layoutId={cardLayoutId(n.id)}
                        imageBust={imageBustByNodeId[n.id] ?? 0}
                        exploreInteractive
                        onClick={() => goTo(n.id)}
                        onOpenDetail={() => openDetail(n.id)}
                      />
                    ))}
                    {bucketsBuilt.tools.length === 0 ? (
                      <p className="text-sm text-white/40">{t('builtUponEmpty')}</p>
                    ) : null}
                  </div>
                </div>
              </LayoutGroup>
            </motion.div>
          )}
        </AnimatePresence>
      </ExploreScrollArea>

      <LegendPanel />
      <ExploreDetailPanel />
      <ExploreHoverPopup />
    </div>
  );
}

export function BuiltUponView({ focusId }: { focusId: string }) {
  const t = useTranslations('explore');
  const nodes = useGraphStore((s) => s.nodes);
  const isMobile = useIsMobileBreakpoint();

  const focusNode = useMemo(
    () => nodes.find((n) => n.id === focusId),
    [nodes, focusId]
  );

  if (!focusNode) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#0a0a0f] text-white/50">
        {t('builtUponLoading')}
      </div>
    );
  }

  return (
    <ExploreCardProvider isMobile={isMobile}>
      <BuiltUponViewInner focusId={focusId} focusNode={focusNode} />
    </ExploreCardProvider>
  );
}

function IconGridDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 14l4 4 4-4" />
      <path d="M8 18V6" />
      <path d="M14 4h6v4h-6z" />
      <path d="M14 10h6v4h-6z" />
      <path d="M14 16h6v4h-6z" />
    </svg>
  );
}

function IconGridUp({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10l4-4 4 4" />
      <path d="M8 6v12" />
      <path d="M14 4h6v4h-6z" />
      <path d="M14 10h6v4h-6z" />
      <path d="M14 16h6v4h-6z" />
    </svg>
  );
}

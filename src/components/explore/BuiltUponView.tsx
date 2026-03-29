'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { useGraphStore } from '@/stores/graph-store';
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

function ExploreScrollArea({
  children,
  scrollRef,
}: {
  children: ReactNode;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const { detailNodeId, legendOpen, isMobile } = useExploreCard();
  const detailOpen = detailNodeId !== null;
  return (
    <div
      ref={scrollRef}
      className={`flex min-h-0 flex-1 basis-0 flex-col overflow-y-auto overflow-x-hidden px-3 pb-8 transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sm:px-4 ${
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
  const { openDetail, openLegend, detailNodeId, legendOpen, isMobile } =
    useExploreCard();
  const detailOpen = detailNodeId !== null;
  const exploreScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    openDetail(focusId);
  }, [focusId, openDetail]);

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

  useLayoutEffect(() => {
    if (viewMode !== 'built-upon') return;
    const el = exploreScrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [viewMode, focusId]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-page text-foreground">
      <div
        className={`flex shrink-0 items-center justify-between gap-3 px-3 py-2 transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sm:px-4 ${
          detailOpen && !isMobile ? 'sm:mr-[340px]' : ''
        } ${legendOpen && !isMobile ? 'sm:ml-[300px]' : ''}`}
      >
        <button
          type="button"
          onClick={() => openLegend()}
          className="rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-foreground sm:text-sm"
        >
          {t('legendButton')}
        </button>
        <div
          className="flex rounded-lg border border-border bg-surface-elevated p-0.5"
          role="tablist"
          aria-label={t('builtUponArboAria')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'built-upon'}
            title={t('builtUponArboGrid')}
            onClick={() => setViewMode('built-upon')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold sm:text-sm ${viewMode === 'built-upon' ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground'}`}
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
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold sm:text-sm ${viewMode === 'led-to' ? 'bg-accent text-white' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <IconGridUp className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t('builtUponArboList')}</span>
          </button>
        </div>
      </div>

      <ExploreScrollArea scrollRef={exploreScrollRef}>
        <AnimatePresence mode="wait" initial={false}>
          {viewMode === 'led-to' ? (
            <motion.div
              key="led-to"
              role="tabpanel"
              initial={{ opacity: 0, y: 56 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={VIEW_TRANSITION}
              className="mx-auto w-full max-w-[calc(72rem+10px)]"
            >
              <LedToView
                focusId={focusId}
                focusNode={focusNode}
                goTo={goTo}
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
              className="mx-auto flex max-w-[calc(72rem+10px)] flex-col gap-8 pt-2"
            >
              <LayoutGroup id="built-upon-cards">
                <div className="flex flex-col items-center gap-3">
                  <InventionCard
                    node={focusNode}
                    directDeps={mainDirectIn}
                    variant="hero"
                    layoutId={cardLayoutId(focusNode.id)}
                    imageBust={imageBustByNodeId[focusNode.id] ?? 0}
                  />
                  <p className="rounded-full border border-border bg-surface-elevated px-4 py-1.5 text-sm text-muted-foreground">
                    {t('builtUponTotalCards', { count: totalCardsUp })}
                  </p>
                </div>

                <div className="-mx-[60px] flex flex-col gap-8">
                <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-inner">
                  <div className="sticky top-0 z-10 -mx-4 mb-3 border-b border-border/60 bg-surface-elevated/95 px-4 py-3 backdrop-blur-sm">
                    <div className="mb-[10px] text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      {t('builtUponMatters')}
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface px-2 py-2.5 lg:grid-cols-4">
                      {MATERIAL_COLUMNS.map((col) => (
                        <div
                          key={col}
                          className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
                        >
                          {t(`builtUponLevel_${col}`)}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
                    {MATERIAL_COLUMNS.map((col) => (
                      <div
                        key={col}
                        className="grid grid-cols-2 gap-3 [align-content:start]"
                      >
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
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  {MATERIAL_COLUMNS.every(
                    (c) => bucketsBuilt.matters[c].length === 0
                  ) ? (
                    <p className="py-2 text-sm text-muted-foreground">
                      {t('builtUponNoMatters')}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border bg-surface-elevated p-4">
                  <div className="sticky top-0 z-10 -mx-4 mb-3 border-b border-border/60 bg-surface-elevated/95 px-4 py-3 backdrop-blur-sm">
                    <div className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      {t('builtUponProcess')}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
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
                      />
                    ))}
                    {bucketsBuilt.process.length === 0 ? (
                      <p className="col-span-2 text-sm text-muted-foreground sm:col-span-4 lg:col-span-8">
                        {t('builtUponEmpty')}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-elevated p-4">
                  <div className="sticky top-0 z-10 -mx-4 mb-3 border-b border-border/60 bg-surface-elevated/95 px-4 py-3 backdrop-blur-sm">
                    <div className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      {t('builtUponTools')}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
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
                      />
                    ))}
                    {bucketsBuilt.tools.length === 0 ? (
                      <p className="col-span-2 text-sm text-muted-foreground sm:col-span-4 lg:col-span-8">
                        {t('builtUponEmpty')}
                      </p>
                    ) : null}
                  </div>
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
      <div className="flex flex-1 items-center justify-center bg-page text-muted-foreground">
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

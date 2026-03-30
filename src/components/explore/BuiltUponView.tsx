'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { LayoutGroup } from 'framer-motion';
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
  bucketLedToOutputs,
  directDependencyCount,
  MATERIAL_COLUMNS,
  totalDownstreamCardCount,
  totalUpstreamCardCount,
} from '@/lib/built-upon-utils';
import { parseExploreViewMode } from '@/lib/explore-view-mode';
import type { TechNodeBasic } from '@/lib/types';
import { InventionCard } from './InventionCard';

function cardLayoutId(id: string) {
  return `inv-card-${id}`;
}

const HERO_ID = 'explore-tree-hero';
/** Bas du bloc Matters (zone Led to) — cible de défilement pour le bouton « Led to ». */
const LED_TO_MATTERS_END_ID = 'led-to-matters-end';
/**
 * Décalage des sous-barres sticky (Tools, Process, Matters…) pour qu’elles restent
 * sous la barre « How to read / navigation arbre » (sticky z-[90] en haut du scroll).
 * +10px vs 3rem : un peu plus d’air sous la barre d’outils.
 */
const STICKY_SECTION_BELOW_TREE_NAV =
  'sticky top-[calc(3rem+10px)] z-10 -mx-4 mb-3 border-b border-border/60 bg-surface-elevated/95 px-4 py-3 backdrop-blur-sm';
/** Même offset que Tools / Process (titres MATTERS alignés). */
const STICKY_SECTION_BELOW_TREE_NAV_MATTERS_TOP =
  'sticky top-[calc(3rem+10px)] z-10 -mx-4 mb-3 rounded-t-xl border-b border-border/60 bg-surface-elevated/95 px-4 pb-3 pt-3 backdrop-blur-sm';

type ExploreZone = 'led-to' | 'hero' | 'built-upon';

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

function useExploreActiveZone(
  scrollRef: RefObject<HTMLDivElement | null>,
  focusId: string
): ExploreZone {
  const [zone, setZone] = useState<ExploreZone>('built-upon');

  const compute = useCallback((): ExploreZone => {
    const root = scrollRef.current;
    const hero = document.getElementById(HERO_ID);
    if (!root || !hero) return 'built-upon';
    const mid = root.scrollTop + root.clientHeight / 2;
    const hTop = hero.offsetTop;
    const hBottom = hTop + hero.offsetHeight;
    if (mid < hTop) return 'led-to';
    if (mid <= hBottom) return 'hero';
    return 'built-upon';
  }, [scrollRef]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let raf = 0;
    const tick = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setZone(compute()));
    };
    root.addEventListener('scroll', tick, { passive: true });
    window.addEventListener('resize', tick, { passive: true });
    queueMicrotask(tick);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener('scroll', tick);
      window.removeEventListener('resize', tick);
    };
  }, [compute, focusId, scrollRef]);

  return zone;
}

function scrollToBuiltUpon() {
  document.getElementById('built-upon')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function scrollToLedToAfterMatters() {
  document.getElementById(LED_TO_MATTERS_END_ID)?.scrollIntoView({
    behavior: 'smooth',
    block: 'end',
  });
}

function scrollToMainHero() {
  document.getElementById(HERO_ID)?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });
}

function BuiltUponViewInner({
  focusId,
  focusNode,
}: {
  focusId: string;
  focusNode: TechNodeBasic;
}) {
  const t = useTranslations('explore');
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

  const bucketsBuilt = useMemo(
    () => bucketDirectDependencies(focusId, nodes, edges),
    [focusId, nodes, edges]
  );

  const bucketsLed = useMemo(
    () => bucketLedToOutputs(focusId, nodes, edges),
    [focusId, nodes, edges]
  );

  const totalCardsUp = useMemo(
    () => totalUpstreamCardCount(focusId, edges),
    [focusId, edges]
  );

  const totalDown = useMemo(
    () => totalDownstreamCardCount(focusId, edges),
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
      });
    },
    [navigateToNode]
  );

  const activeZone = useExploreActiveZone(exploreScrollRef, focusId);

  /** Au chargement / changement de nœud : ancrage selon `?view=` */
  useLayoutEffect(() => {
    const initial = parseExploreViewMode(searchParams);
    const run = () => {
      if (initial === 'led-to') {
        document.getElementById(LED_TO_MATTERS_END_ID)?.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
      } else {
        document.getElementById('built-upon')?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [focusId, searchParams]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-page text-foreground">
      <ExploreScrollArea scrollRef={exploreScrollRef}>
        {/* Barre sticky : How to read (gauche) — navigation arbre (droite) */}
        <div
          className={`sticky top-0 z-[90] flex w-full min-w-0 shrink-0 items-center gap-3 border-b border-border/80 bg-page/95 px-3 py-2 backdrop-blur-sm transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sm:px-4 ${
            detailOpen && !isMobile ? 'sm:mr-[340px]' : ''
          } ${legendOpen && !isMobile ? 'sm:ml-[300px]' : ''}`}
        >
          <button
            type="button"
            onClick={() => openLegend()}
            className="shrink-0 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-foreground sm:text-sm"
          >
            {t('legendButton')}
          </button>
          <div
            className="ml-auto flex shrink-0 rounded-lg border border-border bg-surface-elevated p-0.5"
            role="toolbar"
            aria-label={t('treeNavAria')}
          >
            <button
              type="button"
              aria-pressed={activeZone === 'built-upon'}
              title={t('builtUponArboGrid')}
              onClick={() => scrollToBuiltUpon()}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${
                activeZone === 'built-upon'
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <IconGridDown className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t('builtUponArboGrid')}</span>
            </button>
            <button
              type="button"
              aria-pressed={activeZone === 'hero'}
              title={t('treeNavMainCardTitle')}
              onClick={() => scrollToMainHero()}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${
                activeZone === 'hero'
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <IconMainCard className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t('treeNavMainCard')}</span>
            </button>
            <button
              type="button"
              aria-pressed={activeZone === 'led-to'}
              title={t('builtUponArboList')}
              onClick={() => scrollToLedToAfterMatters()}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${
                activeZone === 'led-to'
                  ? 'bg-accent text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <IconGridUp className="h-4 w-4 shrink-0" aria-hidden />
              <span className="hidden sm:inline">{t('builtUponArboList')}</span>
            </button>
          </div>
        </div>

        <div className="mx-auto w-full max-w-[calc(72rem+10px)] pb-4 pt-0">
          <LayoutGroup id="explore-tree-cards">
            {/* ─── Led to (aval) ─── */}
            <section
              id="led-to"
              className="scroll-mt-16"
              aria-labelledby="explore-led-to-heading"
            >
              <div className="-mx-[60px] flex flex-col gap-6">
                <div className="rounded-xl border border-border bg-surface-elevated p-4">
                  <div className={STICKY_SECTION_BELOW_TREE_NAV}>
                    <div className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      {t('builtUponTools')}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                    {bucketsLed.tools.map((n) => (
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
                    {bucketsLed.tools.length === 0 ? (
                      <p className="col-span-2 text-sm text-muted-foreground sm:col-span-4 lg:col-span-8">
                        {t('builtUponEmpty')}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface-elevated p-4">
                  <div className={STICKY_SECTION_BELOW_TREE_NAV}>
                    <div className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
                      {t('builtUponProcess')}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                    {bucketsLed.process.map((n) => (
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
                    {bucketsLed.process.length === 0 ? (
                      <p className="col-span-2 text-sm text-muted-foreground sm:col-span-4 lg:col-span-8">
                        {t('builtUponEmpty')}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div
                  id={LED_TO_MATTERS_END_ID}
                  className="rounded-xl border border-border bg-surface-elevated p-4 pt-0 shadow-inner"
                >
                  <div className={STICKY_SECTION_BELOW_TREE_NAV_MATTERS_TOP}>
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
                        {bucketsLed.matters[col].map((n) => (
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
                    (c) => bucketsLed.matters[c].length === 0
                  ) ? (
                    <p className="py-2 text-sm text-muted-foreground">
                      {t('ledToNoMatters')}
                    </p>
                  ) : null}
                </div>
              </div>

              <p
                id="explore-led-to-heading"
                className="mt-6 text-center text-sm text-muted-foreground"
              >
                <span className="font-semibold text-foreground">
                  {t('builtUponArboList')}
                </span>{' '}
                {t('ledToTotalCards', { count: totalDown })}
              </p>
            </section>

            {/* ─── Carte centrale ─── */}
            <div
              id={HERO_ID}
              className="scroll-mt-16 my-10 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border/70 bg-surface-elevated/25 px-4 py-10 sm:px-8"
            >
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

            {/* ─── Built upon (amont) ─── */}
            <section
              id="built-upon"
              className="scroll-mt-16"
              aria-labelledby="explore-built-upon-heading"
            >
              <h2
                id="explore-built-upon-heading"
                className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/90"
              >
                {t('builtUponArboGrid')}
              </h2>

              <div className="-mx-[60px] flex flex-col gap-8">
                <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-inner">
                  <div className={STICKY_SECTION_BELOW_TREE_NAV_MATTERS_TOP}>
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
                  <div className={STICKY_SECTION_BELOW_TREE_NAV}>
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
                  <div className={STICKY_SECTION_BELOW_TREE_NAV}>
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
            </section>
          </LayoutGroup>
        </div>
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

function IconMainCard({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M9 9h6M9 13h4" />
    </svg>
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

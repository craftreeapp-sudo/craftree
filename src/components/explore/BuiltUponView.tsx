'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';
import { treeInventionPath } from '@/lib/tree-routes';
import { useGraphStore } from '@/stores/graph-store';
import { useUIStore } from '@/stores/ui-store';
import { ExploreCardProvider, useExploreCard } from '@/components/explore/explore-card-context';
import { ExploreDetailPanel } from '@/components/explore/DetailPanel';
import { ExploreHoverPopup } from '@/components/explore/HoverPopup';
import { LegendPanel } from '@/components/explore/LegendPanel';
import {
  bucketDirectDependencies,
  bucketLedToOutputs,
  MATERIAL_COLUMNS,
  totalDownstreamCardCount,
  totalUpstreamCardCount,
} from '@/lib/built-upon-utils';
import { parseExploreViewMode } from '@/lib/explore-view-mode';
import type { MaterialLevel, TechNodeBasic } from '@/lib/types';
import { InventionCard } from './InventionCard';

function cardLayoutId(id: string) {
  return `inv-card-${id}`;
}

/**
 * Grille cartes compactes : le nombre de colonnes suit la largeur (zoom arrière, grands écrans).
 * minmax ~116px ≈ largeur minimale confortable pour une carte compacte.
 */
const BUILT_UPON_CARD_GRID =
  'grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(7.25rem,1fr))]';

/** Colonnes « matières » (sous-grille par niveau) : même logique, lignes alignées en haut. */
const BUILT_UPON_MATTERS_SUBGRID = `${BUILT_UPON_CARD_GRID} [align-content:start]`;

/** Pas de marge négative horizontale : évite la troncature des cartes (overflow-x-hidden du scroll). */
const BUILT_UPON_SECTION_BLEED_X = 'ml-0 mr-0';

const HERO_ID = 'explore-tree-hero';
/** Bas du bloc Matters (zone Led to) — cible de défilement pour le bouton « Led to ». */
const LED_TO_MATTERS_END_ID = 'led-to-matters-end';
/** Délai avant le scroll fluide vers « Built upon » (laisser le layout se stabiliser ; pas de scroll hero avant). */
const TREE_INTRO_SCROLL_TO_BUILT_UPON_MS = 420;
/**
 * Décalage des sous-barres sticky (Tools, Process, Matters…) pour qu’elles restent
 * sous la barre « How to read / navigation arbre » (sticky z-[90] en haut du scroll).
 * +10px vs 3rem : un peu plus d’air sous la barre d’outils.
 */
/** Barre d’outils arbre hors du scroll : les bandeaux sticky internes collent au haut du scroll. */
const STICKY_SECTION_BELOW_TREE_NAV =
  'sticky top-0 z-10 -mx-4 mb-3 glass-app-header px-4 py-3';
/** Même offset que Tools / Process (titres MATTERS alignés). */
const STICKY_SECTION_BELOW_TREE_NAV_MATTERS_TOP =
  'sticky top-0 z-10 -mx-4 mb-3 rounded-t-xl glass-app-header px-4 pb-3 pt-3';

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
        detailOpen && !isMobile ? 'sm:mr-[400px]' : ''
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

function ScrollRevealCard({
  children,
  scrollRootRef,
}: {
  children: ReactNode;
  scrollRootRef: RefObject<HTMLDivElement | null>;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return <>{children}</>;
  }
  return (
    <motion.div
      className="min-w-0"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12, root: scrollRootRef }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

type TreeSectionKey =
  | 'ledTools'
  | 'ledProcess'
  | 'ledMatters'
  | 'builtMatters'
  | 'builtProcess'
  | 'builtTools';

function TreeDimensionSectionHeader({
  title,
  count,
  expanded,
  onToggle,
  stickyClassName,
  sectionId,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  stickyClassName: string;
  sectionId: string;
}) {
  const t = useTranslations('explore');
  const controlsId = `${sectionId}-content`;
  return (
    <div className={stickyClassName}>
      <div className="relative flex min-h-[2.5rem] items-center">
        <div className="w-9 shrink-0" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-2 px-1">
          <span className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          <span
            className="shrink-0 rounded-md bg-muted/40 px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground/90"
            title={t('treeSectionCardCountAria', { count })}
          >
            {count}
          </span>
        </div>
        <div className="flex w-9 shrink-0 justify-end">
          <button
            type="button"
            id={`${sectionId}-toggle`}
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={controlsId}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 bg-surface/80 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
            title={expanded ? t('treeSectionCollapse') : t('treeSectionExpand')}
          >
            <span className="sr-only">
              {expanded ? t('treeSectionCollapse') : t('treeSectionExpand')}
            </span>
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? '' : '-rotate-90'}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Titre MATTERS + barre des 4 niveaux : reste collé en haut du scroll tant que la section est visible. */
const MATTERS_TITLE_AND_LEVELS_STICKY =
  'sticky top-0 z-[15] -mx-4 mb-2 space-y-2 rounded-t-xl glass-app-header px-4 pb-2 pt-3 shadow-sm';

function MattersLevelSubheaderBar({
  getCount,
}: {
  getCount: (col: MaterialLevel) => number;
}) {
  const t = useTranslations('explore');
  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-surface/95 backdrop-blur-sm">
      <div className="grid grid-cols-2 divide-x divide-y divide-border/70 lg:grid-cols-4 lg:divide-y-0">
        {MATERIAL_COLUMNS.map((col) => (
          <div
            key={col}
            className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 sm:flex-row sm:gap-2"
          >
            <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              {t(`builtUponLevel_${col}`)}
            </span>
            <span
              className="shrink-0 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground/90 sm:text-xs"
              title={t('treeSectionCardCountAria', {
                count: getCount(col),
              })}
            >
              {getCount(col)}
            </span>
          </div>
        ))}
      </div>
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
  const searchParams = useSearchParams();
  const selectNode = useUIStore((s) => s.selectNode);
  const { openDetail, closeDetail, openLegend, detailNodeId, legendOpen, isMobile } =
    useExploreCard();
  const detailOpen = detailNodeId !== null;
  const exploreScrollRef = useRef<HTMLDivElement | null>(null);
  const treeToolbarRef = useRef<HTMLDivElement | null>(null);
  const [treeToolbarPx, setTreeToolbarPx] = useState(56);
  const exploreDetailDismissNonce = useUIStore((s) => s.exploreDetailDismissNonce);
  const dismissNonceSyncRef = useRef(exploreDetailDismissNonce);

  /** Hauteur réelle de la barre arbre → --explore-tree-toolbar-h pour les panneaux fixed (détail, légende). */
  useLayoutEffect(() => {
    const el = treeToolbarRef.current;
    if (!el) return;
    const measure = () => {
      setTreeToolbarPx(Math.round(el.getBoundingClientRect().height));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    openDetail(focusId);
  }, [focusId, openDetail]);

  useEffect(() => {
    if (exploreDetailDismissNonce === dismissNonceSyncRef.current) return;
    dismissNonceSyncRef.current = exploreDetailDismissNonce;
    closeDetail();
  }, [exploreDetailDismissNonce, closeDetail]);

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

  const [treeSectionsOpen, setTreeSectionsOpen] = useState<
    Record<TreeSectionKey, boolean>
  >({
    ledTools: true,
    ledProcess: true,
    ledMatters: true,
    builtMatters: true,
    builtProcess: true,
    builtTools: true,
  });

  const ledMattersTotal = useMemo(
    () =>
      MATERIAL_COLUMNS.reduce(
        (acc, c) => acc + bucketsLed.matters[c].length,
        0
      ),
    [bucketsLed]
  );

  const builtMattersTotal = useMemo(
    () =>
      MATERIAL_COLUMNS.reduce(
        (acc, c) => acc + bucketsBuilt.matters[c].length,
        0
      ),
    [bucketsBuilt]
  );

  const toggleTreeSection = useCallback((key: TreeSectionKey) => {
    setTreeSectionsOpen((s) => ({ ...s, [key]: !s[key] }));
  }, []);

  const activeZone = useExploreActiveZone(exploreScrollRef, focusId);
  const reduceMotion = useReducedMotion();

  /**
   * Ancrage initial selon `?view=`.
   * Vue `built-upon` (défaut) : ne pas centrer le hero ici — ça provoquait un double mouvement
   * (hero puis scroll smooth vers built upon). Avec reduced motion : un seul scroll instantané vers built upon.
   */
  useLayoutEffect(() => {
    const initial = parseExploreViewMode(searchParams);
    const run = () => {
      if (initial === 'led-to') {
        document.getElementById(LED_TO_MATTERS_END_ID)?.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
        return;
      }
      if (reduceMotion) {
        document.getElementById('built-upon')?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [focusId, searchParams, reduceMotion]);

  /** Vue par défaut built upon + animations : un seul scroll fluide depuis le haut (pas de scroll hero intermédiaire). */
  useEffect(() => {
    const initial = parseExploreViewMode(searchParams);
    if (initial === 'led-to' || reduceMotion) return;
    const id = window.setTimeout(() => {
      document.getElementById('built-upon')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, TREE_INTRO_SCROLL_TO_BUILT_UPON_MS);
    return () => clearTimeout(id);
  }, [focusId, searchParams, reduceMotion]);

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-page text-foreground"
      style={
        {
          '--explore-tree-toolbar-h': `${treeToolbarPx}px`,
        } as CSSProperties
      }
    >
      {/*
        Hors scroll : pleine largeur. Deux blocs distincts à droite :
        1) toolbar navigation zones (scroll) 2) affichage fiche — séparés visuellement et sémantiquement.
      */}
      <div
        ref={treeToolbarRef}
        id="explore-tree-toolbar"
        className={`glass-explore-sticky-nav z-[90] flex min-h-[3.5rem] w-full min-w-0 shrink-0 items-center gap-3 px-3 py-2 transition-[margin] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] sm:px-4 ${
          legendOpen && !isMobile ? 'sm:ml-[300px]' : ''
        } ${detailOpen && !isMobile ? 'sm:mr-[400px]' : ''}`}
      >
          <button
            type="button"
            onClick={() => openLegend()}
            className="shrink-0 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-foreground sm:text-sm"
          >
            {t('legendButton')}
          </button>
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <div
              className="flex shrink-0 rounded-lg glass-search-field p-0.5"
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
            <div
              className="shrink-0 rounded-lg glass-search-field p-0.5"
              role="group"
              aria-label={t('treeNavDetailPanel')}
            >
              <button
                type="button"
                aria-pressed={detailOpen}
                aria-label={
                  detailOpen
                    ? t('treeNavDetailPanelHideTitle')
                    : t('treeNavDetailPanelShowTitle')
                }
                title={
                  detailOpen
                    ? t('treeNavDetailPanelHideTitle')
                    : t('treeNavDetailPanelShowTitle')
                }
                onClick={() =>
                  detailOpen ? closeDetail() : openDetail(focusId)
                }
                className={`flex items-center justify-center rounded-md px-2.5 py-2 text-xs font-semibold sm:px-2.5 sm:text-sm ${
                  detailOpen
                    ? 'bg-accent text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <IconDetailPanelToggle className="h-4 w-4 shrink-0" aria-hidden />
              </button>
            </div>
          </div>
        </div>

      <ExploreScrollArea scrollRef={exploreScrollRef}>
        <div className="mx-auto w-full max-w-[min(100%,88rem)] pb-4 pt-0 xl:max-w-[min(100%,108rem)] 2xl:max-w-[min(100%,128rem)]">
          <LayoutGroup id="explore-tree-cards">
            {/* ─── Led to (aval) ─── */}
            <section
              id="led-to"
              className="scroll-mt-16"
              aria-labelledby="explore-led-to-heading"
            >
              <div
                className={`${BUILT_UPON_SECTION_BLEED_X} flex flex-col gap-6`}
              >
                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponTools')}
                    count={bucketsLed.tools.length}
                    expanded={treeSectionsOpen.ledTools}
                    onToggle={() => toggleTreeSection('ledTools')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-led-tools"
                  />
                  {treeSectionsOpen.ledTools ? (
                    <div id="explore-led-tools-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsLed.tools.map((n) => (
                          <ScrollRevealCard
                            key={n.id}
                            scrollRootRef={exploreScrollRef}
                          >
                            <InventionCard
                              node={n}
                              variant="compact"
                              layoutId={cardLayoutId(n.id)}
                              imageBust={imageBustByNodeId[n.id] ?? 0}
                              exploreInteractive
                              href={treeInventionPath(n.id)}
                              onClick={() => selectNode(n.id, { center: false })}
                            />
                          </ScrollRevealCard>
                        ))}
                        {bucketsLed.tools.length === 0 ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponProcess')}
                    count={bucketsLed.process.length}
                    expanded={treeSectionsOpen.ledProcess}
                    onToggle={() => toggleTreeSection('ledProcess')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-led-process"
                  />
                  {treeSectionsOpen.ledProcess ? (
                    <div id="explore-led-process-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsLed.process.map((n) => (
                          <ScrollRevealCard
                            key={n.id}
                            scrollRootRef={exploreScrollRef}
                          >
                            <InventionCard
                              node={n}
                              variant="compact"
                              layoutId={cardLayoutId(n.id)}
                              imageBust={imageBustByNodeId[n.id] ?? 0}
                              exploreInteractive
                              href={treeInventionPath(n.id)}
                              onClick={() => selectNode(n.id, { center: false })}
                            />
                          </ScrollRevealCard>
                        ))}
                        {bucketsLed.process.length === 0 ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div
                  id={LED_TO_MATTERS_END_ID}
                  className="rounded-xl glass-card p-4 pt-0 shadow-inner"
                >
                  {treeSectionsOpen.ledMatters ? (
                    <div className={MATTERS_TITLE_AND_LEVELS_STICKY}>
                      <TreeDimensionSectionHeader
                        title={t('builtUponMatters')}
                        count={ledMattersTotal}
                        expanded={treeSectionsOpen.ledMatters}
                        onToggle={() => toggleTreeSection('ledMatters')}
                        stickyClassName=""
                        sectionId="explore-led-matters"
                      />
                      <MattersLevelSubheaderBar
                        getCount={(col) => bucketsLed.matters[col].length}
                      />
                    </div>
                  ) : (
                    <TreeDimensionSectionHeader
                      title={t('builtUponMatters')}
                      count={ledMattersTotal}
                      expanded={treeSectionsOpen.ledMatters}
                      onToggle={() => toggleTreeSection('ledMatters')}
                      stickyClassName={STICKY_SECTION_BELOW_TREE_NAV_MATTERS_TOP}
                      sectionId="explore-led-matters"
                    />
                  )}
                  {treeSectionsOpen.ledMatters ? (
                    <div id="explore-led-matters-content">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
                        {MATERIAL_COLUMNS.map((col) => (
                          <div
                            key={col}
                            className={BUILT_UPON_MATTERS_SUBGRID}
                          >
                            {bucketsLed.matters[col].map((n) => (
                              <ScrollRevealCard
                                key={n.id}
                                scrollRootRef={exploreScrollRef}
                              >
                                <InventionCard
                                  node={n}
                                  variant="compact"
                                  layoutId={cardLayoutId(n.id)}
                                  imageBust={imageBustByNodeId[n.id] ?? 0}
                                  exploreInteractive
                                  href={treeInventionPath(n.id)}
                                  onClick={() =>
                                    selectNode(n.id, { center: false })
                                  }
                                />
                              </ScrollRevealCard>
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
            <motion.div
              id={HERO_ID}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="glass-explore-hero-frame scroll-mt-16 my-10 flex flex-col items-center gap-4 rounded-2xl px-4 py-10 sm:px-8"
            >
              <InventionCard
                node={focusNode}
                variant="hero"
                layoutId={cardLayoutId(focusNode.id)}
                imageBust={imageBustByNodeId[focusNode.id] ?? 0}
              />
              <p className="rounded-full glass-search-field px-4 py-1.5 text-sm text-muted-foreground">
                {t('builtUponTotalCards', { count: totalCardsUp })}
              </p>
            </motion.div>

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

              <div
                className={`${BUILT_UPON_SECTION_BLEED_X} flex flex-col gap-8`}
              >
                <div className="rounded-xl glass-card p-4 shadow-inner">
                  {treeSectionsOpen.builtMatters ? (
                    <div className={MATTERS_TITLE_AND_LEVELS_STICKY}>
                      <TreeDimensionSectionHeader
                        title={t('builtUponMatters')}
                        count={builtMattersTotal}
                        expanded={treeSectionsOpen.builtMatters}
                        onToggle={() => toggleTreeSection('builtMatters')}
                        stickyClassName=""
                        sectionId="explore-built-matters"
                      />
                      <MattersLevelSubheaderBar
                        getCount={(col) => bucketsBuilt.matters[col].length}
                      />
                    </div>
                  ) : (
                    <TreeDimensionSectionHeader
                      title={t('builtUponMatters')}
                      count={builtMattersTotal}
                      expanded={treeSectionsOpen.builtMatters}
                      onToggle={() => toggleTreeSection('builtMatters')}
                      stickyClassName={STICKY_SECTION_BELOW_TREE_NAV_MATTERS_TOP}
                      sectionId="explore-built-matters"
                    />
                  )}
                  {treeSectionsOpen.builtMatters ? (
                    <div id="explore-built-matters-content">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
                        {MATERIAL_COLUMNS.map((col) => (
                          <div
                            key={col}
                            className={BUILT_UPON_MATTERS_SUBGRID}
                          >
                            {bucketsBuilt.matters[col].map((n) => (
                              <ScrollRevealCard
                                key={n.id}
                                scrollRootRef={exploreScrollRef}
                              >
                                <InventionCard
                                  node={n}
                                  variant="compact"
                                  layoutId={cardLayoutId(n.id)}
                                  imageBust={imageBustByNodeId[n.id] ?? 0}
                                  exploreInteractive
                                  href={treeInventionPath(n.id)}
                                  onClick={() =>
                                    selectNode(n.id, { center: false })
                                  }
                                />
                              </ScrollRevealCard>
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
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponProcess')}
                    count={bucketsBuilt.process.length}
                    expanded={treeSectionsOpen.builtProcess}
                    onToggle={() => toggleTreeSection('builtProcess')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-built-process"
                  />
                  {treeSectionsOpen.builtProcess ? (
                    <div id="explore-built-process-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsBuilt.process.map((n) => (
                          <ScrollRevealCard
                            key={n.id}
                            scrollRootRef={exploreScrollRef}
                          >
                            <InventionCard
                              node={n}
                              variant="compact"
                              layoutId={cardLayoutId(n.id)}
                              imageBust={imageBustByNodeId[n.id] ?? 0}
                              exploreInteractive
                              href={treeInventionPath(n.id)}
                              onClick={() =>
                                selectNode(n.id, { center: false })
                              }
                            />
                          </ScrollRevealCard>
                        ))}
                        {bucketsBuilt.process.length === 0 ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponTools')}
                    count={bucketsBuilt.tools.length}
                    expanded={treeSectionsOpen.builtTools}
                    onToggle={() => toggleTreeSection('builtTools')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-built-tools"
                  />
                  {treeSectionsOpen.builtTools ? (
                    <div id="explore-built-tools-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsBuilt.tools.map((n) => (
                          <ScrollRevealCard
                            key={n.id}
                            scrollRootRef={exploreScrollRef}
                          >
                            <InventionCard
                              node={n}
                              variant="compact"
                              layoutId={cardLayoutId(n.id)}
                              imageBust={imageBustByNodeId[n.id] ?? 0}
                              exploreInteractive
                              href={treeInventionPath(n.id)}
                              onClick={() =>
                                selectNode(n.id, { center: false })
                              }
                            />
                          </ScrollRevealCard>
                        ))}
                        {bucketsBuilt.tools.length === 0 ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
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

/** Panneau latéral + chevron : afficher / masquer la fiche détail */
function IconDetailPanelToggle({ className }: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="15" y1="6" x2="15" y2="18" />
      <path d="M10 9l4 3-4 3" />
    </svg>
  );
}

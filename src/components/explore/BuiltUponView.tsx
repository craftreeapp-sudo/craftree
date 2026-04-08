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
import type { BuiltUponBuckets } from '@/lib/built-upon-utils';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';
import { treeInventionPath } from '@/lib/tree-routes';
import { useGraphStore } from '@/stores/graph-store';
import { useAuthStore } from '@/stores/auth-store';
import {
  useUIStore,
  hydrateLinkNeighborhoodModeFromStorage,
} from '@/stores/ui-store';
import { ExploreCardProvider, useExploreCard } from '@/components/explore/explore-card-context';
import { ExploreDetailPanel } from '@/components/explore/DetailPanel';
import { ExploreHoverPopup } from '@/components/explore/HoverPopup';
import { LegendPanel } from '@/components/explore/LegendPanel';
import {
  bucketDirectDependencies,
  bucketExtendedDownstreamOnly,
  bucketExtendedUpstreamOnly,
  bucketLedToOutputs,
  buildExtendedDownstreamPeerInfos,
  buildExtendedUpstreamPeerInfos,
  MATTER_GRID_LEVELS,
  totalDownstreamCardCount,
} from '@/lib/built-upon-utils';
import {
  parseExploreViewMode,
  type ExploreViewMode,
} from '@/lib/explore-view-mode';
import { EXPLORE_DETAIL_PANEL_WIDTH_PX } from '@/lib/explore-layout';
import type { MatterGridLevel } from '@/lib/built-upon-utils';
import type { TechNodeBasic } from '@/lib/types';
import { InventionCard } from './InventionCard';
import { FilterPanel } from '@/components/ui/FilterPanel';

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

/** Libellé du badge de section : direct seul, ou « n (+m) » avant étendu, ou total en mode étendu. */
function formatTreeSectionCountLabel(
  directCount: number,
  indirectCount: number,
  showExtended: boolean
): string {
  if (indirectCount === 0) return String(directCount);
  if (showExtended) return String(directCount + indirectCount);
  return `${directCount} (+${indirectCount})`;
}

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
  | 'ledMatters'
  | 'ledProcess'
  | 'ledTools'
  | 'ledComposants'
  | 'ledEnergy'
  | 'ledInfrastructure'
  | 'builtMatters'
  | 'builtProcess'
  | 'builtTools'
  | 'builtComposants'
  | 'builtEnergy'
  | 'builtInfrastructure';

function TreeDimensionSectionHeader({
  title,
  directCount,
  indirectCount,
  showExtended,
  expanded,
  onToggle,
  stickyClassName,
  sectionId,
}: {
  title: string;
  directCount: number;
  indirectCount: number;
  showExtended: boolean;
  expanded: boolean;
  onToggle: () => void;
  stickyClassName: string;
  sectionId: string;
}) {
  const t = useTranslations('explore');
  const controlsId = `${sectionId}-content`;
  const countLabel = formatTreeSectionCountLabel(
    directCount,
    indirectCount,
    showExtended
  );
  const totalForAria = directCount + indirectCount;
  const countTitle =
    indirectCount > 0
      ? t('treeSectionCountBreakdownAria', {
          direct: directCount,
          indirect: indirectCount,
          total: totalForAria,
        })
      : t('treeSectionCardCountAria', { count: directCount });
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
            title={countTitle}
          >
            {countLabel}
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
  getDirectCount,
  getIndirectCount,
  showExtended,
}: {
  getDirectCount: (col: MatterGridLevel) => number;
  getIndirectCount: (col: MatterGridLevel) => number;
  showExtended: boolean;
}) {
  const t = useTranslations('explore');
  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-surface/95 backdrop-blur-sm">
      <div className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {MATTER_GRID_LEVELS.map((col) => {
          const d = getDirectCount(col);
          const ind = getIndirectCount(col);
          const label = formatTreeSectionCountLabel(d, ind, showExtended);
          const totalForAria = d + ind;
          const countTitle =
            ind > 0
              ? t('treeSectionCountBreakdownAria', {
                  direct: d,
                  indirect: ind,
                  total: totalForAria,
                })
              : t('treeSectionCardCountAria', { count: d });
          return (
            <div
              key={col}
              className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 sm:flex-row sm:gap-2"
            >
              <span className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                {t(`builtUponLevel_${col}`)}
              </span>
              <span
                className="shrink-0 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-foreground/90 sm:text-xs"
                title={countTitle}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExtendedMatterColumnsBlock({
  buckets,
  scrollRootRef,
  selectNode,
  imageBustByNodeId,
}: {
  buckets: BuiltUponBuckets;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  selectNode: (id: string, options?: { center?: boolean }) => void;
  imageBustByNodeId: Record<string, number>;
}) {
  const hasAny = MATTER_GRID_LEVELS.some(
    (c) => buckets.matters[c].length > 0
  );
  if (!hasAny) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
        {MATTER_GRID_LEVELS.map((col) => (
          <div key={col} className={BUILT_UPON_MATTERS_SUBGRID}>
            {buckets.matters[col].map((n) => (
              <ScrollRevealCard key={n.id} scrollRootRef={scrollRootRef}>
                <div className="rounded-xl border-2 border-dashed border-white/70 p-[1px]">
                  <InventionCard
                    node={n}
                    variant="compact"
                    layoutId={cardLayoutId(n.id)}
                    imageBust={imageBustByNodeId[n.id] ?? 0}
                    exploreInteractive
                    href={treeInventionPath(n.id)}
                    onClick={() => selectNode(n.id, { center: false })}
                  />
                </div>
              </ScrollRevealCard>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExtendedFlatCardStrip({
  nodes,
  scrollRootRef,
  selectNode,
  imageBustByNodeId,
}: {
  nodes: TechNodeBasic[];
  scrollRootRef: RefObject<HTMLDivElement | null>;
  selectNode: (id: string, options?: { center?: boolean }) => void;
  imageBustByNodeId: Record<string, number>;
}) {
  if (nodes.length === 0) return null;
  return (
    <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
      <div className={BUILT_UPON_CARD_GRID}>
        {nodes.map((n) => (
          <ScrollRevealCard key={n.id} scrollRootRef={scrollRootRef}>
            <div className="rounded-xl border-2 border-dashed border-white/70 p-[1px]">
              <InventionCard
                node={n}
                variant="compact"
                layoutId={cardLayoutId(n.id)}
                imageBust={imageBustByNodeId[n.id] ?? 0}
                exploreInteractive
                href={treeInventionPath(n.id)}
                onClick={() => selectNode(n.id, { center: false })}
              />
            </div>
          </ScrollRevealCard>
        ))}
      </div>
    </div>
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
      aria-hidden
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
      aria-hidden
    >
      <path d="M4 10l4-4 4 4" />
      <path d="M8 6v12" />
      <path d="M14 4h6v4h-6z" />
      <path d="M14 10h6v4h-6z" />
      <path d="M14 16h6v4h-6z" />
    </svg>
  );
}

function TreeDisplayModeControls({
  treeView,
  setTreeViewMode,
}: {
  treeView: ExploreViewMode;
  setTreeViewMode: (mode: ExploreViewMode) => void;
}) {
  const t = useTranslations('explore');
  const linkNeighborhoodMode = useUIStore((s) => s.linkNeighborhoodMode);
  const setLinkNeighborhoodMode = useUIStore((s) => s.setLinkNeighborhoodMode);
  return (
    <>
      <div
        className="flex min-w-0 shrink-0 rounded-lg glass-search-field p-0.5"
        role="toolbar"
        aria-label={t('treeNavAria')}
      >
        <button
          type="button"
          aria-pressed={treeView === 'built-upon'}
          title={t('builtUponArboGrid')}
          onClick={() => setTreeViewMode('built-upon')}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${
            treeView === 'built-upon'
              ? 'bg-accent text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <IconGridDown className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{t('builtUponArboGrid')}</span>
        </button>
        <button
          type="button"
          aria-pressed={treeView === 'led-to'}
          title={t('builtUponArboList')}
          onClick={() => setTreeViewMode('led-to')}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-semibold sm:px-3 sm:text-sm ${
            treeView === 'led-to'
              ? 'bg-accent text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <IconGridUp className="h-4 w-4 shrink-0" aria-hidden />
          <span className="hidden sm:inline">{t('builtUponArboList')}</span>
        </button>
      </div>
      <div className="flex min-w-0 max-w-[9.5rem] shrink items-center sm:max-w-[11rem]">
        <label htmlFor="explore-link-neighborhood" className="sr-only">
          {t('linkNeighborhoodSelectAria')}
        </label>
        <select
          id="explore-link-neighborhood"
          value={linkNeighborhoodMode}
          onChange={(e) =>
            setLinkNeighborhoodMode(
              e.target.value as 'direct' | 'direct_and_extended'
            )
          }
          className="w-full min-w-0 rounded-lg border border-border bg-surface/90 px-2 py-1.5 text-xs text-foreground outline-none focus:border-accent sm:text-sm"
        >
          <option value="direct">{t('linkNeighborhoodDirect')}</option>
          <option value="direct_and_extended">
            {t('linkNeighborhoodDirectAndExtended')}
          </option>
        </select>
      </div>
    </>
  );
}

function BuiltUponViewInner({ focusId }: { focusId: string }) {
  const t = useTranslations('explore');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const treeView: ExploreViewMode = parseExploreViewMode(searchParams);
  const setTreeViewMode = useCallback(
    (mode: ExploreViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      if (mode === 'led-to') {
        params.set('view', 'led-to');
      } else {
        params.delete('view');
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );
  const { isAdmin } = useAuthStore();
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

  const linkNeighborhoodMode = useUIStore((s) => s.linkNeighborhoodMode);
  const showExtended = linkNeighborhoodMode === 'direct_and_extended';

  const setLinkMode = useUIStore((s) => s.setLinkNeighborhoodMode);
  /** Hydrate depuis le storage puis forcer « lien direct » sur /tree (sans persister — explore garde la préférence). */
  useLayoutEffect(() => {
    hydrateLinkNeighborhoodModeFromStorage();
    setLinkMode('direct', false);
  }, [setLinkMode]);

  const bucketsBuilt = useMemo(
    () => bucketDirectDependencies(focusId, nodes, edges),
    [focusId, nodes, edges]
  );

  const bucketsLed = useMemo(
    () => bucketLedToOutputs(focusId, nodes, edges),
    [focusId, nodes, edges]
  );

  const extUpstreamInfos = useMemo(
    () => buildExtendedUpstreamPeerInfos(focusId, edges, nodes),
    [focusId, edges, nodes]
  );

  const extDownstreamInfos = useMemo(
    () => buildExtendedDownstreamPeerInfos(focusId, edges, nodes),
    [focusId, edges, nodes]
  );

  const bucketsBuiltExt = useMemo(
    () => bucketExtendedUpstreamOnly(extUpstreamInfos, nodes),
    [extUpstreamInfos, nodes]
  );

  const bucketsLedExt = useMemo(
    () => bucketExtendedDownstreamOnly(extDownstreamInfos, nodes),
    [extDownstreamInfos, nodes]
  );

  const totalDown = useMemo(
    () => totalDownstreamCardCount(focusId, edges),
    [focusId, edges]
  );

  const [treeSectionsOpen, setTreeSectionsOpen] = useState<
    Record<TreeSectionKey, boolean>
  >({
    ledMatters: true,
    ledProcess: true,
    ledTools: true,
    ledComposants: true,
    ledEnergy: true,
    ledInfrastructure: true,
    builtMatters: true,
    builtProcess: true,
    builtTools: true,
    builtComposants: true,
    builtEnergy: true,
    builtInfrastructure: true,
  });

  const toggleTreeSection = useCallback((key: TreeSectionKey) => {
    setTreeSectionsOpen((s) => ({ ...s, [key]: !s[key] }));
  }, []);

  const ledMattersDirect = useMemo(
    () =>
      MATTER_GRID_LEVELS.reduce(
        (acc, c) => acc + bucketsLed.matters[c].length,
        0
      ),
    [bucketsLed]
  );
  const ledMattersIndirect = useMemo(
    () =>
      MATTER_GRID_LEVELS.reduce(
        (acc, c) => acc + bucketsLedExt.matters[c].length,
        0
      ),
    [bucketsLedExt]
  );
  const builtMattersDirect = useMemo(
    () =>
      MATTER_GRID_LEVELS.reduce(
        (acc, c) => acc + bucketsBuilt.matters[c].length,
        0
      ),
    [bucketsBuilt]
  );
  const builtMattersIndirect = useMemo(
    () =>
      MATTER_GRID_LEVELS.reduce(
        (acc, c) => acc + bucketsBuiltExt.matters[c].length,
        0
      ),
    [bucketsBuiltExt]
  );

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
          detailOpen && !isMobile ? 'sm:mr-[400px]' : ''
        }`}
      >
          <button
            type="button"
            onClick={() => openLegend()}
            aria-expanded={legendOpen}
            aria-pressed={legendOpen}
            className="shrink-0 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-foreground sm:text-sm"
          >
            {t('legendButton')}
          </button>
          {isAdmin ? <FilterPanel /> : null}
          {!detailOpen || isMobile ? (
            <div
              id="explore-tree-mode-toolbar-inline"
              className="flex min-w-0 items-center gap-3"
            >
              <TreeDisplayModeControls
                treeView={treeView}
                setTreeViewMode={setTreeViewMode}
              />
            </div>
          ) : (
            <div className="min-w-0 flex-1" aria-hidden />
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
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
        {detailOpen && !isMobile ? (
          <div
            id="explore-tree-mode-dock"
            className="pointer-events-auto fixed z-[96] flex max-h-[3.75rem] max-w-[min(calc(100vw-1rem),calc(100vw-400px))] shrink-0 items-center gap-2 rounded-lg border border-border/70 bg-surface/95 px-2 py-1.5 shadow-md backdrop-blur-md supports-[backdrop-filter]:bg-surface/85"
            style={{
              top: '3.5rem',
              right: EXPLORE_DETAIL_PANEL_WIDTH_PX,
            }}
          >
            <TreeDisplayModeControls
              treeView={treeView}
              setTreeViewMode={setTreeViewMode}
            />
          </div>
        ) : null}

      <ExploreScrollArea scrollRef={exploreScrollRef}>
        <div className="mx-auto w-full max-w-[min(100%,88rem)] pb-4 pt-0 xl:max-w-[min(100%,108rem)] 2xl:max-w-[min(100%,128rem)]">
          <LayoutGroup id="explore-tree-cards">
            {treeView === 'led-to' ? (
            <section
              id="led-to"
              className="scroll-mt-16"
              aria-labelledby="explore-led-to-heading"
            >
              <div
                className={`${BUILT_UPON_SECTION_BLEED_X} flex flex-col gap-6`}
              >
                <div className="rounded-xl glass-card p-4 pt-0 shadow-inner">
                  {treeSectionsOpen.ledMatters ? (
                    <div className={MATTERS_TITLE_AND_LEVELS_STICKY}>
                      <TreeDimensionSectionHeader
                        title={t('builtUponMatters')}
                        directCount={ledMattersDirect}
                        indirectCount={ledMattersIndirect}
                        showExtended={showExtended}
                        expanded={treeSectionsOpen.ledMatters}
                        onToggle={() => toggleTreeSection('ledMatters')}
                        stickyClassName=""
                        sectionId="explore-led-matters"
                      />
                      <MattersLevelSubheaderBar
                        getDirectCount={(col) => bucketsLed.matters[col].length}
                        getIndirectCount={(col) =>
                          bucketsLedExt.matters[col].length
                        }
                        showExtended={showExtended}
                      />
                    </div>
                  ) : (
                    <TreeDimensionSectionHeader
                      title={t('builtUponMatters')}
                      directCount={ledMattersDirect}
                      indirectCount={ledMattersIndirect}
                      showExtended={showExtended}
                      expanded={treeSectionsOpen.ledMatters}
                      onToggle={() => toggleTreeSection('ledMatters')}
                      stickyClassName={STICKY_SECTION_BELOW_TREE_NAV_MATTERS_TOP}
                      sectionId="explore-led-matters"
                    />
                  )}
                  {treeSectionsOpen.ledMatters ? (
                    <div id="explore-led-matters-content">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
                        {MATTER_GRID_LEVELS.map((col) => (
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
                      {showExtended ? (
                        <ExtendedMatterColumnsBlock
                          buckets={bucketsLedExt}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                      {MATTER_GRID_LEVELS.every((c) => {
                        const d = bucketsLed.matters[c].length;
                        const e = showExtended
                          ? bucketsLedExt.matters[c].length
                          : 0;
                        return d + e === 0;
                      }) ? (
                        <p className="py-2 text-sm text-muted-foreground">
                          {t('ledToNoMatters')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponProcess')}
                    directCount={bucketsLed.process.length}
                    indirectCount={bucketsLedExt.process.length}
                    showExtended={showExtended}
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
                        {bucketsLed.process.length === 0 &&
                        (!showExtended || bucketsLedExt.process.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsLedExt.process}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponTools')}
                    directCount={bucketsLed.tools.length}
                    indirectCount={bucketsLedExt.tools.length}
                    showExtended={showExtended}
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
                        {bucketsLed.tools.length === 0 &&
                        (!showExtended || bucketsLedExt.tools.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsLedExt.tools}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponComposants')}
                    directCount={bucketsLed.composants.length}
                    indirectCount={bucketsLedExt.composants.length}
                    showExtended={showExtended}
                    expanded={treeSectionsOpen.ledComposants}
                    onToggle={() => toggleTreeSection('ledComposants')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-led-composants"
                  />
                  {treeSectionsOpen.ledComposants ? (
                    <div id="explore-led-composants-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsLed.composants.map((n) => (
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
                        {bucketsLed.composants.length === 0 &&
                        (!showExtended ||
                          bucketsLedExt.composants.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsLedExt.composants}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponEnergy')}
                    directCount={bucketsLed.energy.length}
                    indirectCount={bucketsLedExt.energy.length}
                    showExtended={showExtended}
                    expanded={treeSectionsOpen.ledEnergy}
                    onToggle={() => toggleTreeSection('ledEnergy')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-led-energy"
                  />
                  {treeSectionsOpen.ledEnergy ? (
                    <div id="explore-led-energy-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsLed.energy.map((n) => (
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
                        {bucketsLed.energy.length === 0 &&
                        (!showExtended || bucketsLedExt.energy.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsLedExt.energy}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponInfrastructure')}
                    directCount={bucketsLed.infrastructure.length}
                    indirectCount={bucketsLedExt.infrastructure.length}
                    showExtended={showExtended}
                    expanded={treeSectionsOpen.ledInfrastructure}
                    onToggle={() => toggleTreeSection('ledInfrastructure')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-led-infrastructure"
                  />
                  {treeSectionsOpen.ledInfrastructure ? (
                    <div id="explore-led-infrastructure-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsLed.infrastructure.map((n) => (
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
                        {bucketsLed.infrastructure.length === 0 &&
                        (!showExtended ||
                          bucketsLedExt.infrastructure.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsLedExt.infrastructure}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
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
            ) : null}
            {treeView === 'built-upon' ? (
            <section
              id="built-upon"
              className="scroll-mt-16"
              aria-label={t('builtUponArboGrid')}
            >
              <div
                className={`${BUILT_UPON_SECTION_BLEED_X} flex flex-col gap-8`}
              >
                <div className="rounded-xl glass-card p-4 shadow-inner">
                  {treeSectionsOpen.builtMatters ? (
                    <div className={MATTERS_TITLE_AND_LEVELS_STICKY}>
                      <TreeDimensionSectionHeader
                        title={t('builtUponMatters')}
                        directCount={builtMattersDirect}
                        indirectCount={builtMattersIndirect}
                        showExtended={showExtended}
                        expanded={treeSectionsOpen.builtMatters}
                        onToggle={() => toggleTreeSection('builtMatters')}
                        stickyClassName=""
                        sectionId="explore-built-matters"
                      />
                      <MattersLevelSubheaderBar
                        getDirectCount={(col) =>
                          bucketsBuilt.matters[col].length
                        }
                        getIndirectCount={(col) =>
                          bucketsBuiltExt.matters[col].length
                        }
                        showExtended={showExtended}
                      />
                    </div>
                  ) : (
                    <TreeDimensionSectionHeader
                      title={t('builtUponMatters')}
                      directCount={builtMattersDirect}
                      indirectCount={builtMattersIndirect}
                      showExtended={showExtended}
                      expanded={treeSectionsOpen.builtMatters}
                      onToggle={() => toggleTreeSection('builtMatters')}
                      stickyClassName={STICKY_SECTION_BELOW_TREE_NAV_MATTERS_TOP}
                      sectionId="explore-built-matters"
                    />
                  )}
                  {treeSectionsOpen.builtMatters ? (
                    <div id="explore-built-matters-content">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:items-start">
                        {MATTER_GRID_LEVELS.map((col) => (
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
                      {showExtended ? (
                        <ExtendedMatterColumnsBlock
                          buckets={bucketsBuiltExt}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                      {MATTER_GRID_LEVELS.every((c) => {
                        const d = bucketsBuilt.matters[c].length;
                        const e = showExtended
                          ? bucketsBuiltExt.matters[c].length
                          : 0;
                        return d + e === 0;
                      }) ? (
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
                    directCount={bucketsBuilt.process.length}
                    indirectCount={bucketsBuiltExt.process.length}
                    showExtended={showExtended}
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
                        {bucketsBuilt.process.length === 0 &&
                        (!showExtended ||
                          bucketsBuiltExt.process.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsBuiltExt.process}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponTools')}
                    directCount={bucketsBuilt.tools.length}
                    indirectCount={bucketsBuiltExt.tools.length}
                    showExtended={showExtended}
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
                        {bucketsBuilt.tools.length === 0 &&
                        (!showExtended || bucketsBuiltExt.tools.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsBuiltExt.tools}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponComposants')}
                    directCount={bucketsBuilt.composants.length}
                    indirectCount={bucketsBuiltExt.composants.length}
                    showExtended={showExtended}
                    expanded={treeSectionsOpen.builtComposants}
                    onToggle={() => toggleTreeSection('builtComposants')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-built-composants"
                  />
                  {treeSectionsOpen.builtComposants ? (
                    <div id="explore-built-composants-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsBuilt.composants.map((n) => (
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
                        {bucketsBuilt.composants.length === 0 &&
                        (!showExtended ||
                          bucketsBuiltExt.composants.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsBuiltExt.composants}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponEnergy')}
                    directCount={bucketsBuilt.energy.length}
                    indirectCount={bucketsBuiltExt.energy.length}
                    showExtended={showExtended}
                    expanded={treeSectionsOpen.builtEnergy}
                    onToggle={() => toggleTreeSection('builtEnergy')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-built-energy"
                  />
                  {treeSectionsOpen.builtEnergy ? (
                    <div id="explore-built-energy-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsBuilt.energy.map((n) => (
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
                        {bucketsBuilt.energy.length === 0 &&
                        (!showExtended ||
                          bucketsBuiltExt.energy.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsBuiltExt.energy}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl glass-card p-4">
                  <TreeDimensionSectionHeader
                    title={t('builtUponInfrastructure')}
                    directCount={bucketsBuilt.infrastructure.length}
                    indirectCount={bucketsBuiltExt.infrastructure.length}
                    showExtended={showExtended}
                    expanded={treeSectionsOpen.builtInfrastructure}
                    onToggle={() => toggleTreeSection('builtInfrastructure')}
                    stickyClassName={STICKY_SECTION_BELOW_TREE_NAV}
                    sectionId="explore-built-infrastructure"
                  />
                  {treeSectionsOpen.builtInfrastructure ? (
                    <div id="explore-built-infrastructure-content">
                      <div className={BUILT_UPON_CARD_GRID}>
                        {bucketsBuilt.infrastructure.map((n) => (
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
                        {bucketsBuilt.infrastructure.length === 0 &&
                        (!showExtended ||
                          bucketsBuiltExt.infrastructure.length === 0) ? (
                          <p className="col-span-full text-sm text-muted-foreground">
                            {t('builtUponEmpty')}
                          </p>
                        ) : null}
                      </div>
                      {showExtended ? (
                        <ExtendedFlatCardStrip
                          nodes={bucketsBuiltExt.infrastructure}
                          scrollRootRef={exploreScrollRef}
                          selectNode={selectNode}
                          imageBustByNodeId={imageBustByNodeId}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
            ) : null}
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
      <BuiltUponViewInner focusId={focusId} />
    </ExploreCardProvider>
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

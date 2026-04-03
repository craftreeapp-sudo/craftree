'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AppContentShell } from '@/components/layout/AppContentShell';
import { ExploreCardProvider } from '@/components/explore/explore-card-context';
import { ExploreHoverPopup } from '@/components/explore/HoverPopup';
import { InventionCard } from '@/components/explore/InventionCard';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';
import { useGraphStore } from '@/stores/graph-store';
import { useAuthStore } from '@/stores/auth-store';
import {
  DIMENSION_LABELS_FR,
  ERA_LABELS_FR,
  MATERIAL_LEVEL_LABELS_FR,
  NODE_CATEGORY_LABELS_FR,
  NODE_CATEGORY_ORDER,
} from '@/lib/node-labels';
import {
  effectiveDimension,
  effectiveMaterialLevel,
} from '@/lib/node-dimension-helpers';
import type { FilterKind } from '@/lib/category-filter-routes';
import type {
  Era,
  MaterialLevel,
  NodeCategory,
  NodeDimension,
  TechNodeBasic,
} from '@/lib/types';
import { treeInventionPath } from '@/lib/tree-routes';
import {
  EDITOR_DIM_KEY,
  EDITOR_LEVEL_KEY,
} from '@/components/editor/dimension-editor-keys';
import { CATEGORY_LIST_GRID_CLASS } from '@/components/categories/category-list-card-layout';
import {
  CategoryListCardLayoutSwitcher,
  useCategoryListCardLayout,
} from '@/components/categories/CategoryListCardLayoutSwitcher';
import { CategoryFilterSidebar } from '@/components/categories/CategoryFilterSidebar';
import { EraCategoryAnchorSidebar } from '@/components/categories/EraCategoryAnchorSidebar';
import { EraDecadeAnchorSidebar } from '@/components/categories/EraDecadeAnchorSidebar';
import { safeCategoryLabel } from '@/lib/safe-category-label';

interface TechListByFilterClientProps {
  kind: FilterKind;
  id: string;
}

function filterNodes(
  nodes: TechNodeBasic[],
  kind: FilterKind,
  rawId: string
): TechNodeBasic[] {
  if (kind === 'category') {
    const cat = rawId as NodeCategory;
    return nodes.filter((n) => n.category === cat);
  }
  if (kind === 'era') {
    const era = rawId as Era;
    return nodes.filter((n) => n.era === era);
  }
  if (kind === 'dimension') {
    const dim = rawId as NodeDimension;
    return nodes.filter((n) => effectiveDimension(n) === dim);
  }
  const ml = rawId as MaterialLevel;
  return nodes.filter(
    (n) =>
      effectiveDimension(n) === 'matter' &&
      effectiveMaterialLevel(n) === ml
  );
}

function fallbackMetaLabel(kind: FilterKind, id: string): string {
  if (kind === 'category') {
    return NODE_CATEGORY_LABELS_FR[id as NodeCategory] ?? id;
  }
  if (kind === 'era') {
    return ERA_LABELS_FR[id as Era] ?? id;
  }
  if (kind === 'dimension') {
    return DIMENSION_LABELS_FR[id as NodeDimension] ?? id;
  }
  return MATERIAL_LEVEL_LABELS_FR[id as MaterialLevel] ?? id;
}

function cardLayoutId(nodeId: string) {
  return `cat-filter-card-${nodeId}`;
}

function matchesCategoryListSearch(node: TechNodeBasic, rawQuery: string): boolean {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return true;
  const parts = [node.name, node.name_en, ...node.tags]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase());
  return parts.some((p) => p.includes(q));
}

function sortNodesByName(nodes: TechNodeBasic[]): TechNodeBasic[] {
  return [...nodes].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Début de décennie (ex. 1743 → 1740). */
function eraDecadeStart(year: number): number {
  return Math.floor(year / 10) * 10;
}

function groupEraByCategory(
  nodes: TechNodeBasic[]
): { category: NodeCategory; nodes: TechNodeBasic[] }[] {
  const byCat = new Map<NodeCategory, TechNodeBasic[]>();
  for (const n of nodes) {
    const list = byCat.get(n.category) ?? [];
    list.push(n);
    byCat.set(n.category, list);
  }
  const order = [...NODE_CATEGORY_ORDER];
  const extra = [...byCat.keys()].filter((k) => !order.includes(k));
  const sequence = [...order, ...extra];
  const out: { category: NodeCategory; nodes: TechNodeBasic[] }[] = [];
  for (const cat of sequence) {
    const list = byCat.get(cat);
    if (list?.length) {
      out.push({ category: cat, nodes: sortNodesByName(list) });
    }
  }
  return out;
}

function groupEraByDecade(
  nodes: TechNodeBasic[]
): { decade: number | 'none'; nodes: TechNodeBasic[] }[] {
  const byD = new Map<number | 'none', TechNodeBasic[]>();
  for (const n of nodes) {
    const y = n.year_approx;
    const key: number | 'none' =
      y === undefined || y === null ? 'none' : eraDecadeStart(y);
    const list = byD.get(key) ?? [];
    list.push(n);
    byD.set(key, list);
  }
  const numericDecades = [...byD.keys()].filter(
    (k): k is number => k !== 'none'
  );
  numericDecades.sort((a, b) => b - a);
  const out: { decade: number | 'none'; nodes: TechNodeBasic[] }[] = [];
  for (const d of numericDecades) {
    const list = byD.get(d)!;
    list.sort((a, b) => {
      const ya = a.year_approx ?? 0;
      const yb = b.year_approx ?? 0;
      if (yb !== ya) return yb - ya;
      return a.name.localeCompare(b.name, 'fr');
    });
    out.push({ decade: d, nodes: list });
  }
  const noneList = byD.get('none');
  if (noneList?.length) {
    out.push({ decade: 'none', nodes: sortNodesByName(noneList) });
  }
  return out;
}

export function TechListByFilterClient({ kind, id }: TechListByFilterClientProps) {
  const tPage = useTranslations('categoriesPage');
  const tCat = useTranslations('categories');
  const tEra = useTranslations('eras');
  const te = useTranslations('editor');
  const isMobile = useIsMobileBreakpoint();

  const allNodes = useGraphStore((s) => s.nodes);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const refreshData = useGraphStore((s) => s.refreshData);
  const isAdmin = useAuthStore((s) => s.isAdmin);

  useEffect(() => {
    if (allNodes.length === 0) void refreshData();
  }, [allNodes.length, refreshData]);

  const filterLabel = useMemo(() => {
    if (kind === 'category') {
      return tCat.has(id) ? tCat(id) : fallbackMetaLabel(kind, id);
    }
    if (kind === 'era') {
      return tEra.has(id) ? tEra(id) : fallbackMetaLabel(kind, id);
    }
    if (kind === 'dimension') {
      const dim = id as NodeDimension;
      const k = EDITOR_DIM_KEY[dim];
      return k && te.has(k) ? te(k) : fallbackMetaLabel(kind, id);
    }
    if (kind === 'materialLevel') {
      const lv = id as MaterialLevel;
      const k = EDITOR_LEVEL_KEY[lv];
      return k && te.has(k) ? te(k) : fallbackMetaLabel(kind, id);
    }
    return fallbackMetaLabel(kind, id);
  }, [kind, id, tCat, tEra, te]);

  const subtitle = useMemo(() => {
    if (kind === 'category') return tPage('listSubtitleCategory');
    if (kind === 'era') return tPage('listSubtitleEra');
    if (kind === 'dimension') return tPage('listSubtitleDimension');
    return tPage('listSubtitleMaterialLevel');
  }, [kind, tPage]);

  const rawItems = useMemo(() => {
    const base = filterNodes(allNodes, kind, id);
    const visible = isAdmin
      ? base
      : base.filter((n) => !n.is_draft);
    return visible;
  }, [allNodes, kind, id, isAdmin]);

  const items = useMemo(() => {
    if (kind === 'era') {
      return rawItems;
    }
    return sortNodesByName(rawItems);
  }, [rawItems, kind]);

  const [searchQuery, setSearchQuery] = useState('');
  const [eraSortMode, setEraSortMode] = useState<'category' | 'date'>(
    'category'
  );
  const [eraHeaderCompact, setEraHeaderCompact] = useState(false);

  useEffect(() => {
    if (kind !== 'era') return;
    const threshold = 40;
    const onScroll = () => {
      setEraHeaderCompact(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [kind]);

  const isEraCompact = kind === 'era' && eraHeaderCompact;

  const filteredItems = useMemo(
    () => items.filter((n) => matchesCategoryListSearch(n, searchQuery)),
    [items, searchQuery]
  );

  const eraSections = useMemo(() => {
    if (kind !== 'era') return null;
    if (eraSortMode === 'category') {
      return { mode: 'category' as const, groups: groupEraByCategory(filteredItems) };
    }
    return { mode: 'date' as const, groups: groupEraByDecade(filteredItems) };
  }, [kind, eraSortMode, filteredItems]);

  const pageTitle = tPage('listPageTitle', { label: filterLabel });

  const [cardLayout, setCardLayout] = useCategoryListCardLayout();

  const renderCardGrid = (nodes: TechNodeBasic[]) => (
    <div
      className={CATEGORY_LIST_GRID_CLASS[cardLayout]}
      suppressHydrationWarning
    >
      {nodes.map((node) => (
        <InventionCard
          key={node.id}
          node={node}
          variant="compact"
          layoutId={cardLayoutId(node.id)}
          imageBust={imageBustByNodeId[node.id] ?? 0}
          exploreInteractive
          href={treeInventionPath(node.id)}
        />
      ))}
    </div>
  );

  const listBody =
    items.length === 0 ? (
      <p className="rounded-xl glass-card px-4 py-8 text-center text-sm text-muted-foreground">
        {tPage('noResults')}
      </p>
    ) : filteredItems.length === 0 ? (
      <p className="rounded-xl glass-card px-4 py-8 text-center text-sm text-muted-foreground">
        {tPage('categoryListNoSearchMatch')}
      </p>
    ) : kind === 'era' && eraSections ? (
      <div className="space-y-10 md:space-y-12">
        {eraSections.mode === 'category'
          ? eraSections.groups.map(({ category: cat, nodes }) => (
              <section
                key={cat}
                className="rounded-xl"
                aria-labelledby={`era-cat-${cat}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <h2
                    id={`era-cat-${cat}`}
                    className="shrink-0 scroll-mt-44 text-lg font-semibold tracking-tight text-foreground lg:scroll-mt-48"
                  >
                    {safeCategoryLabel(tCat, cat)}
                  </h2>
                  <div
                    className="h-px min-w-[2rem] flex-1 border-t border-dashed border-border/80"
                    aria-hidden
                  />
                </div>
                {renderCardGrid(nodes)}
              </section>
            ))
          : eraSections.groups.map(({ decade, nodes }) => (
              <section
                key={decade === 'none' ? 'no-year' : decade}
                className="rounded-xl"
                aria-labelledby={
                  decade === 'none' ? 'era-dec-none' : `era-dec-${decade}`
                }
              >
                <div className="mb-4 flex items-center gap-3">
                  <h2
                    id={
                      decade === 'none' ? 'era-dec-none' : `era-dec-${decade}`
                    }
                    className="shrink-0 scroll-mt-44 text-lg font-semibold tabular-nums tracking-tight text-foreground lg:scroll-mt-48"
                  >
                    {decade === 'none'
                      ? tPage('eraDecadeUnknown')
                      : String(decade)}
                  </h2>
                  <div
                    className="h-px min-w-[2rem] flex-1 border-t border-dashed border-border/80"
                    aria-hidden
                  />
                </div>
                {renderCardGrid(nodes)}
              </section>
            ))}
      </div>
    ) : (
      renderCardGrid(filteredItems)
    );

  const mainColumn = (
    <>
      {/* Colle sous la barre globale (h-14) ; fond flouté pour masquer la liste au scroll */}
      <div
        className={`sticky top-14 z-40 -mx-8 mb-8 border-b border-border/45 bg-page/95 backdrop-blur-md supports-[backdrop-filter]:bg-page/88 sm:-mx-10 sm:px-10 ${
          isEraCompact
            ? 'px-8 pb-2.5 pt-0 shadow-md transition-[padding,box-shadow] duration-200'
            : 'px-8 pb-5 pt-1 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.45)] transition-[padding,box-shadow] duration-200'
        }`}
      >
        <nav
          className={
            isEraCompact
              ? 'mb-2 text-xs text-muted-foreground'
              : 'mb-4 text-sm text-muted-foreground'
          }
        >
          <Link
            href="/categories"
            className="text-accent transition-colors hover:underline"
          >
            {tPage('backToCategories')}
          </Link>
        </nav>

        <header>
          <div
            className={`flex flex-col lg:justify-between ${
              isEraCompact
                ? 'gap-3 lg:flex-row lg:items-center lg:gap-4'
                : 'gap-5 lg:flex-row lg:items-start lg:gap-8'
            }`}
          >
            <div className="min-w-0 flex-1">
              {isEraCompact ? (
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h1
                    className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight text-foreground md:text-xl"
                    style={{
                      fontFamily:
                        'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
                    }}
                  >
                    {pageTitle}
                  </h1>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {searchQuery.trim()
                      ? tPage('techCountFiltered', {
                          shown: filteredItems.length,
                          total: items.length,
                        })
                      : tPage('techCount', { count: items.length })}
                  </span>
                </div>
              ) : (
                <h1
                  className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
                  style={{
                    fontFamily:
                      'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
                  }}
                >
                  {pageTitle}
                </h1>
              )}
              {!isEraCompact ? (
                <>
                  <p className="mt-2 text-sm text-muted-foreground md:text-base">
                    {subtitle}
                  </p>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {searchQuery.trim()
                      ? tPage('techCountFiltered', {
                          shown: filteredItems.length,
                          total: items.length,
                        })
                      : tPage('techCount', { count: items.length })}
                  </p>
                </>
              ) : null}
              {kind === 'era' && items.length > 0 ? (
                <div
                  className={
                    isEraCompact
                      ? 'mt-2 flex flex-wrap gap-1.5'
                      : 'mt-5 flex flex-wrap gap-2'
                  }
                  role="group"
                  aria-label={tPage('eraSortAriaLabel')}
                >
                  <button
                    type="button"
                    onClick={() => setEraSortMode('category')}
                    className={
                      eraSortMode === 'category'
                        ? isEraCompact
                          ? 'rounded-md border border-accent/45 bg-accent/15 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm ring-1 ring-accent/25'
                          : 'rounded-lg border border-accent/45 bg-accent/15 px-3.5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-accent/25'
                        : isEraCompact
                          ? 'rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground'
                          : 'rounded-lg border border-transparent px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground'
                    }
                  >
                    {tPage('eraSortCategory')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEraSortMode('date')}
                    className={
                      eraSortMode === 'date'
                        ? isEraCompact
                          ? 'rounded-md border border-accent/45 bg-accent/15 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm ring-1 ring-accent/25'
                          : 'rounded-lg border border-accent/45 bg-accent/15 px-3.5 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-accent/25'
                        : isEraCompact
                          ? 'rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground'
                          : 'rounded-lg border border-transparent px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground'
                    }
                  >
                    {tPage('eraSortDate')}
                  </button>
                </div>
              ) : null}
            </div>
            {items.length > 0 ? (
              <div
                className={`flex w-full shrink-0 flex-col sm:max-w-md lg:w-80 lg:max-w-none ${
                  isEraCompact ? 'gap-2' : 'gap-3'
                }`}
              >
                <label htmlFor="category-list-search" className="sr-only">
                  {tPage('categoryListSearchAria')}
                </label>
                <input
                  id="category-list-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tPage('categoryListSearchPlaceholder')}
                  autoComplete="off"
                  className={
                    isEraCompact
                      ? 'w-full rounded-lg glass-search-field px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring-focus'
                      : 'w-full rounded-lg glass-search-field px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring-focus'
                  }
                />
                <div className="w-full lg:flex lg:justify-end">
                  <CategoryListCardLayoutSwitcher
                    layout={cardLayout}
                    onChange={setCardLayout}
                    compact={isEraCompact}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </header>
      </div>

      {listBody}
    </>
  );

  return (
    <ExploreCardProvider isMobile={isMobile}>
      <ExploreHoverPopup />
      <AppContentShell
        as="main"
        variant={kind === 'category' || kind === 'era' ? 'full' : 'wide'}
        className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col"
      >
        {kind === 'category' ? (
          <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            <CategoryFilterSidebar activeId={id as NodeCategory} />
            <div className="min-w-0 w-full flex-1 lg:max-w-6xl">{mainColumn}</div>
          </div>
        ) : kind === 'era' ? (
          <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
            {filteredItems.length > 0 &&
            eraSections &&
            eraSections.groups.length > 0 ? (
              eraSections.mode === 'category' ? (
                <EraCategoryAnchorSidebar groups={eraSections.groups} />
              ) : (
                <EraDecadeAnchorSidebar groups={eraSections.groups} />
              )
            ) : null}
            <div className="min-w-0 w-full flex-1 lg:max-w-6xl">{mainColumn}</div>
          </div>
        ) : (
          mainColumn
        )}
      </AppContentShell>
    </ExploreCardProvider>
  );
}

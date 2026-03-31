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
import {
  ERA_LABELS_FR,
  NODE_CATEGORY_LABELS_FR,
  TECH_NODE_TYPE_LABELS_FR,
} from '@/lib/node-labels';
import type { FilterKind } from '@/lib/category-filter-routes';
import type {
  Era,
  NodeCategory,
  TechNodeType,
  TechNodeBasic,
} from '@/lib/types';
import { treeInventionPath } from '@/lib/tree-routes';
import { CATEGORY_LIST_GRID_CLASS } from '@/components/categories/category-list-card-layout';
import {
  CategoryListCardLayoutSwitcher,
  useCategoryListCardLayout,
} from '@/components/categories/CategoryListCardLayoutSwitcher';
import { CategoryFilterSidebar } from '@/components/categories/CategoryFilterSidebar';

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
  const t = rawId as TechNodeType;
  return nodes.filter((n) => n.type === t);
}

function fallbackMetaLabel(kind: FilterKind, id: string): string {
  if (kind === 'category') {
    return NODE_CATEGORY_LABELS_FR[id as NodeCategory] ?? id;
  }
  if (kind === 'era') {
    return ERA_LABELS_FR[id as Era] ?? id;
  }
  return TECH_NODE_TYPE_LABELS_FR[id as TechNodeType] ?? id;
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

export function TechListByFilterClient({ kind, id }: TechListByFilterClientProps) {
  const tPage = useTranslations('categoriesPage');
  const tCat = useTranslations('categories');
  const tEra = useTranslations('eras');
  const tType = useTranslations('types');
  const isMobile = useIsMobileBreakpoint();

  const allNodes = useGraphStore((s) => s.nodes);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const refreshData = useGraphStore((s) => s.refreshData);

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
    return tType.has(id) ? tType(id) : fallbackMetaLabel(kind, id);
  }, [kind, id, tCat, tEra, tType]);

  const subtitle = useMemo(() => {
    if (kind === 'category') return tPage('listSubtitleCategory');
    if (kind === 'era') return tPage('listSubtitleEra');
    return tPage('listSubtitleType');
  }, [kind, tPage]);

  const items = useMemo(
    () =>
      [...filterNodes(allNodes, kind, id)].sort((a, b) =>
        a.name.localeCompare(b.name, 'fr')
      ),
    [allNodes, kind, id]
  );

  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(
    () => items.filter((n) => matchesCategoryListSearch(n, searchQuery)),
    [items, searchQuery]
  );

  const pageTitle = tPage('listPageTitle', { label: filterLabel });

  const [cardLayout, setCardLayout] = useCategoryListCardLayout();

  const listBody =
    items.length === 0 ? (
      <p className="rounded-xl glass-card px-4 py-8 text-center text-sm text-muted-foreground">
        {tPage('noResults')}
      </p>
    ) : filteredItems.length === 0 ? (
      <p className="rounded-xl glass-card px-4 py-8 text-center text-sm text-muted-foreground">
        {tPage('categoryListNoSearchMatch')}
      </p>
    ) : (
      <div
        className={CATEGORY_LIST_GRID_CLASS[cardLayout]}
        suppressHydrationWarning
      >
        {filteredItems.map((node) => (
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

  const mainColumn = (
    <>
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link
          href="/categories"
          className="text-accent transition-colors hover:underline"
        >
          {tPage('backToCategories')}
        </Link>
      </nav>

      <header className="mb-8 md:mb-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">
            <h1
              className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
              style={{
                fontFamily:
                  'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              }}
            >
              {pageTitle}
            </h1>
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
          </div>
          {items.length > 0 ? (
            <div className="flex w-full shrink-0 flex-col gap-3 sm:max-w-md lg:w-80 lg:max-w-none">
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
                className="w-full rounded-lg glass-search-field px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring-focus"
              />
              <div className="w-full lg:flex lg:justify-end">
                <CategoryListCardLayoutSwitcher
                  layout={cardLayout}
                  onChange={setCardLayout}
                />
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {listBody}
    </>
  );

  return (
    <ExploreCardProvider isMobile={isMobile}>
      <ExploreHoverPopup />
      <AppContentShell
        as="main"
        variant={kind === 'category' ? 'full' : 'wide'}
        className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col"
      >
        {kind === 'category' ? (
          <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
            <CategoryFilterSidebar activeId={id as NodeCategory} />
            <div className="min-w-0 w-full flex-1 lg:max-w-6xl">{mainColumn}</div>
          </div>
        ) : (
          mainColumn
        )}
      </AppContentShell>
    </ExploreCardProvider>
  );
}

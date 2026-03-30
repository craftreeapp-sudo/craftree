'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AppContentShell } from '@/components/layout/AppContentShell';
import { ExploreCardProvider } from '@/components/explore/explore-card-context';
import { ExploreHoverPopup } from '@/components/explore/HoverPopup';
import { InventionCard } from '@/components/explore/InventionCard';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';
import { directDependencyCount } from '@/lib/built-upon-utils';
import { useGraphStore } from '@/stores/graph-store';
import { useUIStore } from '@/stores/ui-store';
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
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';
import { CATEGORY_LIST_GRID_CLASS } from '@/components/categories/category-list-card-layout';
import {
  CategoryListCardLayoutSwitcher,
  useCategoryListCardLayout,
} from '@/components/categories/CategoryListCardLayoutSwitcher';

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

export function TechListByFilterClient({ kind, id }: TechListByFilterClientProps) {
  const router = useRouter();
  const tPage = useTranslations('categoriesPage');
  const tCat = useTranslations('categories');
  const tEra = useTranslations('eras');
  const tType = useTranslations('types');
  const isMobile = useIsMobileBreakpoint();

  const allNodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const refreshData = useGraphStore((s) => s.refreshData);
  const setOnlyCategory = useUIStore((s) => s.setOnlyCategory);
  const setOnlyEra = useUIStore((s) => s.setOnlyEra);
  const setOnlyType = useUIStore((s) => s.setOnlyType);

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

  const openFilteredGraph = () => {
    if (kind === 'category') setOnlyCategory(id as NodeCategory);
    else if (kind === 'era') setOnlyEra(id as Era);
    else setOnlyType(id as TechNodeType);
    router.push(treeInventionPath(getDefaultTreeNodeId()));
  };

  const pageTitle = tPage('listPageTitle', { label: filterLabel });

  const [cardLayout, setCardLayout] = useCategoryListCardLayout();

  const listBody =
    items.length === 0 ? (
      <p className="rounded-xl border border-border bg-surface-elevated px-4 py-8 text-center text-sm text-muted-foreground">
        {tPage('noResults')}
      </p>
    ) : (
      <div
        className={CATEGORY_LIST_GRID_CLASS[cardLayout]}
        suppressHydrationWarning
      >
        {items.map((node) => (
          <InventionCard
            key={node.id}
            node={node}
            directDeps={directDependencyCount(node.id, edges)}
            variant="compact"
            layoutId={cardLayoutId(node.id)}
            imageBust={imageBustByNodeId[node.id] ?? 0}
            exploreInteractive
            onClick={() => router.push(treeInventionPath(node.id))}
          />
        ))}
      </div>
    );

  return (
    <ExploreCardProvider isMobile={isMobile}>
      <ExploreHoverPopup />
      <AppContentShell
        as="main"
        variant="wide"
        className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col"
      >
        <nav className="mb-6 text-sm text-muted-foreground">
          <Link
            href="/categories"
            className="text-accent transition-colors hover:underline"
          >
            {tPage('backToCategories')}
          </Link>
        </nav>

        <header className="mb-8 md:mb-10">
          <h1
            className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            }}
          >
            {pageTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">{subtitle}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            {tPage('techCount', { count: items.length })}
          </p>
          <button
            type="button"
            onClick={openFilteredGraph}
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#3B82F6] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#3B82F6]/25 transition-colors hover:bg-[#60A5FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD]"
          >
            {tPage('openFilteredTree')}
          </button>
        </header>

        {items.length > 0 ? (
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <CategoryListCardLayoutSwitcher
              layout={cardLayout}
              onChange={setCardLayout}
            />
          </div>
        ) : null}

        {listBody}
      </AppContentShell>
    </ExploreCardProvider>
  );
}

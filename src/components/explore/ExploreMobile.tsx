'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import { getCategoryColor } from '@/lib/colors';
import { formatYear } from '@/lib/utils';
import { nodePassesFilters } from '@/lib/graph-filters';
import type {
  CraftingLink,
  NodeCategory,
  RelationType,
  TechNodeBasic,
  TechNodeType,
} from '@/lib/types';
import { useNodeDetailsStore } from '@/stores/node-details-store';

const ERA_LABELS: Record<string, string> = {
  prehistoric: 'Préhistorique',
  ancient: 'Antiquité',
  medieval: 'Moyen Âge',
  renaissance: 'Renaissance',
  industrial: 'Industriel',
  modern: 'Moderne',
  digital: 'Numérique',
  contemporary: 'Contemporain',
};

const RELATION_LABELS: Record<RelationType, string> = {
  material: 'Matériau',
  tool: 'Outil',
  energy: 'Énergie',
  knowledge: 'Connaissance',
  catalyst: 'Catalyseur',
};

const NODE_TYPE_LABELS: Record<TechNodeType, string> = {
  raw_material: 'Matière première',
  material: 'Matériau',
  process: 'Procédé',
  tool: 'Outil',
  component: 'Composant',
  end_product: 'Produit final',
};

const RELATION_DOT: Record<RelationType, string> = {
  material: '#94A3B8',
  tool: '#A78BFA',
  energy: '#EF4444',
  knowledge: '#38BDF8',
  catalyst: 'rgba(139, 149, 168, 0.5)',
};

export function ExploreMobile() {
  const router = useRouter();
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const exploreStack = useUIStore((s) => s.exploreStack);
  const selectNode = useUIStore((s) => s.selectNode);
  const popExploreStack = useUIStore((s) => s.popExploreStack);
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const activeCategories = useUIStore((s) => s.activeCategories);
  const activeEras = useUIStore((s) => s.activeEras);
  const activeTypes = useUIStore((s) => s.activeTypes);

  const nodes = useGraphStore((s) => s.nodes);
  const getNodeById = useGraphStore((s) => s.getNodeById);
  const getRecipeForNode = useGraphStore((s) => s.getRecipeForNode);
  const getUsagesOfNode = useGraphStore((s) => s.getUsagesOfNode);

  const showDetail = Boolean(selectedNodeId && isSidebarOpen);

  const detailsById = useNodeDetailsStore((s) => s.byId);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const getNodeDetails = useGraphStore((s) => s.getNodeDetails);

  useEffect(() => {
    if (!showDetail || !selectedNodeId) return;
    let cancelled = false;
    void getNodeDetails(selectedNodeId).then((d) => {
      if (!cancelled && d) mergeDetail(selectedNodeId, d);
    });
    return () => {
      cancelled = true;
    };
  }, [showDetail, selectedNodeId, getNodeDetails, mergeDetail]);

  const fuse = useMemo(
    () =>
      new Fuse(nodes, {
        keys: [
          { name: 'name', weight: 2 },
          { name: 'tags', weight: 0.8 },
          { name: 'category', weight: 0.5 },
        ],
        threshold: 0.42,
      }),
    [nodes]
  );

  const [query, setQuery] = useState('');

  const filteredList = useMemo(() => {
    const base = nodes.filter((n) =>
      nodePassesFilters(
        n.category,
        n.era,
        n.type,
        activeCategories,
        activeEras,
        activeTypes
      )
    );
    const q = query.trim();
    if (!q) {
      return [...base].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
    const ids = new Set(
      fuse.search(q).map((r) => r.item.id)
    );
    return base
      .filter((n) => ids.has(n.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [
    nodes,
    query,
    fuse,
    activeCategories,
    activeEras,
    activeTypes,
  ]);

  const onSelectListItem = useCallback(
    (id: string) => {
      router.replace(`/explore?node=${encodeURIComponent(id)}`);
      selectNode(id, { exploreMode: 'root' });
    },
    [router, selectNode]
  );

  const onBack = useCallback(() => {
    if (exploreStack.length <= 1) {
      router.replace('/explore');
      closeSidebar();
    } else {
      popExploreStack();
      const nextId = useUIStore.getState().selectedNodeId;
      if (nextId) {
        router.replace(`/explore?node=${encodeURIComponent(nextId)}`);
      }
    }
  }, [exploreStack.length, closeSidebar, popExploreStack, router]);

  if (showDetail && selectedNodeId) {
    const node = getNodeById(selectedNodeId);
    if (!node) {
      closeSidebar();
      return null;
    }
    const recipeLinks = getRecipeForNode(node.id);
    const usages = getUsagesOfNode(node.id);
    const categoryColor = getCategoryColor(node.category);

    return (
      <div
        className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col bg-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-explore-title"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-elevated px-3 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-accent hover:bg-border"
            aria-label="Retour"
          >
            <span aria-hidden className="text-lg">
              ←
            </span>
            Retour
          </button>
          {exploreStack.length > 1 ? (
            <span className="truncate text-xs text-muted-foreground">
              {exploreStack.length} niveaux
            </span>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4">
          <h1
            id="mobile-explore-title"
            className="text-xl font-semibold leading-tight text-foreground"
          >
            {node.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className="inline-block rounded px-2 py-0.5 text-xs font-medium capitalize"
              style={{
                backgroundColor: `${categoryColor}28`,
                color: categoryColor,
              }}
            >
              {String(node.category).replace(/_/g, ' ')}
            </span>
            <span className="rounded bg-surface px-2 py-0.5 text-xs text-muted-foreground">
              {ERA_LABELS[node.era] ?? node.era}
            </span>
            <span className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
              Prof. {node.complexity_depth}
            </span>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-foreground/90">
            {detailsById[node.id]?.description || '—'}
          </p>

          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Recette de fabrication
            </h2>
            {recipeLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun intrant enregistré.</p>
            ) : (
              <ul className="space-y-3">
                {recipeLinks.map((link) => (
                  <MobileRecipeRow
                    key={link.id}
                    link={link}
                    getNodeById={getNodeById}
                    onSelectIngredient={(id) => {
                      router.replace(`/explore?node=${encodeURIComponent(id)}`);
                      selectNode(id, { exploreMode: 'push' });
                    }}
                  />
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Utilisé dans
            </h2>
            {usages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune technologie en aval direct.
              </p>
            ) : (
              <ul className="space-y-2">
                {usages.map(({ link, product }) => (
                  <li key={link.id}>
                    <button
                      type="button"
                      onClick={() => {
                        router.replace(
                          `/explore?node=${encodeURIComponent(product.id)}`
                        );
                        selectNode(product.id, { exploreMode: 'push' });
                      }}
                      className="w-full rounded-md border border-transparent px-2 py-3 text-left text-sm font-medium text-accent active:bg-surface"
                    >
                      {product.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Infos
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="text-right text-foreground">
                  {NODE_TYPE_LABELS[node.type] ?? node.type}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Profondeur</dt>
                <dd className="text-right text-foreground">
                  {node.complexity_depth}
                </dd>
              </div>
              {formatYear(node.year_approx) ? (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Année approx.</dt>
                  <dd className="text-right text-foreground">
                    {formatYear(node.year_approx)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <div className="mt-8">
            <Link
              href={`/tree/${node.id}`}
              className="inline-flex w-full items-center justify-center rounded-lg border border-[#3B82F6]/40 bg-[#3B82F6]/10 px-3 py-3 text-sm font-medium text-accent"
            >
              Voir l’arbre complet
            </Link>
          </div>

          {detailsById[node.id]?.wikipedia_url ? (
            <div className="mt-4">
              <a
                href={detailsById[node.id]?.wikipedia_url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent underline-offset-2"
              >
                Wikipédia ↗
              </a>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-page">
      <div className="shrink-0 border-b border-border/80 px-4 py-3">
        <label className="sr-only" htmlFor="explore-mobile-search">
          Rechercher une technologie
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-3 py-2.5">
          <svg
            className="h-4 w-4 shrink-0 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            id="explore-mobile-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une technologie…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoComplete="off"
          />
        </div>
      </div>

      <ul
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-6 pt-2"
        role="listbox"
      >
        {filteredList.map((n) => {
          const c = getCategoryColor(n.category);
          return (
            <li key={n.id} className="mb-2">
              <button
                type="button"
                role="option"
                onClick={() => onSelectListItem(n.id)}
                className="flex w-full items-stretch gap-0 overflow-hidden rounded-xl border border-border bg-surface-elevated text-left transition-colors active:bg-[color:var(--panel-row-hover-bg)]"
              >
                <span
                  className="w-1.5 shrink-0"
                  style={{ backgroundColor: c }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 px-3 py-3">
                  <div className="font-medium text-foreground">{n.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span>{ERA_LABELS[n.era] ?? n.era}</span>
                    <span className="text-muted-foreground/70">·</span>
                    <span>Profondeur {n.complexity_depth}</span>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MobileRecipeRow({
  link,
  getNodeById,
  onSelectIngredient,
}: {
  link: CraftingLink;
  getNodeById: (id: string) => TechNodeBasic | undefined;
  onSelectIngredient: (id: string) => void;
}) {
  const input = getNodeById(link.source_id);
  const rel = link.relation_type as RelationType;
  const dotColor =
    rel === 'material' && input
      ? getCategoryColor(input.category as NodeCategory)
      : RELATION_DOT[rel];

  return (
    <li className="flex gap-3 rounded-lg border border-border/80 bg-surface/40 px-3 py-3">
      <span
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
        style={{ backgroundColor: dotColor, opacity: rel === 'catalyst' ? 0.6 : 1 }}
      />
      <div className="min-w-0 flex-1">
        {input ? (
          <button
            type="button"
            onClick={() => onSelectIngredient(input.id)}
            className="text-left text-sm font-semibold text-accent active:underline"
          >
            {input.name}
          </button>
        ) : (
          <span className="text-sm text-foreground">{link.source_id}</span>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {RELATION_LABELS[rel]}
          {link.quantity_hint ? ` · ${link.quantity_hint}` : ''}
          {link.is_optional ? ' · optionnel' : ''}
        </p>
        {link.notes ? (
          <p className="mt-1 text-xs italic text-muted-foreground/80">{link.notes}</p>
        ) : null}
      </div>
    </li>
  );
}

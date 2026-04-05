'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { SuggestNodeCorrectionPanel } from '@/components/ui/SuggestNodeCorrectionPanel';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  NODE_CATEGORY_ORDER,
  ERA_ORDER,
  DIMENSION_ORDER,
  MATERIAL_LEVEL_ORDER,
} from '@/lib/node-labels';
import {
  RelationType as RT,
  type CraftingLink,
  type NodeCategory,
  type RelationType,
  type SeedNode,
  type TechNodeBasic,
  type Era,
  type NodeDimension,
  type MaterialLevel,
} from '@/lib/types';
import { EDITOR_DIM_KEY, EDITOR_LEVEL_KEY } from './dimension-editor-keys';
import { SearchableSelect, type SearchableOption } from './SearchableSelect';
import { eraLabelFromMessages } from '@/lib/era-display';
import { filterValidCraftingLinks } from '@/lib/graph-utils';
import { rowIsDraft } from '@/lib/draft-flag';
import { seedNodeIsLocked } from '@/lib/node-lock';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { treeInventionPath, getDefaultTreeNodeId } from '@/lib/tree-routes';
import { EXPLORE_DETAIL_PANEL_WIDTH_PX } from '@/lib/explore-layout';
import { useGraphStore } from '@/stores/graph-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { AdminPageClient } from '@/components/admin/AdminPageClient';
import { AIToolsTab } from '@/components/admin/AIToolsTab';
import {
  DEFAULT_EDITOR_INVENTION_COLUMN_ORDER,
  EDITOR_INVENTION_COLUMN_STORAGE_KEY,
  loadEditorInventionColumnOrder,
  moveColumnInOrder,
  type EditorInventionColumnId,
} from '@/lib/editor-invention-column-order';
import {
  ColumnReorderHandle,
  renderEditorInventionColumnCell,
  renderEditorInventionColumnHeader,
  type NodeSortKey,
} from './EditorInventionColumnCells';
import {
  duplicateNodeIdsFromNodes,
  findDuplicatePeerNodeId,
} from '@/lib/editor-duplicates';

const RELATION_BADGE_COLORS: Record<RelationType, string> = {
  [RT.MATERIAL]: 'bg-teal-500/20 text-teal-200 border-teal-500/40',
  [RT.TOOL]: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
  [RT.ENERGY]: 'bg-red-500/20 text-red-200 border-red-500/40',
  [RT.KNOWLEDGE]: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
  [RT.CATALYST]: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
};

type Toast = { id: number; kind: 'ok' | 'err'; text: string };

type SortDir = 'asc' | 'desc';

type LinkSortKey =
  | 'source'
  | 'target'
  | 'relation'
  | 'optional'
  | 'notes';

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3000);
  }, []);
  return { toasts, push };
}

function seedNodeToTechBasic(n: SeedNode): TechNodeBasic {
  return {
    id: n.id,
    name: n.name,
    name_en: n.name_en,
    category: n.category as NodeCategory,
    era: n.era as Era,
    year_approx:
      n.year_approx === null || n.year_approx === undefined
        ? undefined
        : n.year_approx,
    complexity_depth: n.complexity_depth ?? 0,
    tags: n.tags ?? [],
    origin: n.origin,
    image_url: n.image_url,
    dimension: n.dimension ?? null,
    materialLevel: n.materialLevel ?? null,
    naturalOrigin: n.naturalOrigin ?? null,
    chemicalNature: n.chemicalNature ?? null,
    origin_type: n.origin_type ?? null,
    nature_type: n.nature_type ?? null,
    is_draft: n.is_draft === true,
    is_locked: n.is_locked === true,
  };
}

function linkCounts(
  nodeId: string,
  links: CraftingLink[]
): { in: number; out: number } {
  let inc = 0;
  let out = 0;
  for (const l of links) {
    if (l.target_id === nodeId) inc += 1;
    if (l.source_id === nodeId) out += 1;
  }
  return { in: inc, out: out };
}

/** Filtres liste (catégorie, époque, recherche…) — sans les bascules « isolé / brouillon / … ». */
function nodePassesEditorBaseFilters(
  n: SeedNode,
  qNode: string,
  catF: string,
  dimensionF: string,
  materialLevelF: string,
  eraF: string
): boolean {
  if (catF !== 'all' && n.category !== catF) return false;
  if (dimensionF !== 'all') {
    const nd = n.dimension ?? null;
    if (dimensionF === 'unset') {
      if (nd !== null && nd !== undefined) return false;
    } else if (nd !== dimensionF) return false;
  }
  if (materialLevelF !== 'all') {
    const nl = n.materialLevel ?? null;
    if (materialLevelF === 'unset') {
      if (nl !== null && nl !== undefined) return false;
    } else if (nl !== materialLevelF) return false;
  }
  if (eraF !== 'all' && n.era !== eraF) return false;
  const qt = qNode.trim().toLowerCase();
  if (!qt) return true;
  const blob = [
    n.name,
    n.name_en,
    n.description,
    n.description_en ?? '',
    n.category,
    n.origin ?? '',
  ]
    .join(' ')
    .toLowerCase();
  return blob.includes(qt);
}

function EditorToolbarFilterIconButton({
  tip,
  pressed,
  onToggle,
  activeClass,
  inactiveClass,
  badgeCount,
  children,
}: {
  tip: string;
  pressed: boolean;
  onToggle: () => void;
  activeClass: string;
  inactiveClass: string;
  /** Effectif (après catégorie / époque / recherche…) — affiché en badge. */
  badgeCount: number;
  children: ReactNode;
}) {
  const label = `${tip} (${badgeCount})`;
  return (
    <div className="relative inline-flex max-w-full">
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={label}
        title={label}
        onClick={onToggle}
        className={`peer relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors ${
          pressed ? activeClass : inactiveClass
        }`}
      >
        {children}
        <span
          aria-hidden
          className="pointer-events-none absolute -right-1 -top-1 z-[1] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-red-700/90 bg-red-600 px-1 text-[10px] font-bold tabular-nums leading-none text-white shadow-sm ring-1 ring-red-900/30 dark:border-red-500/80 dark:bg-red-600 dark:ring-red-950/50"
        >
          {badgeCount > 9999 ? '9999+' : badgeCount}
        </span>
      </button>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-2 w-max max-w-[min(20rem,calc(100vw-3rem))] -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-2.5 py-1.5 text-center text-[11px] leading-snug text-foreground shadow-lg opacity-0 shadow-black/15 invisible transition-opacity duration-150 peer-hover:opacity-100 peer-hover:visible peer-focus-visible:opacity-100 peer-focus-visible:visible dark:shadow-black/40"
      >
        {label}
      </span>
    </div>
  );
}

function EditorToolbarFilterTextButton({
  tip,
  pressed,
  onClick,
  activeClass,
  inactiveClass,
  children,
}: {
  tip: string;
  pressed: boolean;
  onClick: () => void;
  activeClass: string;
  inactiveClass: string;
  children: ReactNode;
}) {
  return (
    <div className="relative inline-flex max-w-full">
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={tip}
        onClick={onClick}
        className={`peer flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
          pressed ? activeClass : inactiveClass
        }`}
      >
        {children}
      </button>
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-full left-1/2 z-[60] mb-2 w-max max-w-[min(22rem,calc(100vw-3rem))] -translate-x-1/2 rounded-md border border-border bg-surface-elevated px-2.5 py-1.5 text-center text-[11px] leading-snug text-foreground shadow-lg opacity-0 shadow-black/15 invisible transition-opacity duration-150 peer-hover:opacity-100 peer-hover:visible peer-focus-visible:opacity-100 peer-focus-visible:visible dark:shadow-black/40"
      >
        {tip}
      </span>
    </div>
  );
}

/** Champ considéré vide pour le filtre « Incomplete » (hors year_approx). */
function isEmptyishField(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

/** Au moins un des champs requis manquant (aligné audit / fiches complètes). */
function nodeIsIncompleteForFilter(n: SeedNode): boolean {
  if (isEmptyishField(n.description_en)) return true;
  if (isEmptyishField(n.dimension)) return true;
  if (isEmptyishField(n.materialLevel)) return true;
  if (isEmptyishField(n.category)) return true;
  if (n.year_approx === null || n.year_approx === undefined) return true;
  return false;
}

export function EditorPageClient() {
  const locale = useLocale();
  const te = useTranslations('editor');
  const tRel = useTranslations('relationTypes');
  const tCat = useTranslations('categories');
  const tc = useTranslations('common');
  const tExplore = useTranslations('explore');

  const { isAdmin, isLoading: authLoading } = useAuthStore();
  const setAddCardModalOpen = useUIStore((s) => s.setAddCardModalOpen);
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedEditFromUrl = useRef(false);
  const openedNewFromUrl = useRef(false);

  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const hydrateFromRaw = useGraphStore((s) => s.hydrateFromRaw);
  const { toasts, push } = useToasts();

  /** Refs pour que `loadAll` reste stable (évite boucle useEffect si `te` change de référence à chaque rendu). */
  const teRef = useRef(te);
  teRef.current = te;
  const pushRef = useRef(push);
  pushRef.current = push;
  const hydrateFromRawRef = useRef(hydrateFromRaw);
  hydrateFromRawRef.current = hydrateFromRaw;
  const [tab, setTab] = useState<'nodes' | 'suggestions' | 'links' | 'aiTools'>(
    'nodes'
  );
  const [nodes, setNodes] = useState<SeedNode[]>([]);
  const [links, setLinks] = useState<CraftingLink[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [nr, lr] = await Promise.all([
        fetch('/api/nodes?full=1', {
          cache: 'no-store',
          credentials: 'same-origin',
        }),
        fetch('/api/links', { cache: 'no-store', credentials: 'same-origin' }),
      ]);
      if (!nr.ok || !lr.ok) {
        pushRef.current(teRef.current('toastLoadError'), 'err');
        return;
      }
      const nj = await nr.json();
      const lj = await lr.json();
      const rawNodes = (nj.nodes ?? []) as SeedNode[];
      const nextNodes = rawNodes.map((n) => ({
        ...n,
        is_draft: rowIsDraft(n as unknown as Record<string, unknown>),
      }));
      const nextLinks = lj.links ?? [];
      setNodes(nextNodes);
      setLinks(nextLinks);
      hydrateFromRawRef.current(nextNodes, nextLinks);
    } catch {
      pushRef.current(teRef.current('toastLoadError'), 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  const inventionTotalFormatted = useMemo(
    () => new Intl.NumberFormat(locale).format(nodes.length),
    [locale, nodes.length]
  );

  const [pendingSuggestionsCount, setPendingSuggestionsCount] =
    useState<number>(0);

  const refreshSuggestionStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const j = (await res.json().catch(() => ({}))) as { pending?: number };
      if (!res.ok) {
        setPendingSuggestionsCount(0);
        return;
      }
      setPendingSuggestionsCount(
        typeof j.pending === 'number' ? j.pending : 0
      );
    } catch {
      setPendingSuggestionsCount(0);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin || authLoading) return;
    void refreshSuggestionStats();
  }, [isAdmin, authLoading, refreshSuggestionStats]);

  useEffect(() => {
    if (tab === 'suggestions') {
      void refreshSuggestionStats();
    }
  }, [tab, refreshSuggestionStats]);

  useEffect(() => {
    const onRefresh = () => {
      void loadAll();
      void refreshSuggestionStats();
    };
    window.addEventListener('craftree:editor-refresh', onRefresh);
    return () =>
      window.removeEventListener('craftree:editor-refresh', onRefresh);
  }, [loadAll, refreshSuggestionStats]);

  const [columnOrder, setColumnOrder] = useState<EditorInventionColumnId[]>(
    DEFAULT_EDITOR_INVENTION_COLUMN_ORDER
  );
  const columnOrderPersistReady = useRef(false);
  useEffect(() => {
    setColumnOrder(loadEditorInventionColumnOrder());
  }, []);
  useEffect(() => {
    if (!columnOrderPersistReady.current) {
      columnOrderPersistReady.current = true;
      return;
    }
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      EDITOR_INVENTION_COLUMN_STORAGE_KEY,
      JSON.stringify(columnOrder)
    );
  }, [columnOrder]);

  const stickyActionsColumn =
    columnOrder[columnOrder.length - 1] === 'actions';
  const stickySelectColumn = columnOrder[0] === 'select';

  const [draggingColumnId, setDraggingColumnId] =
    useState<EditorInventionColumnId | null>(null);
  const [dragOverColumnId, setDragOverColumnId] =
    useState<EditorInventionColumnId | null>(null);

  const onColumnDragStart = useCallback((id: EditorInventionColumnId) => {
    setDraggingColumnId(id);
  }, []);
  const onColumnDragEnd = useCallback(() => {
    setDraggingColumnId(null);
    setDragOverColumnId(null);
  }, []);

  const onColumnDragOver = useCallback(
    (e: DragEvent, id: EditorInventionColumnId) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverColumnId(id);
    },
    []
  );

  const onColumnDrop = useCallback(
    (e: DragEvent, targetId: EditorInventionColumnId) => {
      e.preventDefault();
      const from = e.dataTransfer.getData(
        'text/plain'
      ) as EditorInventionColumnId;
      if (!from || from === targetId) {
        setDragOverColumnId(null);
        setDraggingColumnId(null);
        return;
      }
      setColumnOrder((o) => moveColumnInOrder(o, from, targetId));
      setDragOverColumnId(null);
      setDraggingColumnId(null);
    },
    []
  );

  const onColumnDragEnter = useCallback((id: EditorInventionColumnId) => {
    setDragOverColumnId(id);
  }, []);

  const onColumnDragLeave = useCallback((e: DragEvent) => {
    if (e.currentTarget === e.target) {
      setDragOverColumnId(null);
    }
  }, []);

  /** IDs des fiches dont le nom (ou le nom EN) est en double par rapport à une autre fiche. */
  const duplicateNodeIds = useMemo(
    () => duplicateNodeIdsFromNodes(nodes),
    [nodes]
  );

  /** Même pipeline que le graphe /explore (store) : liens dont les deux extrémités existent. */
  const graphModelEdges = useMemo(() => {
    if (nodes.length === 0) return [];
    const forGraph = nodes.map((n) => ({ id: n.id }));
    return filterValidCraftingLinks(forGraph, links);
  }, [nodes, links]);

  const nodeOptions: SearchableOption[] = useMemo(
    () =>
      [...nodes]
        .sort((a, b) =>
          pickNodeDisplayName(locale, a.name, a.name_en).localeCompare(
            pickNodeDisplayName(locale, b.name, b.name_en),
            locale,
            { sensitivity: 'base' }
          )
        )
        .map((n) => ({
          value: n.id,
          label: pickNodeDisplayName(locale, n.name, n.name_en),
          category: n.category as NodeCategory,
        })),
    [nodes, locale]
  );

  // ——— Inventions ———
  const [qNode, setQNode] = useState('');
  const [catF, setCatF] = useState<string>('all');
  const [eraF, setEraF] = useState<string>('all');
  const [dimensionF, setDimensionF] = useState<string>('all');
  const [materialLevelF, setMaterialLevelF] = useState<string>('all');
  /** Nœuds sans aucun lien entrant ni sortant. */
  const [isolatedOnly, setIsolatedOnly] = useState(false);
  /** Admin : n’afficher que les fiches marquées brouillon. */
  const [draftsOnly, setDraftsOnly] = useState(false);
  /** Fiches dont le nom ou le nom (EN) est en double. */
  const [duplicatesOnly, setDuplicatesOnly] = useState(
    () => searchParams.get('duplicates') === '1'
  );
  /** image_url vide / absent. */
  const [noImageOnly, setNoImageOnly] = useState(false);
  /** description_en vide / absente. */
  const [noDescriptionOnly, setNoDescriptionOnly] = useState(false);
  /** Au moins un champ clé manquant (voir nodeIsIncompleteForFilter). */
  const [incompleteOnly, setIncompleteOnly] = useState(false);
  /** Au moins un lien entrant (built_upon) et aucun sortant (led_to). */
  const [deadEndsOnly, setDeadEndsOnly] = useState(false);
  const [sortKey, setSortKey] = useState<NodeSortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const duplicatePeerById = useMemo(() => {
    if (!duplicatesOnly) return null;
    const m = new Map<string, string>();
    for (const n of nodes) {
      const peer = findDuplicatePeerNodeId(nodes, n.id);
      if (peer) m.set(n.id, peer);
    }
    return m;
  }, [nodes, duplicatesOnly]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Comparaison doublons : deux ids triés [a, b] pour panneaux jumeaux. */
  const [comparePairIds, setComparePairIds] = useState<
    [string, string] | null
  >(null);
  const [compareDataEpoch, setCompareDataEpoch] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set()
  );
  const [toggleLockBusyId, setToggleLockBusyId] = useState<string | null>(
    null
  );

  const editNodeForPanel = useMemo(
    () => (editingId ? nodes.find((x) => x.id === editingId) : undefined),
    [nodes, editingId]
  );

  const compareNodeLeft = useMemo(() => {
    if (!comparePairIds) return undefined;
    return nodes.find((x) => x.id === comparePairIds[0]);
  }, [nodes, comparePairIds]);

  const compareNodeRight = useMemo(() => {
    if (!comparePairIds) return undefined;
    return nodes.find((x) => x.id === comparePairIds[1]);
  }, [nodes, comparePairIds]);

  const compareUpstreamLeft = useMemo(() => {
    if (!compareNodeLeft) return 0;
    return graphModelEdges.filter((l) => l.target_id === compareNodeLeft.id)
      .length;
  }, [compareNodeLeft, graphModelEdges]);

  const compareUpstreamRight = useMemo(() => {
    if (!compareNodeRight) return 0;
    return graphModelEdges.filter((l) => l.target_id === compareNodeRight.id)
      .length;
  }, [compareNodeRight, graphModelEdges]);

  const editPanelUpstreamCount = useMemo(() => {
    if (!editNodeForPanel) return 0;
    return graphModelEdges.filter((l) => l.target_id === editNodeForPanel.id)
      .length;
  }, [editNodeForPanel, graphModelEdges]);

  const [deleteTarget, setDeleteTarget] = useState<SeedNode | null>(null);
  const [draftPublishingId, setDraftPublishingId] = useState<string | null>(
    null
  );

  const publishDraftFromRow = useCallback(
    async (n: SeedNode) => {
      if (!rowIsDraft(n as unknown as Record<string, unknown>)) return;
      setDraftPublishingId(n.id);
      try {
        const res = await fetch(`/api/nodes/${encodeURIComponent(n.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ is_draft: false }),
        });
        if (!res.ok) {
          let msg = te('toastSaveError');
          try {
            const errBody = (await res.json()) as { message?: string };
            if (errBody.message) msg = errBody.message;
          } catch {
            /* ignore */
          }
          push(msg, 'err');
          return;
        }
        const json = (await res.json()) as { node?: Record<string, unknown> };
        setNodes((prev) => {
          const next = prev.map((x) =>
            x.id === n.id
              ? {
                  ...x,
                  is_draft: json.node ? rowIsDraft(json.node) : false,
                }
              : x
          );
          hydrateFromRaw(next, links);
          return next;
        });
        push(te('toastNodeUpdated'), 'ok');
      } catch {
        push(te('toastNetworkError'), 'err');
      } finally {
        setDraftPublishingId(null);
      }
    },
    [te, push, hydrateFromRaw, links]
  );

  const filterBadgeCounts = useMemo(() => {
    let isolated = 0;
    let drafts = 0;
    let duplicates = 0;
    let noImage = 0;
    let noDescription = 0;
    let incomplete = 0;
    let deadEnds = 0;
    for (const n of nodes) {
      if (
        !nodePassesEditorBaseFilters(
          n,
          qNode,
          catF,
          dimensionF,
          materialLevelF,
          eraF
        )
      ) {
        continue;
      }
      const lc = linkCounts(n.id, graphModelEdges);
      if (lc.in === 0 && lc.out === 0) isolated += 1;
      if (rowIsDraft(n as unknown as Record<string, unknown>)) drafts += 1;
      if (duplicateNodeIds.has(n.id)) duplicates += 1;
      if ((n.image_url?.trim() ?? '') === '') noImage += 1;
      if ((n.description_en?.trim() ?? '') === '') noDescription += 1;
      if (nodeIsIncompleteForFilter(n)) incomplete += 1;
      if (lc.in > 0 && lc.out === 0) deadEnds += 1;
    }
    return {
      isolated,
      drafts,
      duplicates,
      noImage,
      noDescription,
      incomplete,
      deadEnds,
    };
  }, [
    nodes,
    qNode,
    catF,
    dimensionF,
    materialLevelF,
    eraF,
    graphModelEdges,
    duplicateNodeIds,
  ]);

  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (
        !nodePassesEditorBaseFilters(
          n,
          qNode,
          catF,
          dimensionF,
          materialLevelF,
          eraF
        )
      ) {
        return false;
      }
      if (draftsOnly && !rowIsDraft(n as unknown as Record<string, unknown>))
        return false;
      if (isolatedOnly) {
        const lc = linkCounts(n.id, graphModelEdges);
        if (lc.in !== 0 || lc.out !== 0) return false;
      }
      if (duplicatesOnly && !duplicateNodeIds.has(n.id)) return false;
      if (noImageOnly && (n.image_url?.trim() ?? '') !== '') return false;
      if (noDescriptionOnly && (n.description_en?.trim() ?? '') !== '')
        return false;
      if (incompleteOnly && !nodeIsIncompleteForFilter(n)) return false;
      if (deadEndsOnly) {
        const lc = linkCounts(n.id, graphModelEdges);
        if (!(lc.in > 0 && lc.out === 0)) return false;
      }
      return true;
    });
  }, [
    nodes,
    qNode,
    catF,
    dimensionF,
    materialLevelF,
    eraF,
    isolatedOnly,
    draftsOnly,
    duplicatesOnly,
    duplicateNodeIds,
    noImageOnly,
    noDescriptionOnly,
    incompleteOnly,
    deadEndsOnly,
    graphModelEdges,
  ]);

  const sortedNodes = useMemo(() => {
    const arr = [...filteredNodes];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = pickNodeDisplayName(locale, a.name, a.name_en).localeCompare(
            pickNodeDisplayName(locale, b.name, b.name_en),
            locale,
            { sensitivity: 'base' }
          );
          break;
        case 'category':
          cmp = a.category.localeCompare(b.category);
          break;
        case 'dimension':
          cmp = (a.dimension ?? '').localeCompare(b.dimension ?? '');
          break;
        case 'materialLevel':
          cmp = (a.materialLevel ?? '').localeCompare(b.materialLevel ?? '');
          break;
        case 'era':
          cmp = a.era.localeCompare(b.era);
          break;
        case 'year_approx':
          cmp = (a.year_approx ?? 0) - (b.year_approx ?? 0);
          break;
        case 'origin':
          cmp = (a.origin ?? '').localeCompare(b.origin ?? '', 'fr');
          break;
        case 'links': {
          const ca = linkCounts(a.id, graphModelEdges);
          const cb = linkCounts(b.id, graphModelEdges);
          cmp = ca.in + ca.out - (cb.in + cb.out);
          break;
        }
        case 'upstream_in': {
          const ia = linkCounts(a.id, graphModelEdges).in;
          const ib = linkCounts(b.id, graphModelEdges).in;
          cmp = ia - ib;
          break;
        }
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return arr;
  }, [filteredNodes, sortKey, sortDir, graphModelEdges, locale]);

  const visibleRowIds = useMemo(
    () => sortedNodes.map((n) => n.id),
    [sortedNodes]
  );

  const selectColumnHeaderState = useMemo(() => {
    const c = visibleRowIds.filter((id) => selectedIds.has(id)).length;
    return {
      allVisibleSelected:
        visibleRowIds.length > 0 && c === visibleRowIds.length,
      someVisibleSelected: c > 0 && c < visibleRowIds.length,
    };
  }, [visibleRowIds, selectedIds]);

  useEffect(() => {
    setSelectedIds((prev) => {
      const idSet = new Set(nodes.map((n) => n.id));
      const next = new Set<string>();
      let changed = false;
      for (const id of prev) {
        if (idSet.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [nodes]);

  const toggleRowSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      if (visibleRowIds.length === 0) return prev;
      const allSelected = visibleRowIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        for (const id of visibleRowIds) next.delete(id);
      } else {
        for (const id of visibleRowIds) next.add(id);
      }
      return next;
    });
  }, [visibleRowIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleNodeLock = useCallback(
    async (n: SeedNode) => {
      setToggleLockBusyId(n.id);
      try {
        const res = await fetch(
          `/api/nodes/${encodeURIComponent(n.id)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ is_locked: !n.is_locked }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          push(
            String((err as { error?: string }).error ?? te('toastError')),
            'err'
          );
          return;
        }
        push(
          n.is_locked ? te('toastNodeUnlocked') : te('toastNodeLocked'),
          'ok'
        );
        await loadAll();
      } catch {
        push(te('toastNetworkError'), 'err');
      } finally {
        setToggleLockBusyId(null);
      }
    },
    [loadAll, push, te]
  );

  const toggleSort = (k: NodeSortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const openNew = () => {
    setAddCardModalOpen(true);
  };

  const openEdit = (n: SeedNode) => {
    setComparePairIds(null);
    setEditingId(n.id);
    setPanelOpen(true);
  };

  const openCompareDuplicates = useCallback(
    (n: SeedNode) => {
      const peer = findDuplicatePeerNodeId(nodes, n.id);
      if (!peer) return;
      const peerNode = nodes.find((x) => x.id === peer);
      if (!peerNode) return;
      if (seedNodeIsLocked(n) || seedNodeIsLocked(peerNode)) {
        push(te('toastCompareLocked'), 'err');
        return;
      }
      const a = n.id < peer ? n.id : peer;
      const b = n.id < peer ? peer : n.id;
      setComparePairIds([a, b]);
      setPanelOpen(false);
      setEditingId(null);
    },
    [nodes, push, te]
  );

  const closeDuplicateCompare = useCallback(() => {
    setComparePairIds(null);
  }, []);

  useEffect(() => {
    if (searchParams.get('new') !== '1') {
      openedNewFromUrl.current = false;
    }
  }, [searchParams]);

  useEffect(() => {
    if (loading || openedEditFromUrl.current) return;
    const raw = searchParams.get('edit');
    if (!raw) return;
    const n = nodes.find((x) => x.id === raw);
    if (!n) return;
    openedEditFromUrl.current = true;
    setComparePairIds(null);
    setEditingId(n.id);
    setPanelOpen(true);
    router.replace('/admin', { scroll: false });
  }, [loading, nodes, searchParams, router]);

  useEffect(() => {
    if (loading || openedNewFromUrl.current) return;
    if (searchParams.get('new') !== '1') return;
    if (searchParams.get('edit')) return;
    openedNewFromUrl.current = true;
    setAddCardModalOpen(true);
    router.replace('/admin', { scroll: false });
  }, [loading, searchParams, router, setAddCardModalOpen]);

  useEffect(() => {
    if (searchParams.get('duplicates') === '1') setDuplicatesOnly(true);
  }, [searchParams]);

  useEffect(() => {
    if (!duplicatesOnly) setComparePairIds(null);
  }, [duplicatesOnly]);

  useEffect(() => {
    if (!comparePairIds) return;
    const [a, b] = comparePairIds;
    if (!nodes.some((x) => x.id === a) || !nodes.some((x) => x.id === b)) {
      setComparePairIds(null);
    }
  }, [comparePairIds, nodes]);

  const adminTableFocusHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!searchParams.get('focus')) adminTableFocusHandledRef.current = null;
  }, [searchParams]);

  useEffect(() => {
    if (loading || tab !== 'nodes') return;
    const raw = searchParams.get('focus');
    if (!raw) return;
    if (adminTableFocusHandledRef.current === raw) return;
    if (!sortedNodes.some((n) => n.id === raw)) return;
    adminTableFocusHandledRef.current = raw;
    requestAnimationFrame(() => {
      document
        .getElementById(`editor-invention-row-${raw}`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      const next = new URLSearchParams(searchParams.toString());
      next.delete('focus');
      const qs = next.toString();
      router.replace(qs ? `/admin?${qs}` : '/admin', { scroll: false });
    });
  }, [loading, tab, searchParams, sortedNodes, router]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        push(te('toastDeleteFailed'), 'err');
        return;
      }
      push(te('toastNodeDeleted'));
      setDeleteTarget(null);
      await loadAll();
    } catch {
      push(te('toastNetworkError'), 'err');
    }
  };

  const deleteNodeFromCompare = useCallback(
    async (n: SeedNode) => {
      const cnt = links.filter(
        (l) => l.source_id === n.id || l.target_id === n.id
      ).length;
      if (
        !window.confirm(
          te('deleteConfirmRich', {
            name: pickNodeDisplayName(locale, n.name, n.name_en),
            count: cnt,
          })
        )
      ) {
        return;
      }
      try {
        const res = await fetch(`/api/nodes/${encodeURIComponent(n.id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          push(te('toastDeleteFailed'), 'err');
          return;
        }
        push(te('toastNodeDeleted'));
        await loadAll();
        setCompareDataEpoch((e) => e + 1);
      } catch {
        push(te('toastNetworkError'), 'err');
      }
    },
    [links, te, locale, push, loadAll]
  );

  // ——— Links ———
  const sourceRef = useRef<HTMLInputElement>(null);
  const [quickSource, setQuickSource] = useState('');
  const [quickTarget, setQuickTarget] = useState('');
  const [quickRel, setQuickRel] = useState<RelationType>(RT.MATERIAL);

  const [linkQ, setLinkQ] = useState('');
  const [relFilter, setRelFilter] = useState<string>('all');
  const [srcFilter, setSrcFilter] = useState('');
  const [tgtFilter, setTgtFilter] = useState('');
  const [linkSortKey, setLinkSortKey] = useState<LinkSortKey>('source');
  const [linkSortDir, setLinkSortDir] = useState<SortDir>('asc');

  const [linkPanel, setLinkPanel] = useState<CraftingLink | null>(null);
  const [linkForm, setLinkForm] = useState({
    relation_type: RT.MATERIAL as RelationType,
    is_optional: false,
    notes: '',
  });

  const filteredLinks = useMemo(() => {
    const sf = srcFilter.trim().toLowerCase();
    const tf = tgtFilter.trim().toLowerCase();
    const lq = linkQ.trim().toLowerCase();
    const nameBlob = (n: SeedNode | undefined) =>
      n
        ? `${n.name} ${n.name_en ?? ''}`.toLowerCase()
        : '';
    return links.filter((l) => {
      if (relFilter !== 'all' && l.relation_type !== relFilter) return false;
      const s = nodeById.get(l.source_id);
      const t = nodeById.get(l.target_id);
      if (sf && !nameBlob(s).includes(sf)) return false;
      if (tf && !nameBlob(t).includes(tf)) return false;
      if (lq) {
        const blob = `${nameBlob(s)} ${nameBlob(t)} ${l.notes ?? ''}`.toLowerCase();
        if (!blob.includes(lq)) return false;
      }
      return true;
    });
  }, [links, relFilter, srcFilter, tgtFilter, linkQ, nodeById]);

  const sortedLinks = useMemo(() => {
    const arr = [...filteredLinks];
    const dir = linkSortDir === 'asc' ? 1 : -1;
    const dn = (id: string) => {
      const n = nodeById.get(id);
      return n
        ? pickNodeDisplayName(locale, n.name, n.name_en)
        : '';
    };
    arr.sort((a, b) => {
      const sa = dn(a.source_id);
      const sb = dn(b.source_id);
      const ta = dn(a.target_id);
      const tb = dn(b.target_id);
      let cmp = 0;
      switch (linkSortKey) {
        case 'source':
          cmp = sa.localeCompare(sb, locale, { sensitivity: 'base' });
          break;
        case 'target':
          cmp = ta.localeCompare(tb, locale, { sensitivity: 'base' });
          break;
        case 'relation':
          cmp = a.relation_type.localeCompare(b.relation_type);
          break;
        case 'optional':
          cmp = Number(a.is_optional) - Number(b.is_optional);
          break;
        case 'notes':
          cmp = (a.notes ?? '').localeCompare(b.notes ?? '', 'fr');
          break;
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return arr;
  }, [filteredLinks, linkSortKey, linkSortDir, nodeById, locale]);

  const toggleLinkSort = (k: LinkSortKey) => {
    if (linkSortKey === k) setLinkSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setLinkSortKey(k);
      setLinkSortDir('asc');
    }
  };

  const addQuickLink = async () => {
    if (!quickSource || !quickTarget || quickSource === quickTarget) {
      push(te('toastInvalidSourceTarget'), 'err');
      return;
    }
    try {
      const res = await fetch('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: quickSource,
          target_id: quickTarget,
          relation_type: quickRel,
        }),
      });
      if (res.status === 409) {
        push(te('toastLinkExists'), 'err');
        return;
      }
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        push((e as { error?: string }).error ?? te('toastError'), 'err');
        return;
      }
      push(te('toastLinkAdded'));
      setQuickTarget('');
      setQuickSource('');
      setQuickRel(RT.MATERIAL);
      await loadAll();
      sourceRef.current?.focus();
    } catch {
      push(te('toastNetworkError'), 'err');
    }
  };

  const saveLinkEdit = async () => {
    if (!linkPanel) return;
    try {
      const res = await fetch(
        `/api/links/${encodeURIComponent(linkPanel.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            relation_type: linkForm.relation_type,
            is_optional: linkForm.is_optional,
            notes: linkForm.notes.trim() || undefined,
          }),
        }
      );
      if (!res.ok) {
        push(te('toastSaveError'), 'err');
        return;
      }
        push(te('toastLinkUpdated'));
      setLinkPanel(null);
      await loadAll();
    } catch {
      push(te('toastNetworkError'), 'err');
    }
  };

  const deleteLink = async (l: CraftingLink) => {
    try {
      const res = await fetch(`/api/links/${encodeURIComponent(l.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        push(te('toastDeleteFailed'), 'err');
        return;
      }
      push(te('toastLinkDeleted'));
      setLinkPanel(null);
      await loadAll();
    } catch {
      push(te('toastNetworkError'), 'err');
    }
  };

  const deleteLinkCount = deleteTarget
    ? links.filter(
        (l) => l.source_id === deleteTarget.id || l.target_id === deleteTarget.id
      ).length
    : 0;

  if (!authLoading && !isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 bg-page px-6 pt-14 text-center text-foreground">
        <p className="max-w-md text-sm">{te('adminOnly')}</p>
        <Link
          href={treeInventionPath(getDefaultTreeNodeId())}
          className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm transition-colors hover:bg-border"
        >
          {te('backToExplore')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-page pt-14 text-foreground">
      <header className="sticky top-14 z-40 shrink-0 border-b border-border bg-page px-6 py-4">
        <h1 className="text-lg font-semibold md:text-xl">
          {te('pageAdminTitle')}
        </h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className="mb-4 flex flex-wrap gap-6 border-b border-border">
          <button
            type="button"
            onClick={() => setTab('nodes')}
            className={`relative border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === 'nodes'
                ? 'border-[#3B82F6] text-white'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {te('tabAllInventions', { count: inventionTotalFormatted })}
          </button>
          <button
            type="button"
            onClick={() => setTab('suggestions')}
            className={`relative border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === 'suggestions'
                ? 'border-[#3B82F6] text-white'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {te('tabSuggestionsWithCount', {
              count: new Intl.NumberFormat(locale).format(
                pendingSuggestionsCount
              ),
            })}
          </button>
          <button
            type="button"
            onClick={() => setTab('links')}
            className={`relative border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === 'links'
                ? 'border-[#3B82F6] text-white'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {te('links')}
          </button>
          <button
            type="button"
            onClick={() => setTab('aiTools')}
            className={`relative border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === 'aiTools'
                ? 'border-[#3B82F6] text-white'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {te('tabAiTools')}
          </button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">{te('loading')}</p>
        ) : tab === 'suggestions' ? (
          <div className="flex min-h-0 min-h-[50vh] flex-1 flex-col overflow-hidden">
            <AdminPageClient embedded />
          </div>
        ) : tab === 'aiTools' ? (
          <AIToolsTab onToast={push} />
        ) : tab === 'nodes' ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openNew}
                className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563eb]"
              >
                {te('newInventionButton')}
              </button>
              <input
                type="search"
                value={qNode}
                onChange={(e) => setQNode(e.target.value)}
                placeholder={te('searchPlaceholderNodes')}
                className="min-w-[200px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent"
              />
              <select
                value={catF}
                onChange={(e) => setCatF(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                <option value="all">{te('allCategories')}</option>
                {NODE_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {tCat(c)}
                  </option>
                ))}
              </select>
              <select
                value={eraF}
                onChange={(e) => setEraF(e.target.value)}
                title={
                  eraF !== 'all' ? eraLabelFromMessages(locale, eraF as Era) : undefined
                }
                className="min-w-[min(100%,14rem)] shrink-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent sm:min-w-[18rem]"
              >
                <option value="all">{te('allEras')}</option>
                {ERA_ORDER.map((e) => (
                  <option key={e} value={e}>
                    {eraLabelFromMessages(locale, e)}
                  </option>
                ))}
              </select>
              <select
                value={dimensionF}
                onChange={(e) => setDimensionF(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                <option value="all">{te('allDimensions')}</option>
                <option value="unset">{te('notSet')}</option>
                {DIMENSION_ORDER.map((d) => (
                  <option key={d} value={d}>
                    {te(EDITOR_DIM_KEY[d])}
                  </option>
                ))}
              </select>
              <select
                value={materialLevelF}
                onChange={(e) => setMaterialLevelF(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
              >
                <option value="all">{te('allLevels')}</option>
                <option value="unset">{te('notSet')}</option>
                {MATERIAL_LEVEL_ORDER.map((lv) => (
                  <option key={lv} value={lv}>
                    {te(EDITOR_LEVEL_KEY[lv])}
                  </option>
                ))}
              </select>
              <EditorToolbarFilterIconButton
                tip={te('isolatedOnlyTitle')}
                pressed={isolatedOnly}
                onToggle={() => setIsolatedOnly((v) => !v)}
                activeClass="border-[#F87171] bg-[#7f1d1d]/35 text-[#fecaca] hover:bg-[#7f1d1d]/50"
                inactiveClass="border-border bg-surface-elevated text-foreground hover:bg-border"
                badgeCount={filterBadgeCounts.isolated}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  <line x1="4" y1="4" x2="20" y2="20" />
                </svg>
              </EditorToolbarFilterIconButton>
              <EditorToolbarFilterIconButton
                tip={te('draftsOnlyTitle')}
                pressed={draftsOnly}
                onToggle={() => setDraftsOnly((v) => !v)}
                activeClass="border-orange-500/80 bg-orange-950/40 text-orange-200 hover:bg-orange-950/60"
                inactiveClass="border-border bg-surface-elevated text-foreground hover:bg-border"
                badgeCount={filterBadgeCounts.drafts}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <path d="M10 13h4" />
                  <path d="M12 11v4" />
                </svg>
              </EditorToolbarFilterIconButton>
              <EditorToolbarFilterIconButton
                tip={te('duplicatesOnlyTitle')}
                pressed={duplicatesOnly}
                onToggle={() => setDuplicatesOnly((v) => !v)}
                activeClass="border-amber-500/80 bg-amber-950/45 text-amber-100 hover:bg-amber-950/65"
                inactiveClass="border-border bg-surface-elevated text-foreground hover:bg-border"
                badgeCount={filterBadgeCounts.duplicates}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <rect x="4" y="4" width="12" height="12" rx="2" />
                </svg>
              </EditorToolbarFilterIconButton>
              <EditorToolbarFilterIconButton
                tip={te('filterNoImageTitle')}
                pressed={noImageOnly}
                onToggle={() => setNoImageOnly((v) => !v)}
                activeClass="border-sky-500/80 bg-sky-950/40 text-sky-100 hover:bg-sky-950/60"
                inactiveClass="border-border bg-surface-elevated text-foreground hover:bg-border"
                badgeCount={filterBadgeCounts.noImage}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="9" cy="11" r="2" />
                  <path d="m3 19 6-6M14 8l7-7M21 3l-4 4" />
                </svg>
              </EditorToolbarFilterIconButton>
              <EditorToolbarFilterIconButton
                tip={te('filterNoDescriptionTitle')}
                pressed={noDescriptionOnly}
                onToggle={() => setNoDescriptionOnly((v) => !v)}
                activeClass="border-violet-500/80 bg-violet-950/40 text-violet-100 hover:bg-violet-950/60"
                inactiveClass="border-border bg-surface-elevated text-foreground hover:bg-border"
                badgeCount={filterBadgeCounts.noDescription}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="4" y1="22" x2="22" y2="4" />
                </svg>
              </EditorToolbarFilterIconButton>
              <EditorToolbarFilterIconButton
                tip={te('filterIncompleteTitle')}
                pressed={incompleteOnly}
                onToggle={() => setIncompleteOnly((v) => !v)}
                activeClass="border-rose-500/80 bg-rose-950/40 text-rose-100 hover:bg-rose-950/60"
                inactiveClass="border-border bg-surface-elevated text-foreground hover:bg-border"
                badgeCount={filterBadgeCounts.incomplete}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </EditorToolbarFilterIconButton>
              <EditorToolbarFilterIconButton
                tip={te('filterDeadEndsTitle')}
                pressed={deadEndsOnly}
                onToggle={() => setDeadEndsOnly((v) => !v)}
                activeClass="border-emerald-500/80 bg-emerald-950/35 text-emerald-100 hover:bg-emerald-950/55"
                inactiveClass="border-border bg-surface-elevated text-foreground hover:bg-border"
                badgeCount={filterBadgeCounts.deadEnds}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="12" cy="5" r="2" />
                  <path d="M12 7v4" />
                  <path d="M8 21h8" />
                  <path d="M12 11v6l-3 4M12 17l3 4" />
                </svg>
              </EditorToolbarFilterIconButton>
              <EditorToolbarFilterTextButton
                tip={te('sortByDepthTitle')}
                pressed={sortKey === 'upstream_in'}
                onClick={() => {
                  if (sortKey === 'upstream_in') {
                    setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                  } else {
                    setSortKey('upstream_in');
                    setSortDir('asc');
                  }
                }}
                activeClass="border-cyan-500/80 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-950/60"
                inactiveClass="border-border bg-surface-elevated text-foreground hover:bg-border"
              >
                <span>{te('sortByDepthLabel')}</span>
                <span aria-hidden className="font-mono tabular-nums">
                  {sortKey === 'upstream_in'
                    ? sortDir === 'asc'
                      ? '↑'
                      : '↓'
                    : '↑'}
                </span>
              </EditorToolbarFilterTextButton>
            </div>

            {selectedIds.size > 0 ? (
              <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {te('selectedCount', { count: selectedIds.size })}
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-border/40"
                >
                  {te('clearSelection')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      [...selectedIds].join('\n')
                    );
                    push(te('toastIdsCopied'), 'ok');
                  }}
                  className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-border/40"
                >
                  {te('copySelectedIds')}
                </button>
              </div>
            ) : null}

            <div className="editor-scrollbar min-h-0 flex-1 overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[1520px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-elevated text-start text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    {columnOrder.map((columnId) => (
                      <Fragment key={columnId}>
                        {renderEditorInventionColumnHeader({
                          columnId,
                          te,
                          sortKey,
                          sortDir,
                          toggleSort,
                          dragHandle: (
                            <ColumnReorderHandle
                              columnId={columnId}
                              title={te('columnReorderHint')}
                              onDragStart={onColumnDragStart}
                              onDragEnd={onColumnDragEnd}
                            />
                          ),
                          dragOverColumnId,
                          draggingColumnId,
                          drag: {
                            onDragOver: onColumnDragOver,
                            onDrop: onColumnDrop,
                            onDragEnter: onColumnDragEnter,
                            onDragLeave: onColumnDragLeave,
                          },
                          stickyActionsColumn,
                          stickySelectColumn,
                          selectColumnHeader: {
                            allVisibleSelected:
                              selectColumnHeaderState.allVisibleSelected,
                            someVisibleSelected:
                              selectColumnHeaderState.someVisibleSelected,
                            onToggleAllVisible: toggleSelectAllVisible,
                          },
                        })}
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedNodes.map((n, i) => {
                    const bg = i % 2 === 0 ? 'bg-surface' : 'bg-[#0F1420]';
                    return (
                      <tr
                        id={`editor-invention-row-${n.id}`}
                        key={n.id}
                        className={`border-t border-border ${bg}`}
                      >
                        {columnOrder.map((columnId) =>
                          renderEditorInventionColumnCell({
                            columnId,
                            n,
                            graphModelEdges,
                            imageBustByNodeId,
                            locale,
                            te,
                            tCat,
                            tExplore,
                            tc,
                            openEdit,
                            publishDraftFromRow,
                            setDeleteTarget,
                            draftPublishingId,
                            stickyActionsColumn,
                            rowStripeClass: bg,
                            duplicatePeerId:
                              duplicatePeerById?.get(n.id) ?? null,
                            onCompareDuplicates: duplicatesOnly
                              ? openCompareDuplicates
                              : undefined,
                            selectedIds,
                            onToggleRowSelect: toggleRowSelect,
                            stickySelectColumn,
                            onToggleNodeLock: toggleNodeLock,
                            toggleLockBusyId,
                            onAiReviewToast: (message, kind) =>
                              push(message, kind),
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface/50 p-4">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">
                  {te('sourceNode')}
                </label>
                <SearchableSelect
                  options={nodeOptions}
                  value={quickSource}
                  onChange={setQuickSource}
                  inputRef={sourceRef}
                />
              </div>
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">
                  {te('relationTypeLabel')}
                </label>
                <select
                  value={quickRel}
                  onChange={(e) => setQuickRel(e.target.value as RelationType)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                >
                  {(
                    [
                      RT.MATERIAL,
                      RT.TOOL,
                      RT.ENERGY,
                      RT.KNOWLEDGE,
                      RT.CATALYST,
                    ] as const
                  ).map((r) => (
                    <option key={r} value={r}>
                      {tRel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">
                  {te('targetNode')}
                </label>
                <SearchableSelect
                  options={nodeOptions}
                  value={quickTarget}
                  onChange={setQuickTarget}
                />
              </div>
              <button
                type="button"
                onClick={addQuickLink}
                className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563eb]"
              >
                {te('addLink')}
              </button>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={linkQ}
                onChange={(e) => setLinkQ(e.target.value)}
                placeholder={te('searchPlaceholderLinks')}
                className="min-w-[200px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <select
                value={relFilter}
                onChange={(e) => setRelFilter(e.target.value)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              >
                <option value="all">{te('allRelations')}</option>
                {(
                  [
                    RT.MATERIAL,
                    RT.TOOL,
                    RT.ENERGY,
                    RT.KNOWLEDGE,
                    RT.CATALYST,
                  ] as const
                ).map((r) => (
                  <option key={r} value={r}>
                    {tRel(r)}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={srcFilter}
                onChange={(e) => setSrcFilter(e.target.value)}
                placeholder={te('filterSource')}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                type="search"
                value={tgtFilter}
                onChange={(e) => setTgtFilter(e.target.value)}
                placeholder={te('filterTarget')}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>

            <div className="editor-scrollbar min-h-0 flex-1 overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-elevated text-start text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleLinkSort('source')}
                      >
                        {te('linkColumnSource')}{' '}
                        {linkSortKey === 'source' ? (linkSortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="w-8 px-1 text-center">→</th>
                    <th className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleLinkSort('target')}
                      >
                        {te('linkColumnTarget')}{' '}
                        {linkSortKey === 'target' ? (linkSortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleLinkSort('relation')}
                      >
                        {te('linkColumnRelation')}{' '}
                        {linkSortKey === 'relation' ? (linkSortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleLinkSort('optional')}
                      >
                        {te('optionalColumn')}{' '}
                        {linkSortKey === 'optional' ? (linkSortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleLinkSort('notes')}
                      >
                        {te('notesColumn')}{' '}
                        {linkSortKey === 'notes' ? (linkSortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="min-w-[104px] w-[104px] px-3 py-2 text-end">
                      {te('actionsColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLinks.map((l, i) => {
                    const s = nodeById.get(l.source_id);
                    const tgt = nodeById.get(l.target_id);
                    const bg = i % 2 === 0 ? 'bg-surface' : 'bg-[#0F1420]';
                    return (
                      <tr
                        key={l.id}
                        className={`border-t border-border ${bg} hover:bg-surface-elevated`}
                      >
                        <td className="px-3 py-2 font-medium">
                          {s
                            ? pickNodeDisplayName(locale, s.name, s.name_en)
                            : l.source_id}
                        </td>
                        <td className="px-1 text-center text-muted-foreground">→</td>
                        <td className="px-3 py-2 font-medium">
                          {tgt
                            ? pickNodeDisplayName(locale, tgt.name, tgt.name_en)
                            : l.target_id}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded border px-2 py-0.5 text-xs ${RELATION_BADGE_COLORS[l.relation_type]}`}
                          >
                            {tRel(l.relation_type)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {l.is_optional ? te('yes') : te('no')}
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-muted-foreground">
                          {l.notes?.trim() ? l.notes : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-transparent text-muted-foreground transition-colors hover:bg-border/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                              aria-label={te('editLink')}
                              title={te('editLink')}
                              onClick={() => {
                                setLinkPanel(l);
                                setLinkForm({
                                  relation_type: l.relation_type,
                                  is_optional: l.is_optional,
                                  notes: l.notes ?? '',
                                });
                              }}
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-transparent text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                              aria-label={tc('delete')}
                              title={tc('delete')}
                              onClick={() => deleteLink(l)}
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" x2="10" y1="11" y2="17" />
                                <line x1="14" x2="14" y1="11" y2="17" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Comparaison doublons : deux panneaux d’édition */}
      {comparePairIds && compareNodeLeft && compareNodeRight ? (
        <div
          className="fixed right-0 top-14 z-[70] flex h-[calc(100dvh-3.5rem)] max-w-[min(100vw,836px)] flex-col overflow-hidden border-l border-border bg-page/95 shadow-2xl backdrop-blur-sm"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
            <span className="text-xs font-medium text-amber-100">
              {te('duplicateCompareHeading')}
            </span>
            <button
              type="button"
              onClick={closeDuplicateCompare}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            >
              {tc('close')}
            </button>
          </div>
          <div className="flex min-h-0 flex-1 overflow-hidden divide-x divide-border">
            <aside className="flex min-h-0 min-w-0 w-[min(50vw,418px)] flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-border bg-surface/80 px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                {te('duplicateCompareBadgeA')} ·{' '}
                <span className="font-mono text-[10px] text-foreground/90">
                  {compareNodeLeft.id}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <SuggestNodeCorrectionPanel
                  key={`${compareNodeLeft.id}-${compareDataEpoch}`}
                  variant="admin"
                  node={seedNodeToTechBasic(compareNodeLeft)}
                  adminStayOpenAfterSave
                  fillContainerHeight
                  compareUpstreamCount={compareUpstreamLeft}
                  onAdminDeleteCard={() =>
                    void deleteNodeFromCompare(compareNodeLeft)
                  }
                  onClose={closeDuplicateCompare}
                  onAdminSaved={async () => {
                    await loadAll();
                    setCompareDataEpoch((e) => e + 1);
                  }}
                />
              </div>
            </aside>
            <aside className="flex min-h-0 min-w-0 w-[min(50vw,418px)] flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-border bg-surface/80 px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
                {te('duplicateCompareBadgeB')} ·{' '}
                <span className="font-mono text-[10px] text-foreground/90">
                  {compareNodeRight.id}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <SuggestNodeCorrectionPanel
                  key={`${compareNodeRight.id}-${compareDataEpoch}`}
                  variant="admin"
                  node={seedNodeToTechBasic(compareNodeRight)}
                  adminStayOpenAfterSave
                  fillContainerHeight
                  compareUpstreamCount={compareUpstreamRight}
                  onAdminDeleteCard={() =>
                    void deleteNodeFromCompare(compareNodeRight)
                  }
                  onClose={closeDuplicateCompare}
                  onAdminSaved={async () => {
                    await loadAll();
                    setCompareDataEpoch((e) => e + 1);
                  }}
                />
              </div>
            </aside>
          </div>
        </div>
      ) : null}

      {/* Panneau nœud : édition = même UI que « Suggérer une correction » */}
      {panelOpen && editNodeForPanel && !comparePairIds ? (
        <aside
          className="fixed right-0 top-14 z-[70] flex h-[calc(100dvh-3.5rem)] min-h-0 w-full flex-col overflow-hidden glass-panel-right shadow-2xl"
          style={{
            maxWidth: 400,
            width: 'min(100vw, 400px)',
          }}
        >
          <SuggestNodeCorrectionPanel
            key={editNodeForPanel.id}
            variant="admin"
            node={seedNodeToTechBasic(editNodeForPanel)}
            compareUpstreamCount={editPanelUpstreamCount}
            onClose={() => setPanelOpen(false)}
            onAdminSaved={async () => {
              await loadAll();
            }}
          />
        </aside>
      ) : null}

      {/* Modal suppression nœud */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg glass-surface p-6 shadow-xl">
            <p className="text-sm text-foreground">
              {te('deleteConfirmRich', {
                name: pickNodeDisplayName(
                  locale,
                  deleteTarget.name,
                  deleteTarget.name_en
                ),
                count: deleteLinkCount,
              })}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-border"
              >
                {tc('cancel')}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {tc('delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Panneau édition lien */}
      {linkPanel ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/50"
            aria-label={tc('close')}
            onClick={() => setLinkPanel(null)}
          />
          <aside
            className="fixed right-0 top-14 z-[70] flex h-[calc(100dvh-3.5rem)] w-full flex-col glass-panel-right shadow-xl"
            style={{
              maxWidth: EXPLORE_DETAIL_PANEL_WIDTH_PX,
              width: `min(100vw, ${EXPLORE_DETAIL_PANEL_WIDTH_PX}px)`,
            }}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h2 className="font-semibold">{te('editLink')}</h2>
              <button
                type="button"
                className="text-muted-foreground hover:text-white"
                onClick={() => setLinkPanel(null)}
              >
                ×
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {te('linkColumnSource')}
                </label>
                <input
                  readOnly
                  disabled
                  value={(() => {
                    const sn = nodeById.get(linkPanel.source_id);
                    return sn
                      ? pickNodeDisplayName(locale, sn.name, sn.name_en)
                      : linkPanel.source_id;
                  })()}
                  className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-muted-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {te('linkColumnTarget')}
                </label>
                <input
                  readOnly
                  disabled
                  value={(() => {
                    const tn = nodeById.get(linkPanel.target_id);
                    return tn
                      ? pickNodeDisplayName(locale, tn.name, tn.name_en)
                      : linkPanel.target_id;
                  })()}
                  className="w-full rounded-lg border border-border bg-page px-3 py-2 text-sm text-muted-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {te('relationTypeLabel')}
                </label>
                <select
                  value={linkForm.relation_type}
                  onChange={(e) =>
                    setLinkForm((f) => ({
                      ...f,
                      relation_type: e.target.value as RelationType,
                    }))
                  }
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                >
                  {(
                    [
                      RT.MATERIAL,
                      RT.TOOL,
                      RT.ENERGY,
                      RT.KNOWLEDGE,
                      RT.CATALYST,
                    ] as const
                  ).map((r) => (
                    <option key={r} value={r}>
                      {tRel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="opt"
                  checked={linkForm.is_optional}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, is_optional: e.target.checked }))
                  }
                  className="rounded border-border"
                />
                <label htmlFor="opt" className="text-sm text-foreground">
                  {te('optionalCheckbox')}
                </label>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  {te('notesColumn')}
                </label>
                <textarea
                  rows={3}
                  value={linkForm.notes}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="flex gap-2 border-t border-border p-4">
              <button
                type="button"
                onClick={saveLinkEdit}
                className="flex-1 rounded-lg bg-[#3B82F6] py-2 text-sm font-medium text-white hover:bg-[#2563eb]"
              >
                {tc('save')}
              </button>
              <button
                type="button"
                onClick={() => setLinkPanel(null)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-border"
              >
                {tc('cancel')}
              </button>
            </div>
          </aside>
        </>
      ) : null}

      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 top-20 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
              toast.kind === 'ok'
                ? 'border-l-4 border-l-emerald-500 bg-surface-elevated text-foreground'
                : 'border-l-4 border-l-red-500 bg-surface-elevated text-foreground'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}

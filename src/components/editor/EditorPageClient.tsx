'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SuggestNodeCorrectionPanel } from '@/components/ui/SuggestNodeCorrectionPanel';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { getCategoryColor } from '@/lib/colors';
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
import {
  chemicalNatureTableLabel,
  naturalOriginTableLabel,
} from '@/lib/nature-table-labels';
import { rowIsDraft } from '@/lib/draft-flag';
import { treeInventionPath, getDefaultTreeNodeId } from '@/lib/tree-routes';
import { EXPLORE_DETAIL_PANEL_WIDTH_PX } from '@/lib/explore-layout';
import { useGraphStore } from '@/stores/graph-store';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';

const RELATION_BADGE_COLORS: Record<RelationType, string> = {
  [RT.MATERIAL]: 'bg-teal-500/20 text-teal-200 border-teal-500/40',
  [RT.TOOL]: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
  [RT.ENERGY]: 'bg-red-500/20 text-red-200 border-red-500/40',
  [RT.KNOWLEDGE]: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
  [RT.CATALYST]: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
};

type Toast = { id: number; kind: 'ok' | 'err'; text: string };

type SortDir = 'asc' | 'desc';
type NodeSortKey =
  | 'name'
  | 'category'
  | 'dimension'
  | 'materialLevel'
  | 'era'
  | 'year_approx'
  | 'origin'
  | 'links';

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
  const [tab, setTab] = useState<'nodes' | 'links'>('nodes');
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

  useEffect(() => {
    const onRefresh = () => {
      void loadAll();
    };
    window.addEventListener('craftree:editor-refresh', onRefresh);
    return () =>
      window.removeEventListener('craftree:editor-refresh', onRefresh);
  }, [loadAll]);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
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
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        .map((n) => ({
          value: n.id,
          label: n.name,
          category: n.category as NodeCategory,
        })),
    [nodes]
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
  const [sortKey, setSortKey] = useState<NodeSortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const editNodeForPanel = useMemo(
    () => (editingId ? nodes.find((x) => x.id === editingId) : undefined),
    [nodes, editingId]
  );

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

  const filteredNodes = useMemo(() => {
    const qt = qNode.trim().toLowerCase();
    return nodes.filter((n) => {
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
      if (draftsOnly && !rowIsDraft(n as unknown as Record<string, unknown>))
        return false;
      if (isolatedOnly) {
        const lc = linkCounts(n.id, graphModelEdges);
        if (lc.in !== 0 || lc.out !== 0) return false;
      }
      if (!qt) return true;
      const blob = [
        n.name,
        n.description,
        n.category,
        n.origin ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(qt);
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
    graphModelEdges,
  ]);

  const sortedNodes = useMemo(() => {
    const arr = [...filteredNodes];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'fr');
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
        default:
          cmp = 0;
      }
      return cmp * dir;
    });
    return arr;
  }, [filteredNodes, sortKey, sortDir, graphModelEdges]);

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
    setEditingId(n.id);
    setPanelOpen(true);
  };

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
    setEditingId(n.id);
    setPanelOpen(true);
    router.replace('/editor', { scroll: false });
  }, [loading, nodes, searchParams, router]);

  useEffect(() => {
    if (loading || openedNewFromUrl.current) return;
    if (searchParams.get('new') !== '1') return;
    if (searchParams.get('edit')) return;
    openedNewFromUrl.current = true;
    setAddCardModalOpen(true);
    router.replace('/editor', { scroll: false });
  }, [loading, searchParams, router, setAddCardModalOpen]);

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
    return links.filter((l) => {
      if (relFilter !== 'all' && l.relation_type !== relFilter) return false;
      const s = nodeById.get(l.source_id);
      const t = nodeById.get(l.target_id);
      if (sf && !(s?.name.toLowerCase().includes(sf) ?? false)) return false;
      if (tf && !(t?.name.toLowerCase().includes(tf) ?? false)) return false;
      if (lq) {
        const blob = `${s?.name ?? ''} ${t?.name ?? ''} ${l.notes ?? ''}`.toLowerCase();
        if (!blob.includes(lq)) return false;
      }
      return true;
    });
  }, [links, relFilter, srcFilter, tgtFilter, linkQ, nodeById]);

  const sortedLinks = useMemo(() => {
    const arr = [...filteredLinks];
    const dir = linkSortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const sa = nodeById.get(a.source_id)?.name ?? '';
      const sb = nodeById.get(b.source_id)?.name ?? '';
      const ta = nodeById.get(a.target_id)?.name ?? '';
      const tb = nodeById.get(b.target_id)?.name ?? '';
      let cmp = 0;
      switch (linkSortKey) {
        case 'source':
          cmp = sa.localeCompare(sb, 'fr');
          break;
        case 'target':
          cmp = ta.localeCompare(tb, 'fr');
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
  }, [filteredLinks, linkSortKey, linkSortDir, nodeById]);

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
      <header className="sticky top-14 z-40 flex shrink-0 items-center border-b border-border bg-page px-6 py-4">
        <h1 className="text-lg font-semibold">{te('pageTitle')}</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className="mb-4 flex gap-6 border-b border-border">
          <button
            type="button"
            onClick={() => setTab('nodes')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === 'nodes'
                ? 'border-[#3B82F6] text-white'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {te('inventions')}
          </button>
          <button
            type="button"
            onClick={() => setTab('links')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === 'links'
                ? 'border-[#3B82F6] text-white'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {te('links')}
          </button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">{te('loading')}</p>
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
              <button
                type="button"
                title={te('isolatedOnlyTitle')}
                aria-label={te('noLinks')}
                aria-pressed={isolatedOnly}
                onClick={() => setIsolatedOnly((v) => !v)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors ${
                  isolatedOnly
                    ? 'border-[#F87171] bg-[#7f1d1d]/35 text-[#fecaca] hover:bg-[#7f1d1d]/50'
                    : 'border-border bg-surface-elevated text-foreground hover:bg-border'
                }`}
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
              </button>
              <button
                type="button"
                title={te('draftsOnlyTitle')}
                aria-label={te('draftsOnlyTitle')}
                aria-pressed={draftsOnly}
                onClick={() => setDraftsOnly((v) => !v)}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm transition-colors ${
                  draftsOnly
                    ? 'border-orange-500/80 bg-orange-950/40 text-orange-200 hover:bg-orange-950/60'
                    : 'border-border bg-surface-elevated text-foreground hover:bg-border'
                }`}
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
              </button>
              <span className="text-sm text-muted-foreground">
                {te('nodeCount', { count: sortedNodes.length })}
              </span>
            </div>

            <div className="editor-scrollbar min-h-0 flex-1 overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[1380px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-elevated text-start text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-12 px-1 py-1 text-center text-muted-foreground">
                      {te('imageColumn')}
                    </th>
                    <th className="w-[200px] px-3 py-1 text-foreground">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort('name')}
                      >
                        {te('name')}{' '}
                        {sortKey === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="w-[130px] px-3 py-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort('category')}
                      >
                        {te('category')}{' '}
                        {sortKey === 'category' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="w-[100px] px-3 py-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort('dimension')}
                      >
                        {te('columnDimension')}{' '}
                        {sortKey === 'dimension' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="w-[100px] px-3 py-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort('materialLevel')}
                      >
                        {te('columnLevel')}{' '}
                        {sortKey === 'materialLevel'
                          ? sortDir === 'asc'
                            ? '↑'
                            : '↓'
                          : ''}
                      </button>
                    </th>
                    <th className="w-[120px] px-3 py-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort('era')}
                      >
                        {te('era')}{' '}
                        {sortKey === 'era' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="w-[80px] px-3 py-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort('year_approx')}
                      >
                        {te('date')}{' '}
                        {sortKey === 'year_approx' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="w-[150px] px-3 py-1">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort('origin')}
                      >
                        {te('origin')}{' '}
                        {sortKey === 'origin' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="w-[120px] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {te('columnNaturalOrigins')}
                    </th>
                    <th className="w-[120px] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      {te('columnChemicalNature')}
                    </th>
                    <th className="w-[60px] px-3 py-1 text-center">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => toggleSort('links')}
                      >
                        {te('links')}{' '}
                        {sortKey === 'links' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </button>
                    </th>
                    <th className="min-w-[152px] w-[152px] px-3 py-1 text-end">
                      {te('actionsColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedNodes.map((n, i) => {
                    const lc = linkCounts(n.id, graphModelEdges);
                    const bg = i % 2 === 0 ? 'bg-surface' : 'bg-[#0F1420]';
                    return (
                      <tr
                        key={n.id}
                        className={`border-t border-border ${bg}`}
                      >
                        <td
                          className="w-12 px-1 py-2 align-middle"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <div className="flex justify-center">
                            {n.image_url?.trim() ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={
                                  (imageBustByNodeId[n.id] ?? 0) > 0
                                    ? `${n.image_url}${n.image_url.includes('?') ? '&' : '?'}t=${imageBustByNodeId[n.id]}`
                                    : n.image_url
                                }
                                alt=""
                                width={40}
                                height={40}
                                className="h-10 w-10 rounded-md object-cover"
                              />
                            ) : (
                              <div
                                className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
                                style={{
                                  backgroundColor: getCategoryColor(
                                    n.category as NodeCategory
                                  ),
                                }}
                                aria-hidden
                              >
                                {n.name.trim().charAt(0).toUpperCase() || '?'}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 font-bold text-foreground">
                          <span className="inline-flex max-w-full items-center gap-2">
                            <Link
                              href={treeInventionPath(n.id)}
                              className="min-w-0 truncate text-foreground underline-offset-2 hover:text-accent hover:underline"
                            >
                              {n.name}
                            </Link>
                            {n.is_draft ? (
                              <span
                                className="inline-block h-2 w-2 shrink-0 rounded-full bg-orange-500"
                                title={te('draftRowIndicator')}
                                aria-label={te('draftRowIndicator')}
                              />
                            ) : null}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
                            style={{
                              borderColor: getCategoryColor(n.category as NodeCategory),
                              color: getCategoryColor(n.category as NodeCategory),
                            }}
                          >
                            {safeCategoryLabel(tCat, String(n.category))}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {n.dimension
                            ? te(EDITOR_DIM_KEY[n.dimension as NodeDimension])
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {n.dimension === 'matter' && n.materialLevel
                            ? te(EDITOR_LEVEL_KEY[n.materialLevel as MaterialLevel])
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {eraLabelFromMessages(locale, n.era as Era)}
                        </td>
                        <td className="px-3 py-2">
                          {n.year_approx === null || n.year_approx === undefined
                            ? '—'
                            : String(n.year_approx)}
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-2 text-muted-foreground">
                          {n.origin?.trim() ? n.origin : '—'}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground">
                          {naturalOriginTableLabel(n, tExplore)}
                        </td>
                        <td className="max-w-[120px] truncate px-3 py-2 text-muted-foreground">
                          {chemicalNatureTableLabel(n, tExplore)}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-xs text-muted-foreground">
                          ↓{lc.in} ↑{lc.out}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-0.5">
                            {rowIsDraft(n as unknown as Record<string, unknown>) ? (
                              <button
                                type="button"
                                disabled={draftPublishingId === n.id}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-transparent text-emerald-500 transition-colors hover:bg-emerald-500/15 hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                                title={te('rowActionPublishDraft')}
                                aria-label={te('rowActionPublishDraft')}
                                onClick={() => void publishDraftFromRow(n)}
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
                                  <path d="M9 12.75L11.25 15L15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                </svg>
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-transparent text-muted-foreground transition-colors hover:bg-border/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                              aria-label={te('panelEditInvention')}
                              title={te('panelEditInvention')}
                              onClick={() => openEdit(n)}
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
                              onClick={() => setDeleteTarget(n)}
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
                        <td className="px-3 py-2 font-medium">{s?.name ?? l.source_id}</td>
                        <td className="px-1 text-center text-muted-foreground">→</td>
                        <td className="px-3 py-2 font-medium">{tgt?.name ?? l.target_id}</td>
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

      {/* Panneau nœud : édition = même UI que « Suggérer une correction » */}
      {panelOpen && editNodeForPanel ? (
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
                name: deleteTarget.name,
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
                  value={nodeById.get(linkPanel.source_id)?.name ?? linkPanel.source_id}
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
                  value={nodeById.get(linkPanel.target_id)?.name ?? linkPanel.target_id}
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

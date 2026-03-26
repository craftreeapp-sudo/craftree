'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getCategoryColor } from '@/lib/colors';
import {
  NODE_CATEGORY_ORDER,
  ERA_ORDER,
  TECH_NODE_TYPE_ORDER,
} from '@/lib/node-labels';
import {
  RelationType as RT,
  type CraftingLink,
  type NodeCategory,
  type RelationType,
  type SeedNode,
  type TechNodeType,
  type Era,
} from '@/lib/types';
import { SearchableSelect, type SearchableOption } from './SearchableSelect';
import {
  NodeEditForm,
  createEmptyFormState,
  seedNodeToFormState,
  type NodeEditFormState,
} from './NodeEditForm';
import {
  cleanRawMaterialLinks,
  filterValidCraftingLinks,
} from '@/lib/graph-utils';
import { useGraphStore } from '@/stores/graph-store';

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
  | 'type'
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
  const te = useTranslations('editor');
  const tRel = useTranslations('relationTypes');
  const tCat = useTranslations('categories');
  const tEra = useTranslations('eras');
  const tType = useTranslations('types');
  const tc = useTranslations('common');

  const updateNode = useGraphStore((s) => s.updateNode);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const { toasts, push } = useToasts();
  const [tab, setTab] = useState<'nodes' | 'links'>('nodes');
  const [nodes, setNodes] = useState<SeedNode[]>([]);
  const [links, setLinks] = useState<CraftingLink[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [nr, lr] = await Promise.all([
        fetch('/api/nodes'),
        fetch('/api/links'),
      ]);
      const nj = await nr.json();
      const lj = await lr.json();
      setNodes(nj.nodes ?? []);
      setLinks(lj.links ?? []);
    } catch {
      push(te('toastLoadError'), 'err');
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  /** Même pipeline que le graphe /explore (store) : liens valides + sans intrant vers matière première. */
  const graphModelEdges = useMemo(() => {
    if (nodes.length === 0) return [];
    const forGraph = nodes.map((n) => ({
      id: n.id,
      type: n.type as TechNodeType,
    }));
    const valid = filterValidCraftingLinks(forGraph, links);
    return cleanRawMaterialLinks(forGraph, valid);
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
  const [typeF, setTypeF] = useState<string>('all');
  const [eraF, setEraF] = useState<string>('all');
  /** Nœuds sans aucun lien entrant ni sortant. */
  const [isolatedOnly, setIsolatedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<NodeSortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NodeEditFormState>(createEmptyFormState());

  const [deleteTarget, setDeleteTarget] = useState<SeedNode | null>(null);

  const filteredNodes = useMemo(() => {
    const qt = qNode.trim().toLowerCase();
    return nodes.filter((n) => {
      if (catF !== 'all' && n.category !== catF) return false;
      if (typeF !== 'all' && n.type !== typeF) return false;
      if (eraF !== 'all' && n.era !== eraF) return false;
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
  }, [nodes, qNode, catF, typeF, eraF, isolatedOnly, graphModelEdges]);

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
        case 'type':
          cmp = a.type.localeCompare(b.type);
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
    setEditingId(null);
    setForm(createEmptyFormState());
    setPanelOpen(true);
  };

  const openEdit = (n: SeedNode) => {
    setEditingId(n.id);
    setForm(seedNodeToFormState(n));
    setPanelOpen(true);
  };

  const saveNode = async () => {
    const body = {
      name: form.name.trim(),
      name_en: form.name_en.trim() || form.name.trim(),
      description: form.description.trim(),
      category: form.category,
      type: form.type,
      era: form.era,
      year_approx:
        form.year_approx.trim() === ''
          ? null
          : Number(form.year_approx.trim()),
      origin: form.origin.trim() || undefined,
      tags: form.tags,
      wikipedia_url: form.wikipedia_url.trim() || undefined,
    };
    if (!body.name || !body.description) {
      push(te('toastNameDescRequired'), 'err');
      return;
    }
    try {
      if (editingId) {
        const res = await fetch(`/api/nodes/${encodeURIComponent(editingId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          push((e as { error?: string }).error ?? te('toastError'), 'err');
          return;
        }
        push(te('toastNodeUpdated'));
      } else {
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          push((e as { error?: string }).error ?? te('toastError'), 'err');
          return;
        }
        push(te('toastNodeCreated'));
      }
      setPanelOpen(false);
      await loadAll();
    } catch {
      push(te('toastNetworkError'), 'err');
    }
  };

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
    quantity_hint: '',
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
            quantity_hint: linkForm.quantity_hint.trim() || undefined,
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

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#0A0E17] text-[#E8ECF4]">
      <header className="sticky top-0 z-40 flex shrink-0 items-center justify-between border-b border-[#2A3042] bg-[#0A0E17] px-6 py-4">
        <h1 className="text-lg font-semibold">{te('pageTitle')}</h1>
        <Link
          href="/explore"
          className="rounded-lg border border-[#2A3042] bg-[#1A1F2E] px-4 py-2 text-sm text-[#E8ECF4] transition-colors hover:bg-[#2A3042]"
        >
          {te('backToExplore')}
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
        <div className="mb-4 flex gap-6 border-b border-[#2A3042]">
          <button
            type="button"
            onClick={() => setTab('nodes')}
            className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
              tab === 'nodes'
                ? 'border-[#3B82F6] text-white'
                : 'border-transparent text-[#8B95A8] hover:text-[#E8ECF4]'
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
                : 'border-transparent text-[#8B95A8] hover:text-[#E8ECF4]'
            }`}
          >
            {te('links')}
          </button>
        </div>

        {loading ? (
          <p className="text-[#8B95A8]">{te('loading')}</p>
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
                className="min-w-[200px] flex-1 rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm text-[#E8ECF4] placeholder:text-[#5A6175] outline-none focus:border-[#3B82F6]"
              />
              <select
                value={catF}
                onChange={(e) => setCatF(e.target.value)}
                className="rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm text-[#E8ECF4] outline-none focus:border-[#3B82F6]"
              >
                <option value="all">{te('allCategories')}</option>
                {NODE_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {tCat(c)}
                  </option>
                ))}
              </select>
              <select
                value={typeF}
                onChange={(e) => setTypeF(e.target.value)}
                className="rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm text-[#E8ECF4] outline-none focus:border-[#3B82F6]"
              >
                <option value="all">{te('allTypes')}</option>
                {TECH_NODE_TYPE_ORDER.map((nt) => (
                  <option key={nt} value={nt}>
                    {tType(nt)}
                  </option>
                ))}
              </select>
              <select
                value={eraF}
                onChange={(e) => setEraF(e.target.value)}
                className="rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm text-[#E8ECF4] outline-none focus:border-[#3B82F6]"
              >
                <option value="all">{te('allEras')}</option>
                {ERA_ORDER.map((e) => (
                  <option key={e} value={e}>
                    {tEra(e)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                title={te('isolatedOnlyTitle')}
                aria-pressed={isolatedOnly}
                onClick={() => setIsolatedOnly((v) => !v)}
                className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  isolatedOnly
                    ? 'border-[#F87171] bg-[#7f1d1d]/35 text-[#fecaca] hover:bg-[#7f1d1d]/50'
                    : 'border-[#2A3042] bg-[#1A1F2E] text-[#E8ECF4] hover:bg-[#2A3042]'
                }`}
              >
                {te('noLinks')}
              </button>
              <span className="text-sm text-[#8B95A8]">
                {te('nodeCount', { count: sortedNodes.length })}
              </span>
            </div>

            <div className="editor-scrollbar min-h-0 flex-1 overflow-auto rounded-lg border border-[#2A3042]">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-[#1A1F2E] text-start text-xs font-bold uppercase tracking-wide text-[#8B95A8]">
                  <tr>
                    <th className="w-12 px-1 py-1 text-center text-[#8B95A8]">
                      {te('imageColumn')}
                    </th>
                    <th className="w-[200px] px-3 py-1 text-[#E8ECF4]">
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
                        onClick={() => toggleSort('type')}
                      >
                        {te('type')}{' '}
                        {sortKey === 'type' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
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
                    <th className="w-[120px] px-3 py-1">{te('actionsColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedNodes.map((n, i) => {
                    const lc = linkCounts(n.id, graphModelEdges);
                    const bg = i % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0F1420]';
                    return (
                      <tr
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openEdit(n)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openEdit(n);
                          }
                        }}
                        className={`cursor-pointer border-t border-[#2A3042] ${bg} hover:bg-[#1A1F2E]`}
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
                        <td className="px-3 py-2 font-bold text-[#E8ECF4]">{n.name}</td>
                        <td className="px-3 py-2">
                          <span
                            className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
                            style={{
                              borderColor: getCategoryColor(n.category as NodeCategory),
                              color: getCategoryColor(n.category as NodeCategory),
                            }}
                          >
                            {tCat(n.category as NodeCategory) ?? n.category}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="rounded bg-[#2A3042] px-2 py-0.5 text-xs text-[#E8ECF4]">
                            {tType(n.type as TechNodeType) ?? n.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#8B95A8]">
                          {tEra(n.era as Era) ?? n.era}
                        </td>
                        <td className="px-3 py-2">
                          {n.year_approx === null || n.year_approx === undefined
                            ? '—'
                            : String(n.year_approx)}
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-2 text-[#8B95A8]">
                          {n.origin?.trim() ? n.origin : '—'}
                        </td>
                        <td className="px-3 py-2 text-center font-mono text-xs text-[#8B95A8]">
                          ↓{lc.in} ↑{lc.out}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="mr-2 rounded p-1 hover:bg-[#2A3042]"
                            aria-label={te('panelEditInvention')}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(n);
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-[#EF4444] transition-colors hover:text-[#F87171]"
                            aria-label={tc('delete')}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(n);
                            }}
                          >
                            <span className="text-lg leading-none">×</span>
                          </button>
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
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-[#2A3042] bg-[#111827]/50 p-4">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-xs text-[#8B95A8]">
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
                <label className="mb-1 block text-xs text-[#8B95A8]">
                  {te('relationTypeLabel')}
                </label>
                <select
                  value={quickRel}
                  onChange={(e) => setQuickRel(e.target.value as RelationType)}
                  className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm text-[#E8ECF4] outline-none focus:border-[#3B82F6]"
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
                <label className="mb-1 block text-xs text-[#8B95A8]">
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
                className="min-w-[200px] flex-1 rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
              />
              <select
                value={relFilter}
                onChange={(e) => setRelFilter(e.target.value)}
                className="rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
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
                className="rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
              />
              <input
                type="search"
                value={tgtFilter}
                onChange={(e) => setTgtFilter(e.target.value)}
                placeholder={te('filterTarget')}
                className="rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
              />
            </div>

            <div className="editor-scrollbar min-h-0 flex-1 overflow-auto rounded-lg border border-[#2A3042]">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-[#1A1F2E] text-start text-xs font-bold uppercase tracking-wide text-[#8B95A8]">
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
                    <th className="w-[100px] px-3 py-2">{te('actionsColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLinks.map((l, i) => {
                    const s = nodeById.get(l.source_id);
                    const tgt = nodeById.get(l.target_id);
                    const bg = i % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0F1420]';
                    return (
                      <tr
                        key={l.id}
                        className={`border-t border-[#2A3042] ${bg} hover:bg-[#1A1F2E]`}
                      >
                        <td className="px-3 py-2 font-medium">{s?.name ?? l.source_id}</td>
                        <td className="px-1 text-center text-[#8B95A8]">→</td>
                        <td className="px-3 py-2 font-medium">{tgt?.name ?? l.target_id}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded border px-2 py-0.5 text-xs ${RELATION_BADGE_COLORS[l.relation_type]}`}
                          >
                            {tRel(l.relation_type)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#8B95A8]">
                          {l.is_optional ? te('yes') : te('no')}
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-[#8B95A8]">
                          {l.notes?.trim() ? l.notes : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            className="mr-2 rounded p-1 hover:bg-[#2A3042]"
                            onClick={() => {
                              setLinkPanel(l);
                              setLinkForm({
                                relation_type: l.relation_type,
                                quantity_hint: l.quantity_hint ?? '',
                                is_optional: l.is_optional,
                                notes: l.notes ?? '',
                              });
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-[#2A3042]"
                            onClick={() => deleteLink(l)}
                          >
                            🗑️
                          </button>
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

      {/* Panneau nœud */}
      {panelOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/50"
            aria-label={tc('close')}
            onClick={() => setPanelOpen(false)}
          />
          <aside className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-[400px] flex-col border-l border-[#2A3042] bg-[#1A1F2E] shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-[#2A3042] px-4 py-3">
              <h2 className="font-semibold">
                {editingId ? te('panelEditInvention') : te('panelNewInvention')}
              </h2>
              <button
                type="button"
                className="text-[#8B95A8] hover:text-white"
                onClick={() => setPanelOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
              <NodeEditForm
                editingId={editingId}
                form={form}
                setForm={setForm}
                nodes={nodes}
                links={links}
                onRefreshData={loadAll}
                onSave={() => void saveNode()}
                onCancel={() => setPanelOpen(false)}
                currentImageUrl={
                  editingId
                    ? nodes.find((x) => x.id === editingId)?.image_url ?? null
                    : null
                }
                onImageUploadSuccess={
                  editingId
                    ? (url) => {
                        updateNode(editingId, { image_url: url });
                        setNodes((prev) =>
                          prev.map((x) =>
                            x.id === editingId ? { ...x, image_url: url } : x
                          )
                        );
                      }
                    : undefined
                }
              />
            </div>
          </aside>
        </>
      ) : null}

      {/* Modal suppression nœud */}
      {deleteTarget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-lg border border-[#2A3042] bg-[#1A1F2E] p-6 shadow-xl">
            <p className="text-sm text-[#E8ECF4]">
              {te('deleteConfirmRich', {
                name: deleteTarget.name,
                count: deleteLinkCount,
              })}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-[#2A3042] px-4 py-2 text-sm text-[#8B95A8] hover:bg-[#2A3042]"
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
          <aside className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-[400px] flex-col border-l border-[#2A3042] bg-[#1A1F2E] shadow-xl">
            <div className="flex items-center justify-between border-b border-[#2A3042] px-4 py-3">
              <h2 className="font-semibold">{te('editLink')}</h2>
              <button
                type="button"
                className="text-[#8B95A8] hover:text-white"
                onClick={() => setLinkPanel(null)}
              >
                ×
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-4 py-4">
              <div>
                <label className="mb-1 block text-xs text-[#8B95A8]">
                  {te('linkColumnSource')}
                </label>
                <input
                  readOnly
                  disabled
                  value={nodeById.get(linkPanel.source_id)?.name ?? linkPanel.source_id}
                  className="w-full rounded-lg border border-[#2A3042] bg-[#0A0E17] px-3 py-2 text-sm text-[#8B95A8]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#8B95A8]">
                  {te('linkColumnTarget')}
                </label>
                <input
                  readOnly
                  disabled
                  value={nodeById.get(linkPanel.target_id)?.name ?? linkPanel.target_id}
                  className="w-full rounded-lg border border-[#2A3042] bg-[#0A0E17] px-3 py-2 text-sm text-[#8B95A8]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#8B95A8]">
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
                  className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
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
              <div>
                <label className="mb-1 block text-xs text-[#8B95A8]">
                  {te('quantityLabel')}
                </label>
                <input
                  value={linkForm.quantity_hint}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, quantity_hint: e.target.value }))
                  }
                  placeholder={te('quantityPlaceholder')}
                  className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="opt"
                  checked={linkForm.is_optional}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, is_optional: e.target.checked }))
                  }
                  className="rounded border-[#2A3042]"
                />
                <label htmlFor="opt" className="text-sm text-[#E8ECF4]">
                  {te('optionalCheckbox')}
                </label>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#8B95A8]">
                  {te('notesColumn')}
                </label>
                <textarea
                  rows={3}
                  value={linkForm.notes}
                  onChange={(e) =>
                    setLinkForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
                />
              </div>
            </div>
            <div className="flex gap-2 border-t border-[#2A3042] p-4">
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
                className="rounded-lg border border-[#2A3042] px-4 py-2 text-sm text-[#8B95A8] hover:bg-[#2A3042]"
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
                ? 'border-l-4 border-l-emerald-500 bg-[#1A1F2E] text-[#E8ECF4]'
                : 'border-l-4 border-l-red-500 bg-[#1A1F2E] text-[#E8ECF4]'
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  );
}

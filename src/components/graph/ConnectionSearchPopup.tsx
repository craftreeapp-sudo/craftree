'use client';

import {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
} from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import type { NodeProps } from '@xyflow/react';
import Fuse from 'fuse.js';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import {
  useFocusLinkEditStore,
  type FocusLinkSearchMode,
} from '@/stores/focus-link-edit-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { RelationTypePicker } from './RelationTypePicker';
import { getCategoryColor } from '@/lib/colors';
import {
  formatYear,
  getEraFromYear,
  normalizeInventionName,
  slugify,
} from '@/lib/utils';
import type {
  Era,
  NodeCategory,
  SeedNode,
  TechNodeBasic,
  TechNodeType,
} from '@/lib/types';
import { RelationType } from '@/lib/types';
import {
  NODE_CATEGORY_ORDER,
  TECH_NODE_TYPE_ORDER,
} from '@/lib/node-labels';

/** Brouillon avant création API (catégorie / type modifiables jusqu’au choix du lien). */
export type CreateDraft = {
  name: string;
  category: NodeCategory;
  type: TechNodeType;
  year: number | null;
};

type PopupState =
  | { mode: 'search' }
  | { mode: 'create'; name: string }
  | { mode: 'pickRelation'; draft: CreateDraft };

function neighborIdsOfCenter(
  centerId: string,
  edges: { source_id: string; target_id: string }[]
): Set<string> {
  const set = new Set<string>();
  for (const e of edges) {
    if (e.target_id === centerId) set.add(e.source_id);
    if (e.source_id === centerId) set.add(e.target_id);
  }
  return set;
}

const SELECT_CLASS =
  'nodrag nopan w-full appearance-none rounded-md border-[0.5px] border-[#2A3042] bg-[#111827] px-2.5 py-2 pr-9 text-[13px] text-[#E8ECF4] outline-none focus:border-[#3B82F6]';

/** Lien vers une carte déjà en base : pas de choix UI, type par défaut. */
const DEFAULT_EXISTING_LINK_RELATION = RelationType.MATERIAL;

const SELECT_ARROW: CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235A6175' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
};

function seedToBasic(seed: SeedNode): TechNodeBasic {
  return {
    id: seed.id,
    name: seed.name,
    category: seed.category as NodeCategory,
    type: seed.type as TechNodeType,
    era: seed.era as Era,
    year_approx: seed.year_approx ?? undefined,
    complexity_depth: seed.complexity_depth,
    tags: seed.tags ?? [],
    origin: seed.origin,
    image_url: seed.image_url,
  };
}

function parseYearString(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function ConnectionSearchPopup(_props: NodeProps) {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const pushToast = useToastStore((s) => s.pushToast);
  const tAuth = useTranslations('auth');
  const searchMode = useFocusLinkEditStore((s) => s.searchMode);
  const close = useFocusLinkEditStore((s) => s.close);
  const setLastCreatedEdgeId = useFocusLinkEditStore(
    (s) => s.setLastCreatedEdgeId
  );
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const setEdgesAndRecompute = useGraphStore((s) => s.setEdgesAndRecompute);
  const addNodeAndRecompute = useGraphStore((s) => s.addNodeAndRecompute);
  const mergeNodeDetail = useNodeDetailsStore((s) => s.mergeNodeDetail);

  const [query, setQuery] = useState('');
  const [popupState, setPopupState] = useState<PopupState>({ mode: 'search' });
  const [category, setCategory] = useState<NodeCategory | ''>('');
  const [nodeType, setNodeType] = useState<TechNodeType | ''>('');
  const [yearInput, setYearInput] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [linkingExistingId, setLinkingExistingId] = useState<string | null>(
    null
  );
  const [pendingExisting, setPendingExisting] = useState<{
    node: TechNodeBasic;
    mode: FocusLinkSearchMode;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<CreateDraft | null>(null);

  const tConn = useTranslations('connectionPopup');
  const tc = useTranslations('common');
  const te = useTranslations('editor');

  const tCat = useTranslations('categories');
  const tType = useTranslations('types');

  const categoryOptions = useMemo(
    () =>
      NODE_CATEGORY_ORDER.map((value) => ({
        value,
        label: tCat(value),
      })),
    [tCat]
  );
  const typeOptions = useMemo(
    () =>
      TECH_NODE_TYPE_ORDER.map((value) => ({
        value,
        label: tType(value),
      })),
    [tType]
  );

  const mode: FocusLinkSearchMode | null = searchMode;

  useEffect(() => {
    if (popupState.mode === 'pickRelation') {
      draftRef.current = popupState.draft;
    } else {
      draftRef.current = null;
    }
  }, [popupState]);

  const connectedIds = useMemo(
    () =>
      selectedNodeId ? neighborIdsOfCenter(selectedNodeId, edges) : new Set(),
    [edges, selectedNodeId]
  );

  const searchPool = useMemo(() => {
    if (!selectedNodeId) return [];
    let list = nodes.filter(
      (n) => n.id !== selectedNodeId && !connectedIds.has(n.id)
    );
    if (mode === 'outputs') {
      list = list.filter((n) => n.type !== 'raw_material');
    }
    return list;
  }, [nodes, selectedNodeId, mode, connectedIds]);

  useEffect(() => {
    if (searchMode) {
      setQuery('');
      setPopupState({ mode: 'search' });
      setCategory('');
      setNodeType('');
      setYearInput('');
      setCreateError(null);
      setPendingExisting(null);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [searchMode]);

  const fuse = useMemo(
    () =>
      new Fuse(searchPool, {
        keys: ['name', 'category', 'era'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [searchPool]
  );

  const results = useMemo(() => {
    if (!query.trim()) return searchPool.slice(0, 40);
    return fuse.search(query).map((r) => r.item);
  }, [fuse, query, searchPool]);

  const visible = results.slice(0, 24);

  const qTrim = query.trim();
  const nameExistsExact = useMemo(() => {
    if (qTrim.length < 2) return true;
    const norm = normalizeInventionName(qTrim);
    return nodes.some((n) => normalizeInventionName(n.name) === norm);
  }, [nodes, qTrim]);

  const showCreateButton = qTrim.length >= 2 && !nameExistsExact;

  const submitContributorLinkSuggestion = useCallback(
    async (n: TechNodeBasic, m: FocusLinkSearchMode, relationType: RelationType) => {
      if (!selectedNodeId) return;
      const body =
        m === 'inputs'
          ? {
              source_id: n.id,
              target_id: selectedNodeId,
              relation_type: relationType,
            }
          : {
              source_id: selectedNodeId,
              target_id: n.id,
              relation_type: relationType,
            };
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_type: 'add_link',
          node_id: null,
          data: body,
        }),
      });
      if (!res.ok) {
        pushToast(
          (await res.json().catch(() => ({})))?.error ?? 'Erreur',
          'error'
        );
        return;
      }
      pushToast(tAuth('linkSuggestionSent'), 'success');
      setPendingExisting(null);
      close();
    },
    [selectedNodeId, close, pushToast, tAuth]
  );

  const onPickExistingNode = useCallback(
    async (n: TechNodeBasic) => {
      if (!selectedNodeId || !searchMode) return;
      const m = searchMode;

      if (!isAdmin) {
        setPendingExisting({ node: n, mode: m });
        return;
      }

      const relationType = DEFAULT_EXISTING_LINK_RELATION;
      setLinkingExistingId(n.id);
      const body =
        m === 'inputs'
          ? {
              source_id: n.id,
              target_id: selectedNodeId,
              relation_type: relationType,
            }
          : {
              source_id: selectedNodeId,
              target_id: n.id,
              relation_type: relationType,
            };

      try {
        const res = await fetch('/api/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.warn('POST /api/links failed', err);
          return;
        }
        const { link } = (await res.json()) as {
          link: import('@/lib/types').CraftingLink;
        };
        const prev = useGraphStore.getState().edges;
        setEdgesAndRecompute([...prev, link]);
        setLastCreatedEdgeId(link.id);
        close();
      } catch (e) {
        console.error(e);
      } finally {
        setLinkingExistingId(null);
      }
    },
    [
      selectedNodeId,
      searchMode,
      isAdmin,
      setEdgesAndRecompute,
      close,
      setLastCreatedEdgeId,
    ]
  );

  const updatePickDraft = useCallback((patch: Partial<CreateDraft>) => {
    setPopupState((p) => {
      if (p.mode !== 'pickRelation') return p;
      return { mode: 'pickRelation', draft: { ...p.draft, ...patch } };
    });
  }, []);

  const handleCreateNodeAndLink = useCallback(
    async (relationType: RelationType) => {
      const d = draftRef.current;
      if (!selectedNodeId || !mode || !d) return;
      setCreating(true);
      setCreateError(null);
      const era = getEraFromYear(d.year);
      const idHint = slugify(d.name) || `n-${Date.now()}`;

      if (!isAdmin) {
        try {
          const res = await fetch('/api/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              suggestion_type: 'new_node',
              node_id: null,
              data: {
                node: {
                  name: d.name,
                  category: d.category,
                  type: d.type,
                  era,
                  year_approx: d.year,
                  proposed_id: idHint,
                  description: '',
                  origin: null,
                },
                link: {
                  source_id:
                    mode === 'inputs' ? idHint : selectedNodeId,
                  target_id:
                    mode === 'inputs' ? selectedNodeId : idHint,
                  relation_type: relationType,
                },
              },
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            setCreateError(
              typeof err?.error === 'string' ? err.error : tConn('createFailed')
            );
            setCreating(false);
            return;
          }
          pushToast(tAuth('newNodeSuggestionSent'), 'success');
          setPopupState({ mode: 'search' });
          close();
        } catch {
          setCreateError(te('toastNetworkError'));
        } finally {
          setCreating(false);
        }
        return;
      }

      try {
        const nodeRes = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: d.name,
            id: idHint || undefined,
            category: d.category,
            type: d.type,
            era,
            year_approx: d.year,
            description: '',
            origin: null,
            tags: [],
            image_url: null,
            wikipedia_url: null,
            complexity_depth: 0,
          }),
        });
        const nodeData = await nodeRes.json().catch(() => ({}));
        if (!nodeRes.ok) {
          const msg =
            nodeData?.message ||
            (nodeData?.error === 'name_exists' ||
            nodeData?.error === 'id_exists'
              ? tConn('inventionNameExists')
              : tConn('createFailed'));
          setCreateError(msg);
          setCreating(false);
          return;
        }
        const { node: seed } = nodeData as { node: SeedNode };
        mergeNodeDetail(seed);
        addNodeAndRecompute(seedToBasic(seed));

        const body =
          mode === 'inputs'
            ? {
                source_id: seed.id,
                target_id: selectedNodeId,
                relation_type: relationType,
              }
            : {
                source_id: selectedNodeId,
                target_id: seed.id,
                relation_type: relationType,
              };

        const linkRes = await fetch('/api/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!linkRes.ok) {
          const err = await linkRes.json().catch(() => ({}));
          console.warn('POST /api/links failed', err);
          setCreateError(tConn('nodeCreatedLinkFailed'));
          setCreating(false);
          return;
        }
        const { link } = (await linkRes.json()) as {
          link: import('@/lib/types').CraftingLink;
        };
        const prev = useGraphStore.getState().edges;
        setEdgesAndRecompute([...prev, link]);
        setLastCreatedEdgeId(link.id);
        setPopupState({ mode: 'search' });
        close();
      } catch {
        setCreateError(te('toastNetworkError'));
      } finally {
        setCreating(false);
      }
    },
    [
      selectedNodeId,
      mode,
      isAdmin,
      mergeNodeDetail,
      addNodeAndRecompute,
      setEdgesAndRecompute,
      close,
      setLastCreatedEdgeId,
      tConn,
      te,
      pushToast,
      tAuth,
    ]
  );

  const proceedToPickRelation = useCallback(() => {
    if (popupState.mode !== 'create' || !category || !nodeType) return;
    const name = popupState.name.trim();
    if (!name) return;
    const year = parseYearString(yearInput);
    setCreateError(null);
    setPopupState({
      mode: 'pickRelation',
      draft: {
        name,
        category: category as NodeCategory,
        type: nodeType as TechNodeType,
        year,
      },
    });
  }, [popupState, category, nodeType, yearInput]);

  const backToSearch = useCallback(() => {
    setPopupState({ mode: 'search' });
    setCreateError(null);
    setCategory('');
    setNodeType('');
    setYearInput('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const backFromPickToCreate = useCallback(() => {
    if (popupState.mode !== 'pickRelation') return;
    const d = popupState.draft;
    setCategory(d.category);
    setNodeType(d.type);
    setYearInput(d.year === null ? '' : String(d.year));
    setPopupState({ mode: 'create', name: d.name });
    setCreateError(null);
  }, [popupState]);

  if (!selectedNodeId) return null;

  const createName =
    popupState.mode === 'create' ? popupState.name : '';

  const formValid = Boolean(category && nodeType);

  const pickDraft =
    popupState.mode === 'pickRelation' ? popupState.draft : null;
  const pickFormValid = Boolean(
    pickDraft?.category && pickDraft?.type
  );

  return (
    <div
      className="nodrag nopan nowheel pointer-events-auto"
      style={{ zIndex: 120 }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <motion.div
        className="w-[280px] overflow-hidden rounded-lg border border-[#3B82F6] bg-[#1A1F2E] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <AnimatePresence mode="wait">
            {pendingExisting ? (
              <motion.div
                key="pick-existing-rel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-start justify-between gap-2 border-b border-[#2A3042] px-3 py-2">
                  <p className="min-w-0 text-[13px] font-bold leading-tight text-white">
                    {pendingExisting.node.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPendingExisting(null)}
                    className="shrink-0 text-[12px] text-[#8B95A8] transition-colors hover:text-[#E8ECF4]"
                  >
                    {tc('back')}
                  </button>
                </div>
                <p className="px-3 pt-2 text-[11px] text-[#8B95A8]">
                  {tConn('pickRelationForLink')}
                </p>
                <RelationTypePicker
                  onPick={(rt) => {
                    void submitContributorLinkSuggestion(
                      pendingExisting.node,
                      pendingExisting.mode,
                      rt
                    );
                  }}
                />
              </motion.div>
            ) : popupState.mode === 'pickRelation' && pickDraft ? (
              <motion.div
                key="pick-new"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={creating ? 'pointer-events-none opacity-60' : ''}
              >
                <div className="flex items-start justify-between gap-2 border-b border-[#2A3042] px-3 py-2">
                  <p className="text-[13px] font-bold leading-tight text-white">
                    {tConn('createHeading', { name: pickDraft.name })}
                  </p>
                  <button
                    type="button"
                    onClick={backFromPickToCreate}
                    className="shrink-0 text-[12px] text-[#8B95A8] transition-colors hover:text-[#E8ECF4]"
                  >
                    {tc('back')}
                  </button>
                </div>
                <div className="max-h-[min(320px,55vh)] space-y-3 overflow-y-auto p-3">
                  <p className="text-[11px] leading-snug text-[#8B95A8]">
                    {tConn('pickHint')}
                  </p>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#8B95A8]">
                      {te('category')}
                    </label>
                    <select
                      value={pickDraft.category}
                      onChange={(e) =>
                        updatePickDraft({
                          category: e.target.value as NodeCategory,
                        })
                      }
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={SELECT_CLASS}
                      style={SELECT_ARROW}
                    >
                      {categoryOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#8B95A8]">
                      {te('type')}
                    </label>
                    <select
                      value={pickDraft.type}
                      onChange={(e) =>
                        updatePickDraft({
                          type: e.target.value as TechNodeType,
                        })
                      }
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={SELECT_CLASS}
                      style={SELECT_ARROW}
                    >
                      {typeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#8B95A8]">
                      {te('date')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        pickDraft.year === null
                          ? ''
                          : String(pickDraft.year)
                      }
                      onChange={(e) =>
                        updatePickDraft({
                          year: parseYearString(e.target.value),
                        })
                      }
                      onPointerDown={(e) => e.stopPropagation()}
                      placeholder={tConn('yearPlaceholder')}
                      className="w-full rounded-md border-[0.5px] border-[#2A3042] bg-[#111827] px-2.5 py-2 text-[13px] text-[#E8ECF4] outline-none placeholder:text-[#5A6175] focus:border-[#3B82F6]"
                    />
                  </div>
                  {createError ? (
                    <p className="text-[13px] text-[#EF4444]">{createError}</p>
                  ) : null}
                  <div className="border-t border-[#2A3042] pt-1">
                    <RelationTypePicker
                      onPick={(rt) => {
                        if (!pickFormValid || creating) return;
                        void handleCreateNodeAndLink(rt);
                      }}
                    />
                  </div>
                  {creating ? (
                    <p className="text-center text-[12px] text-[#8B95A8]">
                      {tConn('creating')}
                    </p>
                  ) : null}
                </div>
              </motion.div>
            ) : popupState.mode === 'create' ? (
              <motion.div
                key="create"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="flex items-start justify-between gap-2 border-b border-[#2A3042] px-3 py-2">
                  <p className="text-[13px] font-bold leading-tight text-white">
                    {tConn('createHeading', { name: createName })}
                  </p>
                  <button
                    type="button"
                    onClick={backToSearch}
                    className="shrink-0 text-[12px] text-[#8B95A8] transition-colors hover:text-[#E8ECF4]"
                  >
                    {tc('back')}
                  </button>
                </div>
                <div className="space-y-3 p-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-[#8B95A8]">
                      {te('category')}
                    </label>
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as NodeCategory | '')
                      }
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={SELECT_CLASS}
                      style={SELECT_ARROW}
                    >
                      <option value="">{tConn('choose')}</option>
                      {categoryOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#8B95A8]">
                      {te('type')}
                    </label>
                    <select
                      value={nodeType}
                      onChange={(e) =>
                        setNodeType(e.target.value as TechNodeType | '')
                      }
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={SELECT_CLASS}
                      style={SELECT_ARROW}
                    >
                      <option value="">{tConn('choose')}</option>
                      {typeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#8B95A8]">
                      {te('date')}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={yearInput}
                      onChange={(e) => setYearInput(e.target.value)}
                      onPointerDown={(e) => e.stopPropagation()}
                      placeholder={tConn('yearPlaceholder')}
                      className="w-full rounded-md border-[0.5px] border-[#2A3042] bg-[#111827] px-2.5 py-2 text-[13px] text-[#E8ECF4] outline-none placeholder:text-[#5A6175] focus:border-[#3B82F6]"
                    />
                  </div>
                  {createError ? (
                    <p className="text-[13px] text-[#EF4444]">{createError}</p>
                  ) : null}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!formValid}
                      onClick={proceedToPickRelation}
                      className="flex-1 rounded-md bg-[#3B82F6] py-2.5 text-[13px] font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {tConn('createAndConnect')}
                    </button>
                    <button
                      type="button"
                      onClick={backToSearch}
                      className="rounded-md bg-[#2A3042] px-3 py-2.5 text-[13px] text-[#8B95A8] transition-colors hover:bg-[#3B4558]"
                    >
                      {tc('cancel')}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="border-b border-[#2A3042] p-2">
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tConn('searchPlaceholder')}
                    className="w-full rounded-md border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm text-[#E8ECF4] placeholder:text-[#8B95A8] outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <ul
                  className="max-h-[min(240px,40vh)] touch-pan-y overscroll-contain py-1"
                  style={{ overflowY: 'auto' }}
                >
                  {visible.map((n) => {
                    const color = getCategoryColor(n.category);
                    const year = formatYear(n.year_approx);
                    const busy = linkingExistingId === n.id;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          disabled={linkingExistingId !== null}
                          onClick={() => void onPickExistingNode(n)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition-colors hover:bg-[#111827] disabled:cursor-wait disabled:opacity-60"
                        >
                          <span
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: color }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[#E8ECF4]">
                            {n.name}
                          </span>
                          {year ? (
                            <span className="shrink-0 text-[11px] text-[#8B95A8]">
                              {year}
                            </span>
                          ) : null}
                          {busy ? (
                            <span className="shrink-0 text-[11px] text-[#8B95A8]">
                              …
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {showCreateButton ? (
                  <div className="border-t border-[#2A3042] p-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCategory('');
                        setNodeType('');
                        setYearInput('');
                        setCreateError(null);
                        setPopupState({ mode: 'create', name: qTrim });
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-md px-[14px] py-2.5 text-start transition-opacity hover:opacity-95"
                      style={{
                        backgroundColor: '#6366F1',
                        borderRadius: 6,
                      }}
                    >
                      <span
                        className="text-base font-light leading-none text-white"
                        style={{ fontWeight: 300, fontSize: 16 }}
                      >
                        +
                      </span>
                      <span
                        className="text-[13px] font-medium leading-tight text-white"
                        style={{ fontWeight: 500 }}
                      >
                        {tConn('createQuoted', { name: qTrim })}
                      </span>
                    </button>
                  </div>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
      </motion.div>
    </div>
  );
}

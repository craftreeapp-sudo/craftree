'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import { useAuthStore } from '@/stores/auth-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { formatYear } from '@/lib/utils';
import { getCategoryColor } from '@/lib/colors';
import {
  NodeEditForm,
  createEmptyFormState,
  seedNodeToFormState,
  type NodeEditFormState,
} from '@/components/editor/NodeEditForm';
import { ImageUploader } from '@/components/ui/ImageUploader';
import type {
  NodeCategory,
  RelationType,
  TechNodeType,
  CraftingLink,
  TechNodeBasic,
  SeedNode,
  TechNodeDetails,
  Era,
} from '@/lib/types';
import { isRtlLocale } from '@/lib/i18n-config';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import {
  SuggestionNodeForm,
  type SuggestNodeFormState,
} from '@/components/ui/SuggestionNodeForm';
import { computeDiff } from '@/lib/suggestion-diff';
import { useToastStore } from '@/stores/toast-store';
import { NodeCategory as NC, Era as EraEnum } from '@/lib/types';

const RELATION_DOT: Record<RelationType, string> = {
  material: '#94A3B8',
  tool: '#A78BFA',
  energy: '#EF4444',
  knowledge: '#38BDF8',
  catalyst: 'rgba(139, 149, 168, 0.5)',
};

const staggerParent = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, x: 14 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function NodeDetailSidebar() {
  const locale = useLocale();
  const isRtl = isRtlLocale(locale);
  const tExplore = useTranslations('explore');
  const tSidebar = useTranslations('sidebar');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tTypes = useTranslations('types');
  const tCat = useTranslations('categories');

  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const { navigateToNode, closeDetail } = useExploreNavigation();

  const getNodeById = useGraphStore((s) => s.getNodeById);
  const updateNode = useGraphStore((s) => s.updateNode);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const getRecipeForNode = useGraphStore((s) => s.getRecipeForNode);
  const getUsagesOfNode = useGraphStore((s) => s.getUsagesOfNode);
  const refreshData = useGraphStore((s) => s.refreshData);
  const setLoginModalOpen = useUIStore((s) => s.setLoginModalOpen);
  const pushToast = useToastStore((s) => s.pushToast);
  const { isAdmin, user } = useAuthStore();

  const node = selectedNodeId ? getNodeById(selectedNodeId) : undefined;

  const [editMode, setEditMode] = useState(false);
  const [suggestMode, setSuggestMode] = useState(false);
  const [suggestForm, setSuggestForm] = useState<SuggestNodeFormState>(() => ({
    name: '',
    description: '',
    category: NC.MATERIAL,
    type: 'component',
    era: EraEnum.MODERN,
    year_approx: '',
    origin: '',
  }));
  const [originalSnapshot, setOriginalSnapshot] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [suggestSubmitting, setSuggestSubmitting] = useState(false);
  const [sidebarImageError, setSidebarImageError] = useState(false);
  const [form, setForm] = useState<NodeEditFormState>(() =>
    createEmptyFormState()
  );
  const [editorNodes, setEditorNodes] = useState<SeedNode[]>([]);
  const [editorLinks, setEditorLinks] = useState<CraftingLink[]>([]);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const loadEditorData = useCallback(async () => {
    const [nr, lr] = await Promise.all([
      fetch('/api/nodes'),
      fetch('/api/links'),
    ]);
    const nj = await nr.json();
    const lj = await lr.json();
    const nodes = (nj.nodes ?? []) as SeedNode[];
    const links = (lj.links ?? []) as CraftingLink[];
    setEditorNodes(nodes);
    setEditorLinks(links);
    return { nodes, links };
  }, []);

  const refreshEditorData = useCallback(async () => {
    await loadEditorData();
  }, [loadEditorData]);

  const enterEdit = useCallback(async () => {
    if (!node) return;
    const { nodes } = await loadEditorData();
    const seed = nodes.find((n) => n.id === node.id);
    if (seed) setForm(seedNodeToFormState(seed));
    else setForm(createEmptyFormState());
    setEditMode(true);
  }, [node, loadEditorData]);

  useEffect(() => {
    if (!selectedNodeId) {
      setEditMode(false);
      setSuggestMode(false);
      return;
    }
    const st = useUIStore.getState();
    if (st.pendingExploreEdit) {
      st.clearPendingExploreEdit();
      void enterEdit();
    } else {
      setEditMode(false);
      setSuggestMode(false);
    }
    // Intentionnel : pas de dépendance à enterEdit (évite de fermer l’édition au refresh / save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  const snapshotFromForm = useCallback((f: SuggestNodeFormState) => {
    return {
      name: f.name.trim(),
      description: f.description.trim(),
      category: f.category,
      type: f.type,
      era: f.era,
      year_approx:
        f.year_approx.trim() === '' ? null : Number(f.year_approx.trim()),
      origin: f.origin.trim(),
    } as Record<string, unknown>;
  }, []);

  const enterSuggestMode = useCallback(async () => {
    if (!node) return;
    const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}`);
    if (!res.ok) return;
    const json = (await res.json()) as { node: SeedNode };
    const seed = json.node;
    setSuggestForm({
      name: seed.name,
      description: seed.description ?? '',
      category: seed.category as NodeCategory,
      type: seed.type as TechNodeType,
      era: seed.era as Era,
      year_approx:
        seed.year_approx === undefined || seed.year_approx === null
          ? ''
          : String(seed.year_approx),
      origin: seed.origin ?? '',
    });
    const snap = snapshotFromForm({
      name: seed.name,
      description: seed.description ?? '',
      category: seed.category as NodeCategory,
      type: seed.type as TechNodeType,
      era: seed.era as Era,
      year_approx:
        seed.year_approx === undefined || seed.year_approx === null
          ? ''
          : String(seed.year_approx),
      origin: seed.origin ?? '',
    });
    setOriginalSnapshot(snap);
    setSuggestMode(true);
  }, [node, snapshotFromForm]);

  const handleSuggestCorrection = useCallback(() => {
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    void enterSuggestMode();
  }, [user, setLoginModalOpen, enterSuggestMode]);

  const cancelSuggestMode = useCallback(() => {
    setSuggestMode(false);
    setOriginalSnapshot(null);
  }, []);

  const submitSuggestion = useCallback(async () => {
    if (!node || !originalSnapshot) return;
    setSuggestSubmitting(true);
    try {
      const proposed = snapshotFromForm(suggestForm);
      const diff = computeDiff(originalSnapshot, proposed);
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_type: 'edit_node',
          node_id: node.id,
          data: {
            original: originalSnapshot,
            proposed,
            diff,
          },
        }),
      });
      if (!res.ok) {
        pushToast(
          (await res.json().catch(() => ({})))?.error ?? 'Erreur',
          'error'
        );
        return;
      }
      pushToast(tAuth('suggestionSent'), 'success');
      setSuggestMode(false);
      setOriginalSnapshot(null);
    } finally {
      setSuggestSubmitting(false);
    }
  }, [
    node,
    originalSnapshot,
    suggestForm,
    snapshotFromForm,
    pushToast,
    tAuth,
  ]);

  const saveEdit = useCallback(async () => {
    if (!node) return;
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
    if (!body.name || !body.description) return;
    const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    setEditMode(false);
    await refreshData();
  }, [node, form, refreshData]);

  const recipeLinks = useMemo(
    () => (node ? getRecipeForNode(node.id) : []),
    [node, getRecipeForNode]
  );

  const usages = useMemo(
    () => (node ? getUsagesOfNode(node.id) : []),
    [node, getUsagesOfNode]
  );

  const detailsById = useNodeDetailsStore((s) => s.byId);
  const patchDetail = useNodeDetailsStore((s) => s.patchDetail);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const getNodeDetails = useGraphStore((s) => s.getNodeDetails);

  useEffect(() => {
    if (!isSidebarOpen || !selectedNodeId) return;
    let cancelled = false;
    void getNodeDetails(selectedNodeId).then((d) => {
      if (!cancelled && d) mergeDetail(selectedNodeId, d);
    });
    return () => {
      cancelled = true;
    };
  }, [isSidebarOpen, selectedNodeId, getNodeDetails, mergeDetail]);

  const handleShare = useCallback(() => {
    if (!node) return;
    const url = `${window.location.origin}/invention/${encodeURIComponent(node.id)}`;
    void navigator.clipboard.writeText(url);
    pushToast(tCommon('linkCopied'), 'success');
  }, [node, pushToast, tCommon]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreMenuRef.current?.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreMenuOpen]);

  useEffect(() => {
    setMoreMenuOpen(false);
  }, [selectedNodeId]);

  const detail = node ? detailsById[node.id] : undefined;

  const sidebarDescription = useMemo(() => {
    if (!detail) return '—';
    if (locale === 'fr') return detail.description?.trim() || '—';
    const en = detail.description_en?.trim();
    if (en) return en;
    return detail.description?.trim() || '—';
  }, [detail, locale]);

  const categoryColor = node ? getCategoryColor(node.category) : '#3B82F6';
  const yearLine = formatYear(node?.year_approx);

  const sidebarImageBust = node ? imageBustByNodeId[node.id] ?? 0 : 0;
  const sidebarImageUrl = node?.image_url ?? detail?.image_url;
  const sidebarImageSrc =
    sidebarImageUrl && sidebarImageBust > 0
      ? `${sidebarImageUrl}${sidebarImageUrl.includes('?') ? '&' : '?'}t=${sidebarImageBust}`
      : sidebarImageUrl;
  const sidebarImageUnoptimized =
    Boolean(sidebarImageUrl?.startsWith('/images/')) ||
    Boolean(sidebarImageUrl?.includes('placehold.co')) ||
    Boolean(sidebarImageUrl?.startsWith('http://localhost')) ||
    Boolean(sidebarImageUrl?.startsWith('https://localhost'));

  useEffect(() => {
    setSidebarImageError(false);
  }, [node?.id, sidebarImageSrc]);

  const hasDetailMetaAboveDescription =
    Boolean(yearLine) ||
    Boolean(node?.origin?.trim() || detail?.origin?.trim()) ||
    Boolean(node);

  return (
    <>
      {isSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 top-14 z-[51] bg-black/50 lg:hidden"
          aria-label={tSidebar('closePanel')}
          onClick={closeDetail}
        />
      ) : null}
      <motion.aside
        className={`fixed top-14 z-[52] flex h-[calc(100dvh-3.5rem)] w-[min(90vw,340px)] flex-col border-[#2A3042] bg-[#1A1F2E] shadow-xl md:w-[340px] ${
          isRtl
            ? 'left-0 border-r'
            : 'right-0 border-l'
        } ${!isSidebarOpen ? 'pointer-events-none' : ''}`}
        style={{ willChange: 'transform' }}
        initial={false}
        animate={{
          x: isSidebarOpen
            ? 0
            : isRtl
              ? '-100%'
              : '100%',
        }}
        transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
        aria-hidden={!isSidebarOpen}
      >
        {!node ? null : (
          <motion.div
            key={node.id}
            className="flex min-h-0 flex-1 flex-col"
            variants={staggerParent}
            initial="hidden"
            animate={isSidebarOpen ? 'show' : 'hidden'}
          >
            {editMode ? (
              <>
                <motion.div
                  variants={staggerItem}
                  className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-[#2A3042] bg-[#1A1F2E] px-4 py-4"
                >
                  <h2 className="text-lg font-semibold text-[#E8ECF4]">
                    {tCommon('edit')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="shrink-0 rounded p-1.5 text-[#8B95A8] transition-colors hover:bg-[#2A3042] hover:text-[#E8ECF4]"
                    aria-label={tSidebar('backToDetail')}
                  >
                    <span className="text-xl leading-none">×</span>
                  </button>
                </motion.div>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4 pt-4">
                  <div className="mb-4 w-full shrink-0">
                    <ImageUploader
                      nodeId={node.id}
                      currentImageUrl={
                        editorNodes.find((n) => n.id === node.id)?.image_url ??
                        node.image_url ??
                        detail?.image_url ??
                        null
                      }
                      size="small"
                      onUploadSuccess={(newImageUrl) => {
                        updateNode(node.id, { image_url: newImageUrl });
                        setEditorNodes((prev) =>
                          prev.map((n) =>
                            n.id === node.id ? { ...n, image_url: newImageUrl } : n
                          )
                        );
                        patchDetail(node.id, { image_url: newImageUrl });
                      }}
                    />
                  </div>
                  <NodeEditForm
                    editingId={node.id}
                    form={form}
                    setForm={setForm}
                    nodes={editorNodes}
                    links={editorLinks}
                    onRefreshData={refreshEditorData}
                    onSave={() => void saveEdit()}
                    onCancel={() => setEditMode(false)}
                  />
                </div>
              </>
            ) : suggestMode ? (
              <>
                <motion.div
                  variants={staggerItem}
                  className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 border-b border-[#2A3042] bg-[#1A1F2E] px-4 py-4"
                >
                  <h2 className="text-lg font-semibold text-[#E8ECF4]">
                    {tAuth('suggestCorrection')}
                  </h2>
                  <button
                    type="button"
                    onClick={cancelSuggestMode}
                    className="shrink-0 rounded p-1.5 text-[#8B95A8] transition-colors hover:bg-[#2A3042] hover:text-[#E8ECF4]"
                    aria-label={tSidebar('backToDetail')}
                  >
                    <span className="text-xl leading-none">×</span>
                  </button>
                </motion.div>
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4 pt-4">
                  <SuggestionNodeForm form={suggestForm} setForm={setSuggestForm} />
                  <div className="mt-6 flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={suggestSubmitting}
                      onClick={() => void submitSuggestion()}
                      className="rounded-lg bg-[#F59E0B] px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-50"
                    >
                      {tAuth('sendSuggestion')}
                    </button>
                    <button
                      type="button"
                      onClick={cancelSuggestMode}
                      className="py-2 text-sm text-[#8B95A8] transition-colors hover:text-[#E8ECF4]"
                    >
                      {tCommon('cancel')}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <motion.div
                  variants={staggerItem}
                  className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-2 border-b border-[#2A3042] bg-[#1A1F2E] px-4 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <h2
                      className="text-[18px] font-bold leading-tight text-[#E8ECF4]"
                      style={{
                        fontFamily:
                          'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
                      }}
                    >
                      {pickNodeDisplayName(
                        locale,
                        node.name,
                        detail?.name_en
                      )}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span
                        className="inline-block rounded px-2 py-0.5 text-xs font-medium capitalize"
                        style={{
                          backgroundColor: `${categoryColor}28`,
                          color: categoryColor,
                        }}
                      >
                        {tCat(node.category as NodeCategory)}
                      </span>
                      <span className="rounded bg-[#111827] px-2 py-0.5 text-xs text-[#8B95A8]">
                        {tTypes(node.type)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => void enterEdit()}
                        className="rounded p-1.5 text-[#8B95A8] transition-colors hover:bg-[#2A3042] hover:text-[#E8ECF4]"
                        aria-label={tSidebar('editInvention')}
                      >
                        <span className="text-base leading-none">✏️</span>
                      </button>
                    ) : null}
                    <div className="relative" ref={moreMenuRef}>
                      <button
                        type="button"
                        onClick={() => setMoreMenuOpen((v) => !v)}
                        aria-expanded={moreMenuOpen}
                        aria-haspopup="menu"
                        aria-label={tSidebar('moreActions')}
                        className="rounded p-1.5 text-[#8B95A8] transition-colors hover:bg-[#2A3042] hover:text-[#E8ECF4]"
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden
                        >
                          <circle cx="12" cy="6" r="1.75" />
                          <circle cx="12" cy="12" r="1.75" />
                          <circle cx="12" cy="18" r="1.75" />
                        </svg>
                      </button>
                      {moreMenuOpen ? (
                        <div
                          className="absolute end-0 top-[calc(100%+6px)] z-[60] min-w-[180px] rounded-md border border-[#2A3042] bg-[#1A1F2E] py-1 shadow-lg"
                          role="menu"
                        >
                          {detail?.wikipedia_url ? (
                            <a
                              href={detail.wikipedia_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-3 py-2 text-[13px] text-[#E8ECF4] hover:bg-[#2A3042]"
                              role="menuitem"
                              onClick={() => setMoreMenuOpen(false)}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="shrink-0 text-[#8B95A8]"
                                aria-hidden
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              {tSidebar('wikipedia')}
                            </a>
                          ) : null}
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] text-[#E8ECF4] hover:bg-[#2A3042]"
                            role="menuitem"
                            onClick={() => {
                              handleShare();
                              setMoreMenuOpen(false);
                            }}
                          >
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="shrink-0 text-[#8B95A8]"
                              aria-hidden
                            >
                              <path d="M7 7h10v10" />
                              <path d="M7 17 17 7" />
                            </svg>
                            {tCommon('share')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={closeDetail}
                      className="shrink-0 rounded p-1.5 text-[#8B95A8] transition-colors hover:bg-[#2A3042] hover:text-[#E8ECF4]"
                      aria-label={tSidebar('closePanel')}
                    >
                      <span className="text-xl leading-none">×</span>
                    </button>
                  </div>
                </motion.div>

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
              {node ? (
                <motion.div
                  variants={staggerItem}
                  className="mb-4 w-full shrink-0 overflow-hidden rounded-lg"
                >
                  {sidebarImageSrc && !sidebarImageError ? (
                    <Image
                      src={sidebarImageSrc}
                      alt=""
                      width={340}
                      height={200}
                      className="max-h-[200px] w-full object-cover"
                      loading="lazy"
                      placeholder="empty"
                      unoptimized={sidebarImageUnoptimized}
                      onError={() => setSidebarImageError(true)}
                    />
                  ) : (
                    <div
                      className="flex min-h-[120px] w-full items-center justify-center px-4 py-6 text-center text-[15px] font-semibold leading-snug text-white"
                      style={{ backgroundColor: categoryColor }}
                    >
                      <span className="line-clamp-5">
                        {pickNodeDisplayName(
                          locale,
                          node.name,
                          detail?.name_en
                        )}
                      </span>
                    </div>
                  )}
                </motion.div>
              ) : null}

              {yearLine ? (
                <motion.p
                  variants={staggerItem}
                  className="text-sm text-[#8B95A8]"
                >
                  {yearLine}
                </motion.p>
              ) : null}

              {(node.origin?.trim() || detail?.origin?.trim()) ? (
                <motion.p
                  variants={staggerItem}
                  className={`text-[13px] text-[#8B95A8] ${yearLine ? 'mt-2' : ''}`}
                >
                  {(node.origin ?? detail?.origin ?? '').trim()}
                </motion.p>
              ) : null}

              <motion.p
                variants={staggerItem}
                className={`text-sm leading-relaxed text-[#8B95A8] ${
                  hasDetailMetaAboveDescription ? 'mt-4' : ''
                }`}
              >
                {sidebarDescription}
              </motion.p>

              {!isAdmin ? (
                <motion.div variants={staggerItem} className="mt-4">
                  <button
                    type="button"
                    onClick={handleSuggestCorrection}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/45 bg-amber-950/40 px-4 py-2.5 text-sm font-medium text-amber-200 shadow-sm transition-colors hover:border-amber-400/55 hover:bg-amber-950/55"
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
                      <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>{tAuth('suggestCorrection')}</span>
                  </button>
                </motion.div>
              ) : null}

              <motion.section variants={staggerItem} className="mt-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B95A8]">
                  {tExplore('builtUpon')} ({recipeLinks.length})
                </h3>
                {recipeLinks.length === 0 ? (
                  <p className="text-sm text-[#8B95A8]">
                    {tExplore('noUpstream')}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {recipeLinks.map((link) => (
                      <RecipeRow
                        key={link.id}
                        link={link}
                        getNodeById={getNodeById}
                        locale={locale}
                        detailsById={detailsById}
                        onSelectIngredient={(id) =>
                          navigateToNode(id, { center: false })
                        }
                      />
                    ))}
                  </ul>
                )}
              </motion.section>

              <motion.section variants={staggerItem} className="mt-6">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8B95A8]">
                  {tExplore('ledTo')} ({usages.length})
                </h3>
                {usages.length === 0 ? (
                  <p className="text-sm text-[#8B95A8]">
                    {tExplore('noDownstream')}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {usages.map(({ link, product }) => (
                      <li key={link.id}>
                        <button
                          type="button"
                          onClick={() =>
                            navigateToNode(product.id, { center: false })
                          }
                          className="w-full rounded-md border border-transparent px-2 py-2 text-start text-sm text-[#3B82F6] transition-colors hover:border-[#2A3042] hover:bg-[#111827]"
                        >
                          {pickNodeDisplayName(
                            locale,
                            product.name,
                            detailsById[product.id]?.name_en
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
                </div>
              </>
            )}
          </motion.div>
        )}
      </motion.aside>
    </>
  );
}

function RecipeRow({
  link,
  getNodeById,
  onSelectIngredient,
  locale,
  detailsById,
}: {
  link: CraftingLink;
  getNodeById: (id: string) => TechNodeBasic | undefined;
  onSelectIngredient: (id: string) => void;
  locale: string;
  detailsById: Record<string, TechNodeDetails | undefined>;
}) {
  const tRel = useTranslations('relationTypes');
  const tEx = useTranslations('explore');
  const input = getNodeById(link.source_id);
  const rel = link.relation_type as RelationType;
  const dotColor =
    rel === 'material' && input
      ? getCategoryColor(input.category as NodeCategory)
      : RELATION_DOT[rel];
  const relLabel = tRel(rel);

  return (
    <li className="flex gap-3 rounded-md border border-[#2A3042]/80 bg-[#111827]/40 px-2 py-2">
      <span
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
        style={{
          backgroundColor: dotColor,
          opacity: rel === 'catalyst' ? 0.6 : 1,
        }}
        title={relLabel}
      />
      <div className="min-w-0 flex-1">
        {input ? (
          <button
            type="button"
            onClick={() => onSelectIngredient(input.id)}
            className="text-start text-sm font-medium text-[#3B82F6] hover:underline"
          >
            {pickNodeDisplayName(
              locale,
              input.name,
              detailsById[input.id]?.name_en
            )}
          </button>
        ) : (
          <span className="text-sm text-[#E8ECF4]">{link.source_id}</span>
        )}
        <p className="mt-0.5 text-xs text-[#8B95A8]">
          {relLabel}
          {link.quantity_hint ? ` · ${link.quantity_hint}` : ''}
          {link.is_optional ? ` · ${tEx('optional')}` : ''}
        </p>
        {link.notes && (
          <p className="mt-1 text-xs italic text-[#8B95A8]/80">{link.notes}</p>
        )}
      </div>
    </li>
  );
}

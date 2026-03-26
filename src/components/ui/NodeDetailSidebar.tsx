'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { formatYear } from '@/lib/utils';
import { getCategoryColor } from '@/lib/colors';
import { IMAGE_BLUR_DATA_URL } from '@/lib/image-placeholder';
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
} from '@/lib/types';
import { isRtlLocale } from '@/lib/i18n-config';
import { pickNodeDisplayName } from '@/lib/node-display-name';

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

  const node = selectedNodeId ? getNodeById(selectedNodeId) : undefined;

  const [editMode, setEditMode] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const [form, setForm] = useState<NodeEditFormState>(() =>
    createEmptyFormState()
  );
  const [editorNodes, setEditorNodes] = useState<SeedNode[]>([]);
  const [editorLinks, setEditorLinks] = useState<CraftingLink[]>([]);

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
      return;
    }
    const st = useUIStore.getState();
    if (st.pendingExploreEdit) {
      st.clearPendingExploreEdit();
      void enterEdit();
    } else {
      setEditMode(false);
    }
    // Intentionnel : pas de dépendance à enterEdit (évite de fermer l’édition au refresh / save).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

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

  useEffect(() => {
    if (!shareToast) return;
    const t = setTimeout(() => setShareToast(false), 2000);
    return () => clearTimeout(t);
  }, [shareToast]);

  const handleShare = useCallback(() => {
    if (!node) return;
    const url = `${window.location.origin}/invention/${encodeURIComponent(node.id)}`;
    void navigator.clipboard.writeText(url);
    setShareToast(true);
  }, [node]);

  const detail = node ? detailsById[node.id] : undefined;

  const categoryColor = node ? getCategoryColor(node.category) : '#3B82F6';
  const yearLine = formatYear(node?.year_approx);

  const sidebarImageBust = node ? imageBustByNodeId[node.id] ?? 0 : 0;
  const sidebarImageUrl = node?.image_url ?? detail?.image_url;
  const sidebarImageSrc =
    sidebarImageUrl && sidebarImageBust > 0
      ? `${sidebarImageUrl}${sidebarImageUrl.includes('?') ? '&' : '?'}t=${sidebarImageBust}`
      : sidebarImageUrl;

  return (
    <>
      {shareToast ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-[#2A3042] bg-[#1A1F2E] px-4 py-2.5 text-sm text-[#E8ECF4] shadow-lg"
          role="status"
        >
          {tCommon('linkCopied')}
        </div>
      ) : null}
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
                    <button
                      type="button"
                      onClick={() => void enterEdit()}
                      className="rounded p-1.5 text-[#8B95A8] transition-colors hover:bg-[#2A3042] hover:text-[#E8ECF4]"
                      aria-label={tSidebar('editInvention')}
                    >
                      <span className="text-base leading-none">✏️</span>
                    </button>
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

              {sidebarImageSrc ? (
                <motion.div
                  variants={staggerItem}
                  className="mt-4 overflow-hidden rounded-lg border border-[#2A3042]"
                >
                  <Image
                    src={sidebarImageSrc}
                    alt=""
                    width={340}
                    height={200}
                    className="h-auto w-full object-cover"
                    loading="lazy"
                    placeholder="blur"
                    blurDataURL={IMAGE_BLUR_DATA_URL}
                    unoptimized
                  />
                </motion.div>
              ) : null}

              <motion.p
                variants={staggerItem}
                className="mt-4 text-sm leading-relaxed text-[#8B95A8]"
              >
                {detail?.description ?? '—'}
              </motion.p>

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

              {detail?.wikipedia_url && (
                <motion.div variants={staggerItem} className="mt-6">
                  <a
                    href={detail.wikipedia_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#8B95A8] underline-offset-2 transition-colors hover:text-[#3B82F6] hover:underline"
                  >
                    {tSidebar('wikipedia')} →
                  </a>
                </motion.div>
              )}

              <motion.div variants={staggerItem} className="mt-6 space-y-2">
                <Link
                  href={`/tree/${node.id}`}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-[#3B82F6]/40 bg-[#3B82F6]/10 px-3 py-2.5 text-sm font-medium text-[#3B82F6] transition-colors hover:bg-[#3B82F6]/20"
                >
                  {tExplore('seeFullTree')}
                </Link>
                <button
                  type="button"
                  onClick={() => handleShare()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#2A3042] bg-[#111827]/60 px-3 py-2.5 text-sm font-medium text-[#E8ECF4] transition-colors hover:border-[#3B82F6]/40 hover:bg-[#1A1F2E]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-[#8B95A8]"
                    aria-hidden
                  >
                    <path d="M7 7h10v10" />
                    <path d="M7 17 17 7" />
                  </svg>
                  {tCommon('share')}
                </button>
              </motion.div>
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

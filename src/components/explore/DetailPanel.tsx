'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore, getNodeDetails } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';
import { rowIsDraft } from '@/lib/draft-flag';
import { formatYear } from '@/lib/utils';
import { getCategoryColor } from '@/lib/colors';
import { trackEvent } from '@/lib/analytics';
import {
  pickNodeDisplayName,
  pickNodeDescriptionForLocale,
} from '@/lib/node-display-name';
import type { NodeCategory, SeedNode, TechNodeDetails } from '@/lib/types';
import { SuggestNodeCorrectionPanel } from '@/components/ui/SuggestNodeCorrectionPanel';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { getTagDisplayLabel } from '@/lib/tag-display';
import {
  chemicalNatureToExploreKey,
  naturalOriginToExploreKey,
} from '@/lib/explore-classification-badges';
import {
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';
import {
  ExploreExtendedPeerRow,
  ExploreLedToRow,
  ExploreRecipeRow,
} from '@/components/explore/ExploreDetailLinkRows';
import { CardImagePlaceholder } from '@/components/explore/CardImagePlaceholder';
import { ShareInventionButton } from '@/components/explore/ShareInventionButton';
import { findDuplicatePeerNodeId } from '@/lib/editor-duplicates';
import { BuiltUponBadgePopover } from '@/components/explore/BuiltUponBadgePopover';
import {
  effectiveDimension,
  effectiveMaterialLevel,
} from '@/lib/node-dimension-helpers';
import { EDITOR_DIM_KEY, EDITOR_LEVEL_KEY } from '@/components/editor/dimension-editor-keys';
import { EXPLORE_DETAIL_PANEL_WIDTH_PX } from '@/lib/explore-layout';
import { treeInventionPath } from '@/lib/tree-routes';
import { AIReviewButton } from '@/components/admin/AIReviewButton';
import { rowIsLocked, seedNodeIsLocked } from '@/lib/node-lock';
import {
  buildExtendedDownstreamPeerInfos,
  buildExtendedUpstreamPeerInfos,
} from '@/lib/built-upon-utils';
import { useUIStore } from '@/stores/ui-store';
const TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };

export function ExploreDetailPanel() {
  const router = useRouter();
  const ctx = useExploreCardOptional();
  const locale = useLocale();
  const tExplore = useTranslations('explore');
  const tSidebar = useTranslations('sidebar');
  const tAuth = useTranslations('auth');
  const tCat = useTranslations('categories');
  const tEd = useTranslations('editor');
  const tCommon = useTranslations('common');

  const graphNodes = useGraphStore((s) => s.nodes);
  const graphEdges = useGraphStore((s) => s.edges);
  const getRecipeForNode = useGraphStore((s) => s.getRecipeForNode);
  const getUsagesOfNode = useGraphStore((s) => s.getUsagesOfNode);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const detailsById = useNodeDetailsStore((s) => s.byId);
  const { isAdmin } = useAuthStore();
  const pushToast = useToastStore((s) => s.pushToast);
  const refreshData = useGraphStore((s) => s.refreshData);
  const updateNode = useGraphStore((s) => s.updateNode);

  const linkNeighborhoodMode = useUIStore((s) => s.linkNeighborhoodMode);
  const showExtended = linkNeighborhoodMode === 'direct_and_extended';

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const detailAsideRef = useRef<HTMLElement | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [lockSaving, setLockSaving] = useState(false);
  const [mainImgErr, setMainImgErr] = useState(false);
  const [ledToOpen, setLedToOpen] = useState(true);
  const [builtUponOpen, setBuiltUponOpen] = useState(true);

  const detailNodeId = ctx?.detailNodeId ?? null;
  const detailSubview = ctx?.detailSubview ?? 'detail';
  const isMobile = ctx?.isMobile ?? false;

  const node = useGraphStore((s) =>
    detailNodeId ? s.nodes.find((n) => n.id === detailNodeId) : undefined
  );
  const getNodeById = useCallback(
    (id: string) => useGraphStore.getState().getNodeById(id),
    []
  );
  const detail: TechNodeDetails | undefined = node
    ? detailsById[node.id]
    : undefined;

  useEffect(() => {
    if (!detailNodeId) return;
    let cancelled = false;
    void getNodeDetails(detailNodeId).then((d) => {
      if (!cancelled && d) mergeDetail(detailNodeId, d);
    });
    return () => {
      cancelled = true;
    };
  }, [detailNodeId, mergeDetail]);

  /** Complète naturalOrigin / chemicalNature dans le graphe depuis la fiche API (projection locale parfois incomplète). */
  useEffect(() => {
    if (!detailNodeId) return;
    let cancelled = false;
    void fetch(`/api/nodes/${encodeURIComponent(detailNodeId)}`, {
      credentials: 'same-origin',
    })
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { node?: SeedNode };
        if (cancelled || !json.node) return;
        const n = json.node;
        const no = parseNaturalOrigin(
          n.naturalOrigin != null ? String(n.naturalOrigin) : undefined
        );
        const cn = parseChemicalNature(
          n.chemicalNature != null ? String(n.chemicalNature) : undefined
        );
        if (cancelled) return;
        if (no === '' && cn === '') return;
        updateNode(detailNodeId, {
          ...(no !== '' ? { naturalOrigin: no } : {}),
          ...(cn !== '' ? { chemicalNature: cn } : {}),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [detailNodeId, updateNode]);

  /* Réinitialise menu / image quand on change d’invention dans le panneau */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset explicite au changement de cible
    setMoreOpen(false);
    setMainImgErr(false);
    setLedToOpen(true);
    setBuiltUponOpen(true);
  }, [detailNodeId]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  /** Clic « dans le vide » : quitter l’édition admin, revenir à la fiche détail. */
  useEffect(() => {
    if (detailSubview !== 'adminEdit' || !isAdmin || !ctx) return;
    const onPointerDownCapture = (e: PointerEvent) => {
      const aside = detailAsideRef.current;
      if (!aside) return;
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (aside.contains(t)) return;
      ctx.closeSuggestSubview();
    };
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDownCapture, true);
  }, [detailSubview, isAdmin, ctx]);

  const enterSuggest = useCallback(() => {
    if (!node) return;
    ctx?.openSuggestSubview();
  }, [node, ctx]);

  const enterEdit = useCallback(() => {
    if (!node) return;
    ctx?.openAdminEditSubview();
  }, [node, ctx]);

  const shareDetailToClipboard = useCallback(() => {
    if (!node) return;
    trackEvent('share', node.id);
    const url = `${window.location.origin}/invention/${encodeURIComponent(node.id)}`;
    void navigator.clipboard.writeText(url);
    pushToast(tCommon('linkCopied'), 'success');
    setMoreOpen(false);
  }, [node, pushToast, tCommon]);

  const toggleDraftStatus = useCallback(async () => {
    if (!node) return;
    setDraftSaving(true);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ is_draft: !node.is_draft }),
      });
      if (!res.ok) {
        let msg = tEd('toastSaveError');
        try {
          const errBody = (await res.json()) as { message?: string };
          if (errBody.message) msg = errBody.message;
        } catch {
          /* ignore */
        }
        pushToast(msg, 'error');
        return;
      }
      const json = (await res.json()) as { node?: Record<string, unknown> };
      await refreshData();
      if (json.node) {
        updateNode(node.id, {
          is_draft: rowIsDraft(json.node),
        });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('craftree:editor-refresh'));
      }
      setMoreOpen(false);
    } catch {
      pushToast(tEd('toastNetworkError'), 'error');
    } finally {
      setDraftSaving(false);
    }
  }, [node, refreshData, updateNode, pushToast, tEd]);

  const toggleLockStatus = useCallback(async () => {
    if (!node) return;
    setLockSaving(true);
    try {
      const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ is_locked: !node.is_locked }),
      });
      if (!res.ok) {
        let msg = tEd('toastSaveError');
        try {
          const errBody = (await res.json()) as {
            message?: string;
            error?: string;
          };
          if (errBody.message) msg = errBody.message;
          else if (errBody.error) msg = errBody.error;
        } catch {
          /* ignore */
        }
        pushToast(msg, 'error');
        return;
      }
      const json = (await res.json()) as { node?: Record<string, unknown> };
      await refreshData();
      if (json.node) {
        updateNode(node.id, {
          is_locked: rowIsLocked(json.node),
        });
      }
      pushToast(
        node.is_locked ? tEd('toastNodeUnlocked') : tEd('toastNodeLocked'),
        'success'
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('craftree:editor-refresh'));
      }
      setMoreOpen(false);
    } catch {
      pushToast(tEd('toastNetworkError'), 'error');
    } finally {
      setLockSaving(false);
    }
  }, [node, refreshData, updateNode, pushToast, tEd]);

  const displayName = useMemo(() => {
    if (!node) return '';
    return pickNodeDisplayName(locale, node.name, detail?.name_en);
  }, [locale, node, detail?.name_en]);

  const description = useMemo(() => {
    if (!detail) return '—';
    return pickNodeDescriptionForLocale(
      locale,
      detail.description,
      detail.description_en
    );
  }, [detail, locale]);

  const categoryColor = node ? getCategoryColor(node.category as NodeCategory) : '#3B82F6';

  const imageUrl = node?.image_url ?? detail?.image_url;
  const bust = node ? imageBustByNodeId[node.id] ?? 0 : 0;
  const imageSrc =
    imageUrl && bust > 0
      ? `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${bust}`
      : imageUrl;
  const imageUnoptimized =
    Boolean(imageUrl?.startsWith('/images/')) ||
    Boolean(imageUrl?.includes('placehold.co')) ||
    Boolean(imageUrl?.startsWith('http://localhost')) ||
    Boolean(imageUrl?.startsWith('https://localhost')) ||
    Boolean(imageUrl?.startsWith('https://upload.wikimedia.org'));

  const extraThumbs = useMemo(() => {
    const raw = detail?.extra_image_urls?.filter(Boolean) ?? [];
    return raw.slice(0, 5);
  }, [detail?.extra_image_urls]);

  const secondaryTags = useMemo(() => {
    if (!node) return [];
    const a = [...(node.tags ?? []), ...(detail?.tags ?? [])];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of a) {
      const s = t.trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }, [node, detail?.tags]);

  const natureLine = useMemo(() => {
    if (!node) return '';
    const dim = effectiveDimension(node);
    const dLabel = tEd(EDITOR_DIM_KEY[dim]);
    if (dim === 'matter') {
      const ml = effectiveMaterialLevel(node);
      const lvl = ml ? tEd(EDITOR_LEVEL_KEY[ml]) : '';
      return lvl ? `${dLabel} · ${lvl}` : dLabel;
    }
    return dLabel;
  }, [node, tEd]);

  const pillNaturalOrigin = useMemo(() => {
    if (!node) return null;
    const p = parseNaturalOrigin(node.naturalOrigin as string | undefined);
    return p === '' ? null : p;
  }, [node]);

  const pillChemicalNature = useMemo(() => {
    if (!node) return null;
    const p = parseChemicalNature(node.chemicalNature as string | undefined);
    return p === '' ? null : p;
  }, [node]);

  const originLine = (node?.origin ?? detail?.origin ?? '').trim();

  const recipeLinks = useMemo(
    () => (node ? getRecipeForNode(node.id) : []),
    [node, getRecipeForNode]
  );

  const usages = useMemo(
    () => (node ? getUsagesOfNode(node.id) : []),
    [node, getUsagesOfNode]
  );

  const extendedUpstreamInfos = useMemo(() => {
    if (!node) return [];
    return buildExtendedUpstreamPeerInfos(node.id, graphEdges, graphNodes);
  }, [node, graphEdges, graphNodes]);

  const extendedDownstreamInfos = useMemo(() => {
    if (!node) return [];
    return buildExtendedDownstreamPeerInfos(node.id, graphEdges, graphNodes);
  }, [node, graphEdges, graphNodes]);

  const builtUponBadgeCount = useMemo(() => {
    let n = recipeLinks.length;
    if (showExtended) n += extendedUpstreamInfos.length;
    return n;
  }, [recipeLinks.length, extendedUpstreamInfos.length, showExtended]);

  const ledToSectionCount = useMemo(() => {
    let n = usages.length;
    if (showExtended) n += extendedDownstreamInfos.length;
    return n;
  }, [usages.length, extendedDownstreamInfos.length, showExtended]);

  const duplicatePeerId = useMemo(() => {
    if (!node) return null;
    return findDuplicatePeerNodeId(graphNodes, node.id);
  }, [graphNodes, node]);

  const openPeerDetail = useCallback(
    (id: string, direction: 'upstream' | 'downstream') => {
      if (node) {
        trackEvent('navigate_link', id, {
          from: node.id,
          direction,
        });
      }
      router.push(treeInventionPath(id));
    },
    [router, node]
  );

  const panelInner =
    !node ? null : (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-[15] shrink-0 border-b border-border/90 bg-page/95 pb-3 pt-4 backdrop-blur-md supports-[backdrop-filter]:bg-page/85">
        {/* 1. Titre + badge (nombre de cartes built upon) | actions */}
        <div className="flex min-w-0 shrink-0 items-start gap-x-2 px-5 pb-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2
              id="explore-detail-title"
              className="min-w-0 line-clamp-2 text-xl font-bold leading-tight text-foreground"
              style={{
                fontFamily:
                  'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              }}
            >
              {displayName}
            </h2>
            <BuiltUponBadgePopover
              count={builtUponBadgeCount}
              borderColor={categoryColor}
            />
            {node.is_draft ? (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-orange-500"
                title={tEd('draftRowIndicator')}
                aria-label={tEd('draftRowIndicator')}
              />
            ) : null}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-0.5">
          {!isAdmin ? <ShareInventionButton nodeId={node.id} /> : null}
          {isAdmin ? (
            duplicatePeerId ? (
              <Link
                href={`/admin?duplicates=1&focus=${encodeURIComponent(duplicatePeerId)}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/80 bg-amber-950/45 text-sm text-amber-100 transition-colors hover:bg-amber-950/65"
                title={tEd('detailDuplicateOpenAdminTitle')}
                aria-label={tEd('detailDuplicateOpenAdminTitle')}
              >
                <svg
                  width={18}
                  height={18}
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
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border border-border bg-surface-elevated text-sm text-foreground opacity-60"
                title={tEd('detailDuplicateNoPeer')}
                aria-label={tEd('detailDuplicateNoPeer')}
              >
                <svg
                  width={18}
                  height={18}
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
              </button>
            )
          ) : null}
          {isAdmin ? (
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center [&_button]:h-9 [&_button]:w-9 [&_button]:min-h-0">
              <AIReviewButton
                inventionId={node.id}
                disabled={seedNodeIsLocked(node)}
                onResult={(message, kind) =>
                  pushToast(message, kind === 'ok' ? 'success' : 'error')
                }
              />
            </span>
          ) : null}
          {isAdmin ? (
            <button
              type="button"
              onClick={() => void enterEdit()}
              disabled={seedNodeIsLocked(node)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={tSidebar('editInvention')}
            >
              <svg
                width="20"
                height="20"
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
          ) : null}
          <div className="relative shrink-0" ref={moreRef}>
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-label={tSidebar('moreActions')}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground"
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
              {moreOpen ? (
                <div
                  className="absolute end-0 top-[calc(100%+6px)] z-[90] min-w-[180px] rounded-md glass-surface py-1 shadow-lg"
                  role="menu"
                >
                  {isAdmin ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void shareDetailToClipboard()}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-border/25"
                    >
                      <svg
                        width={18}
                        height={18}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      {tCommon('share')}
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void toggleDraftStatus()}
                      disabled={draftSaving || seedNodeIsLocked(node)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-border/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {node.is_draft ? (
                        <svg
                          width={18}
                          height={18}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0 text-orange-400"
                          aria-hidden
                        >
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                          <path d="m10 13 2 2 4-4" />
                        </svg>
                      ) : (
                        <svg
                          width={18}
                          height={18}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0"
                          aria-hidden
                        >
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="10" y1="13" x2="14" y2="17" />
                          <line x1="14" y1="13" x2="10" y2="17" />
                        </svg>
                      )}
                      {node.is_draft
                        ? tEd('toggleDraftOnline')
                        : tEd('toggleDraftOffline')}
                    </button>
                  ) : null}
                  {isAdmin ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void toggleLockStatus()}
                      disabled={lockSaving}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-border/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {seedNodeIsLocked(node) ? (
                        <svg
                          width={18}
                          height={18}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0 text-amber-300"
                          aria-hidden
                        >
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                        </svg>
                      ) : (
                        <svg
                          width={18}
                          height={18}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="shrink-0"
                          aria-hidden
                        >
                          <rect x="5" y="11" width="14" height="10" rx="2" />
                          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                        </svg>
                      )}
                      {seedNodeIsLocked(node)
                        ? tEd('rowActionUnlock')
                        : tEd('rowActionLock')}
                    </button>
                  ) : null}
                  {detail?.wikipedia_url ? (
                    <a
                      href={detail.wikipedia_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 text-[13px] text-foreground hover:bg-border/25"
                      role="menuitem"
                      onClick={() => setMoreOpen(false)}
                    >
                      {tSidebar('wikipedia')}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* 2. Pastilles : catégorie + nature (matière / procédé / outil & niveau) */}
        <div className="flex flex-wrap gap-2 px-5 pt-1">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: `${categoryColor}35`,
              color: categoryColor,
            }}
          >
            {safeCategoryLabel(tCat, String(node.category))}
          </span>
          <span className="rounded-full bg-border/25 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {natureLine}
          </span>
          {pillNaturalOrigin ? (
            <span className="rounded-full bg-border/25 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {tExplore(naturalOriginToExploreKey(pillNaturalOrigin))}
            </span>
          ) : null}
          {pillChemicalNature ? (
            <span className="rounded-full bg-border/25 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {tExplore(chemicalNatureToExploreKey(pillChemicalNature))}
            </span>
          ) : null}
        </div>
        </header>

        {/* 3. Tags */}
        {secondaryTags.length > 0 ? (
          <div className="mb-5 px-5 pt-4">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {tExplore('detailTagsHeading')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {secondaryTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border/80 bg-surface-elevated/80 px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {getTagDisplayLabel(locale, tag)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* 4. Visuel */}
        <div className="w-full shrink-0 px-5">
          {imageSrc && !mainImgErr ? (
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-page">
              <Image
                src={imageSrc}
                alt=""
                fill
                className="object-cover"
                sizes={`${EXPLORE_DETAIL_PANEL_WIDTH_PX}px`}
                unoptimized={imageUnoptimized}
                onError={() => setMainImgErr(true)}
              />
            </div>
          ) : (
            <CardImagePlaceholder
              categoryColor={categoryColor}
              variant="panel"
            />
          )}
        </div>

        {extraThumbs.length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
            {extraThumbs.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${u}-${i}`}
                src={u}
                alt=""
                className="h-14 w-14 shrink-0 rounded-md object-cover"
              />
            ))}
          </div>
        ) : null}

        {/* 5. Date */}
        <div className="px-5 pt-4 text-sm tabular-nums text-muted-foreground">
          {formatYear(node.year_approx ?? null)}
        </div>

        {/* 6. Origine (contexte) */}
        {originLine ? (
          <p className="px-5 pt-3 text-[13px] leading-snug text-muted-foreground">
            {originLine}
          </p>
        ) : null}

        {/* 7. Description */}
        <p className="px-5 pt-4 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {/* 8. Suggestion */}
        {!isAdmin ? (
          <div className="mt-6 px-5">
            <button
              type="button"
              onClick={() => void enterSuggest()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-amber-500"
            >
              {tAuth('suggestCorrection')}
            </button>
          </div>
        ) : null}

        {/* 9–10. Liens aval / amont */}
        <section className="mt-6 px-5 pb-8">
          <button
            type="button"
            onClick={() => setLedToOpen((v) => !v)}
            className="mb-3 flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-start transition-colors hover:bg-surface/50"
            aria-expanded={ledToOpen}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tExplore('ledTo')} ({ledToSectionCount})
            </h3>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                ledToOpen ? 'rotate-180' : ''
              }`}
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {ledToOpen ? (
            usages.length === 0 &&
            (!showExtended || extendedDownstreamInfos.length === 0) ? (
              <p className="text-sm text-muted-foreground">
                {tExplore('noDownstream')}
              </p>
            ) : (
              <div className="space-y-4">
                {usages.length > 0 ? (
                  <ul className="space-y-3">
                    {usages.map(({ link, product }) => (
                      <ExploreLedToRow
                        key={link.id}
                        link={link}
                        product={product}
                        locale={locale}
                        detailsById={detailsById}
                        imageBust={imageBustByNodeId[product.id] ?? 0}
                        onSelectProduct={(id) => openPeerDetail(id, 'downstream')}
                      />
                    ))}
                  </ul>
                ) : null}
                {showExtended && extendedDownstreamInfos.length > 0 ? (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tExplore('linkNeighborhoodExtended')}
                    </p>
                    <ul className="space-y-3">
                      {extendedDownstreamInfos.map((info) => (
                        <ExploreExtendedPeerRow
                          key={info.peerId}
                          info={info}
                          getNodeById={getNodeById}
                          locale={locale}
                          detailsById={detailsById}
                          imageBust={imageBustByNodeId[info.peerId] ?? 0}
                          onSelectPeer={(id) =>
                            openPeerDetail(id, 'downstream')
                          }
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )
          ) : null}

          <button
            type="button"
            onClick={() => setBuiltUponOpen((v) => !v)}
            className="mb-3 mt-6 flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-start transition-colors hover:bg-surface/50"
            aria-expanded={builtUponOpen}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tExplore('builtUpon')} ({builtUponBadgeCount})
            </h3>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
                builtUponOpen ? 'rotate-180' : ''
              }`}
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {builtUponOpen ? (
            recipeLinks.length === 0 &&
            (!showExtended || extendedUpstreamInfos.length === 0) ? (
              <p className="text-sm text-muted-foreground">
                {tExplore('noUpstream')}
              </p>
            ) : (
              <div className="space-y-4">
                {recipeLinks.length > 0 ? (
                  <ul className="space-y-3">
                    {recipeLinks.map((link) => (
                      <ExploreRecipeRow
                        key={link.id}
                        link={link}
                        getNodeById={getNodeById}
                        locale={locale}
                        detailsById={detailsById}
                        imageBust={imageBustByNodeId[link.source_id] ?? 0}
                        onSelectIngredient={(id) =>
                          openPeerDetail(id, 'upstream')
                        }
                      />
                    ))}
                  </ul>
                ) : null}
                {showExtended && extendedUpstreamInfos.length > 0 ? (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {tExplore('linkNeighborhoodExtended')}
                    </p>
                    <ul className="space-y-3">
                      {extendedUpstreamInfos.map((info) => (
                        <ExploreExtendedPeerRow
                          key={info.peerId}
                          info={info}
                          getNodeById={getNodeById}
                          locale={locale}
                          detailsById={detailsById}
                          imageBust={imageBustByNodeId[info.peerId] ?? 0}
                          onSelectPeer={(id) => openPeerDetail(id, 'upstream')}
                        />
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )
          ) : null}
        </section>
      </div>
    );

  if (!ctx) return null;

  return (
    <AnimatePresence>
      {detailNodeId && node ? (
        <motion.aside
          id="explore-detail-panel"
          ref={detailAsideRef}
          key="explore-detail"
          role="complementary"
          aria-labelledby="explore-detail-title"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={TRANSITION}
          className={`glass-explore-detail fixed bottom-0 right-0 top-14 z-[95] flex flex-col ${
            isMobile ? 'w-full' : ''
          }`}
          style={
            isMobile
              ? undefined
              : {
                  width: `min(100vw, ${EXPLORE_DETAIL_PANEL_WIDTH_PX}px)`,
                  maxWidth: EXPLORE_DETAIL_PANEL_WIDTH_PX,
                }
          }
        >
          {detailSubview === 'suggest' && !isAdmin ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <SuggestNodeCorrectionPanel
                node={node}
                onClose={() => ctx.closeSuggestSubview()}
              />
            </div>
          ) : detailSubview === 'adminEdit' && isAdmin ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <SuggestNodeCorrectionPanel
                key={node.id}
                variant="admin"
                node={node}
                onClose={() => ctx.closeSuggestSubview()}
                onAdminSaved={async () => {
                  await refreshData();
                }}
              />
            </div>
          ) : (
            panelInner
          )}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

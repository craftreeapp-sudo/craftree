'use client';

import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  memo,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { getCategoryColor, hexToRgba } from '@/lib/colors';
import { useLocale, useTranslations } from 'next-intl';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { getNameEnForNode } from '@/lib/name-en-lookup';
import { formatYear } from '@/lib/utils';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { useGraphStore } from '@/stores/graph-store';
import { useUIStore } from '@/stores/ui-store';
import {
  EXPLORE_CARD_H,
  EXPLORE_CARD_W,
  EXPLORE_LAYOUT_NODE_H,
  EXPLORE_LAYOUT_NODE_W,
} from '@/lib/graph-utils';
import { FOCUS_ADD_BTN_PX } from './focus-overlay-nodes';
import { getNodeDetails, nodeDetailsHasReadableDescription } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';
import { useToastStore } from '@/stores/toast-store';
import type { Era, NodeCategory, TechNodeDetails, TechNodeType } from '@/lib/types';

const BORDER_DEFAULT = 'var(--border)';

/** Vue focalisée : léger zoom des « cartes enfants » au survol. */
const FOCUS_CHILD_HOVER_SCALE = 1.045;

const FOCUS_DESC_HOVER_MS = 200;
const FOCUS_DESC_GAP_PX = 8;
const FOCUS_DESC_ARROW_PX = 6;
const FOCUS_DESC_VIEWPORT_MARGIN = 8;
const FOCUS_DESC_MAX_W = 320;

function pickFocusTooltipDescription(
  detail: TechNodeDetails | null | undefined,
  locale: string
): string {
  if (!detail) return '';
  const frenchUi = locale === 'fr' || locale.startsWith('fr-');
  if (frenchUi) return detail.description?.trim() ?? '';
  const en = detail.description_en?.trim();
  if (en) return en;
  return detail.description?.trim() ?? '';
}

/** Hauteur totale estimée du tooltip (titre + description + padding) pour le placement. */
function estimateFocusTooltipTotalHeightPx(description: string): number {
  const padY = 24;
  const titleBlock = 26;
  const gap = 4;
  const t = description.trim();
  if (!t) return padY + titleBlock + gap + 20;
  const approxCharsPerLine = Math.max(28, Math.floor((FOCUS_DESC_MAX_W - 32) / 6.8));
  const lines = Math.max(1, Math.ceil(t.length / approxCharsPerLine));
  const descH = Math.min(
    window.innerHeight * 0.58,
    20 + lines * 17 * 1.4
  );
  return padY + titleBlock + gap + descH;
}

function computeFocusDescTooltipPlacement(
  rect: DOMRect,
  tooltipTotalHeightPx: number
): {
  placement: 'above' | 'below';
  top: number;
  left: number;
} {
  const cx = rect.left + rect.width / 2;
  const halfW = FOCUS_DESC_MAX_W / 2;
  const left = Math.max(
    FOCUS_DESC_VIEWPORT_MARGIN + halfW,
    Math.min(cx, window.innerWidth - FOCUS_DESC_VIEWPORT_MARGIN - halfW)
  );

  const fitsAbove =
    rect.top -
      FOCUS_DESC_GAP_PX -
      FOCUS_DESC_ARROW_PX -
      tooltipTotalHeightPx >=
    FOCUS_DESC_VIEWPORT_MARGIN;

  if (fitsAbove) {
    return {
      placement: 'above',
      top:
        rect.top -
        FOCUS_DESC_GAP_PX -
        FOCUS_DESC_ARROW_PX -
        tooltipTotalHeightPx,
      left,
    };
  }
  return {
    placement: 'below',
    top: rect.bottom + FOCUS_DESC_GAP_PX + FOCUS_DESC_ARROW_PX,
    left,
  };
}

function FocusNeighborDescTooltipView({
  placement,
  left,
  top,
  name,
  description,
  emptyLabel,
}: {
  placement: 'above' | 'below';
  left: number;
  top: number;
  name: string;
  description: string;
  emptyLabel: string;
}) {
  const empty = !description.trim();
  return (
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{ left, top, transform: 'translateX(-50%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="relative"
        style={{
          background: 'var(--surface-elevated)',
          border: '0.5px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px',
          maxWidth: FOCUS_DESC_MAX_W,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        }}
      >
        {placement === 'above' ? (
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{
              bottom: -FOCUS_DESC_ARROW_PX,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid var(--surface-elevated)',
            }}
            aria-hidden
          />
        ) : (
          <div
            className="pointer-events-none absolute left-1/2 -translate-x-1/2"
            style={{
              top: -FOCUS_DESC_ARROW_PX,
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderBottom: '6px solid var(--surface-elevated)',
            }}
            aria-hidden
          />
        )}
        <div className="font-bold" style={{ fontSize: 14, color: 'var(--foreground)' }}>
          {name}
        </div>
        <div
          className={`max-h-[min(58vh,520px)] overflow-y-auto overscroll-contain pr-0.5 ${empty ? 'italic' : ''}`}
          style={{
            marginTop: 4,
            fontSize: 12,
            color: 'var(--muted-foreground)',
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {empty ? emptyLabel : description}
        </div>
      </motion.div>
    </div>
  );
}

export interface TechNodeData {
  name: string;
  category: NodeCategory;
  era?: Era;
  type?: TechNodeType;
  complexity_depth?: number;
  treeLayer?: number;
  isRawMaterial?: boolean;
  year_approx?: number;
  image_url?: string;
  /** Query anti-cache après upload (store graph) */
  imageBust?: number;
  origin?: string;
  /** Surcharge affichage (sinon lookup nodes-details) */
  name_en?: string;
  centralityNorm?: number;
  dimmed?: boolean;
  focusSelected?: boolean;
  focusPred?: boolean;
  /** Vue focalisée /explore : voisin direct (pas la carte centrale) */
  focusExploreNeighbor?: boolean;
  /** Lien entre ce voisin et la sélection (suppression) */
  focusLinkId?: string;
  /** Transition vue focalisée : classes CSS sur la carte interne */
  focusInnerClass?: string;
  focusStaggerDelayMs?: number;
  focusSlideBorder?: boolean;
  focusSlideActive?: boolean;
  focusWillChange?: boolean;
  neighborHighlight?: boolean;
  hoverCenter?: boolean;
  introDelayMs?: number;
  explosionMode?: boolean;
  explosionRevealed?: boolean;
  /** Vue /explore globale : aucun lien entrant ni sortant */
  isolatedNoLinks?: boolean;
  /** Survol actif (timeline ou explore) : distingue grisage survol vs filtre */
  hoverInteractionActive?: boolean;
  /** Rôle admin injecté par decorate (pour memo + icônes). */
  showAdminIcons?: boolean;
}

function techNodeDataEqual(a: TechNodeData, b: TechNodeData): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const key = k as keyof TechNodeData;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function techNodeAreEqual(prev: NodeProps, next: NodeProps): boolean {
  if (prev.id !== next.id) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.dragging !== next.dragging) return false;
  if (prev.sourcePosition !== next.sourcePosition) return false;
  if (prev.targetPosition !== next.targetPosition) return false;
  return techNodeDataEqual(
    prev.data as unknown as TechNodeData,
    next.data as unknown as TechNodeData
  );
}

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];
const easeOutBack: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

function TechNodeComponent({
  id,
  data,
  selected,
  sourcePosition = Position.Top,
  targetPosition = Position.Bottom,
}: NodeProps) {
  const nodeData = data as unknown as TechNodeData;
  const locale = useLocale();
  const tCat = useTranslations('categories');
  const tExplore = useTranslations('explore');
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const detailNameEn = useNodeDetailsStore((s) => s.byId[id]?.name_en);
  const displayName = useMemo(() => {
    const nameEnResolved =
      nodeData.name_en?.trim() ||
      detailNameEn?.trim() ||
      getNameEnForNode(id);
    return pickNodeDisplayName(locale, nodeData.name, nameEnResolved);
  }, [locale, nodeData.name, nodeData.name_en, id, detailNameEn]);
  const categoryBadge = tCat(nodeData.category);
  const categoryColor = getCategoryColor(nodeData.category);
  const focusTransitionAnimating = useUIStore((s) => s.isAnimating);
  const craftEdges = useGraphStore((s) => s.edges);
  const setEdgesAndRecompute = useGraphStore((s) => s.setEdgesAndRecompute);
  const { navigateToNode } = useExploreNavigation();
  const user = useAuthStore((s) => s.user);
  const isAdmin = nodeData.showAdminIcons ?? false;
  const getNodeById = useGraphStore((s) => s.getNodeById);
  const pushToast = useToastStore((s) => s.pushToast);
  const tAuth = useTranslations('auth');
  const themeMode = useThemeStore((s) => s.theme);

  const neighborHighlight = nodeData.neighborHighlight === true;
  const hoverCenter = nodeData.hoverCenter === true;
  const focusSelected = nodeData.focusSelected === true;
  const focusPred = nodeData.focusPred === true;
  const focusExploreNeighbor = nodeData.focusExploreNeighbor === true;
  const focusLinkId = nodeData.focusLinkId;
  const focusInnerClass = nodeData.focusInnerClass;
  const focusStaggerDelayMs = nodeData.focusStaggerDelayMs;
  const focusSlideBorder = nodeData.focusSlideBorder === true;
  const focusSlideActive = nodeData.focusSlideActive === true;
  const focusWillChange = nodeData.focusWillChange === true;
  const [pendingFocusDelete, setPendingFocusDelete] = useState(false);
  const pendingFocusDeleteRef = useRef(false);
  const deleteAnimDoneRef = useRef(false);
  const [deleteLinkModal, setDeleteLinkModal] = useState<{
    linkId: string;
    sourceLabel: string;
    targetLabel: string;
  } | null>(null);
  const centralityNorm = nodeData.centralityNorm ?? 0;
  const introDelayMs = nodeData.introDelayMs;
  const explosionMode = nodeData.explosionMode === true;
  const explosionRevealed = nodeData.explosionRevealed === true;

  const [hover, setHover] = useState(false);
  const [imageError, setImageError] = useState(false);
  const focusDescTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusDescHoverActiveRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [focusDescTooltip, setFocusDescTooltip] = useState<{
    placement: 'above' | 'below';
    left: number;
    top: number;
    description: string;
  } | null>(null);

  const onDeleteLinkAfterAnim = useCallback(async () => {
    if (!focusLinkId) return;
    const res = await fetch(
      `/api/links/${encodeURIComponent(focusLinkId)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      setPendingFocusDelete(false);
      deleteAnimDoneRef.current = false;
      return;
    }
    const edges = useGraphStore.getState().edges;
    setEdgesAndRecompute(edges.filter((e) => e.id !== focusLinkId));
  }, [focusLinkId, setEdgesAndRecompute]);

  useEffect(() => {
    pendingFocusDeleteRef.current = pendingFocusDelete;
  }, [pendingFocusDelete]);

  const onFocusDeleteAnimComplete = useCallback(() => {
    if (!pendingFocusDeleteRef.current || deleteAnimDoneRef.current) return;
    deleteAnimDoneRef.current = true;
    void onDeleteLinkAfterAnim();
  }, [onDeleteLinkAfterAnim]);

  const onPencilClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (isAdmin) {
        navigateToNode(id, { center: true, openEdit: true });
      } else {
        navigateToNode(id, { center: true, openSuggest: true });
      }
    },
    [id, navigateToNode, isAdmin]
  );

  const onRemoveLinkClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (!focusLinkId) return;
      if (isAdmin) {
        deleteAnimDoneRef.current = false;
        setPendingFocusDelete(true);
        return;
      }
      const link = craftEdges.find((l) => l.id === focusLinkId);
      if (!link) return;
      setDeleteLinkModal({
        linkId: link.id,
        sourceLabel:
          getNodeById(link.source_id)?.name ?? link.source_id,
        targetLabel:
          getNodeById(link.target_id)?.name ?? link.target_id,
      });
    },
    [isAdmin, focusLinkId, craftEdges, getNodeById, setDeleteLinkModal]
  );

  const confirmDeleteLinkSuggestion = useCallback(async () => {
    if (!deleteLinkModal || !user) return;
    const link = craftEdges.find((l) => l.id === deleteLinkModal.linkId);
    if (!link) {
      setDeleteLinkModal(null);
      return;
    }
    const res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestion_type: 'delete_link',
        node_id: null,
        data: {
          link_id: link.id,
          source_id: link.source_id,
          target_id: link.target_id,
        },
      }),
    });
    if (!res.ok) {
      pushToast(
        String((await res.json().catch(() => ({})))?.error ?? 'Erreur'),
        'error'
      );
      return;
    }
    pushToast(tAuth('suggestionSentReview'), 'success');
    setDeleteLinkModal(null);
  }, [
    deleteLinkModal,
    user,
    craftEdges,
    pushToast,
    tAuth,
    setDeleteLinkModal,
  ]);

  useEffect(() => {
    deleteAnimDoneRef.current = false;
    pendingFocusDeleteRef.current = false;
    queueMicrotask(() => setPendingFocusDelete(false));
  }, [focusLinkId, id]);

  const rawImageUrl = nodeData.image_url?.trim();
  const bust = nodeData.imageBust ?? 0;
  const imageDisplaySrc =
    rawImageUrl && bust > 0
      ? `${rawImageUrl}${rawImageUrl.includes('?') ? '&' : '?'}t=${bust}`
      : rawImageUrl;
  const hasImage = Boolean(rawImageUrl);

  useEffect(() => {
    queueMicrotask(() => setImageError(false));
  }, [rawImageUrl, id]);
  const yearLabel = formatYear(nodeData.year_approx);
  /**
   * Survol /explore : voisins hors focus → opacité 0.
   * Filtres globaux (dimmed dans les données) → opacité réduite mais carte lisible.
   */
  const isHoverDimmed =
    nodeData.hoverInteractionActive === true && nodeData.dimmed === true;
  const isFilterDimmed =
    nodeData.hoverInteractionActive !== true && nodeData.dimmed === true;
  const baseOpacity = isHoverDimmed ? 0 : isFilterDimmed ? 0.38 : 1;

  const exploreIntro =
    !explosionMode && introDelayMs != null
      ? {
          initial: { opacity: 0, scale: 0.92 } as const,
          animate: { opacity: baseOpacity, scale: 1 } as const,
          transition: {
            delay: introDelayMs / 1000,
            duration: 0.4,
            ease: easeOut,
          },
        }
      : null;

  const explosionPop = explosionMode
    ? {
        initial: false,
        animate: explosionRevealed
          ? ({ opacity: baseOpacity, scale: 1 } as const)
          : ({ opacity: 0, scale: 0 } as const),
        transition: explosionRevealed
          ? { duration: 0.55, ease: easeOutBack }
          : { duration: 0 },
      }
    : null;

  const focusCssDriver = Boolean(focusInnerClass) || focusSlideActive;

  const motionOuter = explosionPop ?? exploreIntro ?? {
    initial: false,
    animate: { opacity: baseOpacity, scale: 1 },
    transition: { duration: 0 },
  };

  const baseAnimate =
    typeof motionOuter.animate === 'object' && motionOuter.animate !== null
      ? motionOuter.animate
      : { opacity: baseOpacity, scale: 1 };
  const resolvedAnimate = pendingFocusDelete
    ? { scale: 0, opacity: 0 }
    : baseAnimate;
  const resolvedTransition = pendingFocusDelete
    ? { duration: 0.2, ease: easeOut }
    : motionOuter.transition ?? { duration: 0 };

  const resolvedOpacity =
    typeof resolvedAnimate.opacity === 'number' ? resolvedAnimate.opacity : 1;

  const canShowFocusDescTooltip =
    focusExploreNeighbor &&
    !focusSelected &&
    resolvedOpacity > 0 &&
    !focusTransitionAnimating;

  const openFocusDescTooltip = useCallback(async () => {
    if (!cardRef.current || !focusDescHoverActiveRef.current) return;
    const existing = useNodeDetailsStore.getState().byId[id];
    if (
      existing === undefined ||
      !nodeDetailsHasReadableDescription(existing)
    ) {
      const fetched = await getNodeDetails(id);
      if (fetched) mergeDetail(id, fetched);
    }
    if (!focusDescHoverActiveRef.current || !cardRef.current) return;
    const detail = useNodeDetailsStore.getState().byId[id];
    const rect = cardRef.current.getBoundingClientRect();
    const description = pickFocusTooltipDescription(detail ?? null, locale);
    const totalH = estimateFocusTooltipTotalHeightPx(description);
    const pos = computeFocusDescTooltipPlacement(rect, totalH);
    setFocusDescTooltip({ ...pos, description });
  }, [id, locale, mergeDetail]);

  const onCardMouseEnter = useCallback(() => {
    setHover(true);
    if (!canShowFocusDescTooltip) return;
    focusDescHoverActiveRef.current = true;
    if (focusDescTimerRef.current) clearTimeout(focusDescTimerRef.current);
    focusDescTimerRef.current = setTimeout(() => {
      focusDescTimerRef.current = null;
      void openFocusDescTooltip();
    }, FOCUS_DESC_HOVER_MS);
  }, [canShowFocusDescTooltip, openFocusDescTooltip]);

  const onCardMouseLeave = useCallback(() => {
    setHover(false);
    focusDescHoverActiveRef.current = false;
    if (focusDescTimerRef.current) {
      clearTimeout(focusDescTimerRef.current);
      focusDescTimerRef.current = null;
    }
    setFocusDescTooltip(null);
  }, []);

  useEffect(() => {
    if (!canShowFocusDescTooltip) {
      focusDescHoverActiveRef.current = false;
      if (focusDescTimerRef.current) {
        clearTimeout(focusDescTimerRef.current);
        focusDescTimerRef.current = null;
      }
      queueMicrotask(() => setFocusDescTooltip(null));
    }
  }, [canShowFocusDescTooltip]);

  useEffect(() => {
    return () => {
      if (focusDescTimerRef.current) clearTimeout(focusDescTimerRef.current);
    };
  }, []);

  const isSelectedUi = selected || focusSelected;

  const cardW = explosionMode
    ? 140 + centralityNorm * 8
    : EXPLORE_CARD_W;
  const cardH = explosionMode
    ? 160 + centralityNorm * 12
    : EXPLORE_CARD_H;

  const layoutW = explosionMode ? cardW : EXPLORE_LAYOUT_NODE_W;
  const layoutH = explosionMode ? cardH : EXPLORE_LAYOUT_NODE_H;

  const borderGlow =
    neighborHighlight || hoverCenter
      ? `0 0 0 2px ${categoryColor}, 0 8px 24px ${hexToRgba(categoryColor, 0.2)}`
      : undefined;
  const focusGlow = focusSelected
    ? `0 0 0 3px ${categoryColor}, 0 0 28px ${hexToRgba(categoryColor, 0.4)}`
    : focusPred
      ? `0 0 0 2px ${hexToRgba(categoryColor, 0.67)}, 0 0 14px ${hexToRgba(categoryColor, 0.27)}`
      : undefined;

  const isolatedNoLinks = nodeData.isolatedNoLinks === true;
  const isolatedHighlight =
    isolatedNoLinks && !explosionMode && !focusGlow;

  const cardShadow = (() => {
    if (focusGlow) return focusGlow;
    if (isolatedHighlight) {
      if (isSelectedUi) {
        return `0 0 0 2px ${categoryColor}, 0 0 0 4px rgba(239, 68, 68, 0.55), 0 0 22px rgba(239, 68, 68, 0.38), 0 8px 24px rgba(0,0,0,0.35)`;
      }
      return '0 0 0 2px #EF4444, 0 0 22px rgba(239, 68, 68, 0.45), 0 8px 20px rgba(0,0,0,0.22)';
    }
    if (isSelectedUi) return '0 8px 24px rgba(0,0,0,0.4)';
    if (hover) return '0 4px 12px rgba(0,0,0,0.3)';
    if (borderGlow) return borderGlow;
    return undefined;
  })();

  const resolvedCardShadow =
    cardShadow ??
    (themeMode === 'light'
      ? '0 1px 3px rgba(15, 23, 42, 0.12), 0 1px 2px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.07)'
      : undefined);

  const borderColor = (() => {
    if (focusSlideBorder) return 'var(--accent)';
    if (isSelectedUi) return categoryColor;
    if (hover) return hexToRgba(categoryColor, 0.6);
    if (isolatedNoLinks && !explosionMode) return '#F87171';
    return BORDER_DEFAULT;
  })();

  const borderWidth =
    focusSlideBorder || isSelectedUi || isolatedHighlight ? 2 : 1;

  const nameSize = explosionMode ? `${13 + centralityNorm * 1}px` : '14px';

  const layerNum = Math.max(
    0,
    nodeData.treeLayer ?? nodeData.complexity_depth ?? 0
  );

  const tooltip = `${displayName} · ${categoryBadge}${
    isolatedNoLinks ? ' · Aucun lien entrant ni sortant' : ''
  }`;

  const innerCardClass = [
    'focus-explore-card-inner',
    'flex h-full flex-col overflow-hidden rounded-lg border bg-transparent',
    focusInnerClass,
    focusSlideBorder ? 'focus-slide-border' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
    <motion.div
      title={focusExploreNeighbor ? undefined : tooltip}
      className={`relative ${focusExploreNeighbor ? 'group' : ''} ${
        focusExploreNeighbor ? 'pointer-events-none' : ''
      }`}
      style={{
        width: layoutW,
        height: layoutH,
        willChange:
          focusWillChange || focusCssDriver
            ? 'transform, opacity'
            : undefined,
      }}
      initial={motionOuter.initial}
      animate={resolvedAnimate}
      transition={resolvedTransition}
      onAnimationComplete={onFocusDeleteAnimComplete}
    >
      <Handle
        type="source"
        position={sourcePosition}
        className="!h-px !min-h-px !w-px !min-w-px !border-0 !bg-transparent !opacity-0"
        style={{ left: '50%', top: 0, transform: 'translateX(-50%)' }}
      />
      <Handle
        type="target"
        position={targetPosition}
        className="!h-px !min-h-px !w-px !min-w-px !border-0 !bg-transparent !opacity-0"
        style={{ left: '50%', bottom: 0, transform: 'translateX(-50%)' }}
      />

      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
        style={{ width: cardW, height: cardH }}
      >
        {focusExploreNeighbor &&
        focusLinkId &&
        !focusTransitionAnimating &&
        user ? (
          <div
            className="pointer-events-none absolute right-0 z-[60] flex opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{
              gap: 6,
              top: -FOCUS_ADD_BTN_PX / 2,
            }}
          >
            <button
              type="button"
              className="pointer-events-auto flex shrink-0 items-center justify-center rounded-full bg-border text-white transition-colors hover:bg-border/80 !cursor-pointer"
              style={{ width: FOCUS_ADD_BTN_PX, height: FOCUS_ADD_BTN_PX, zIndex: 61 }}
              aria-label="Centrer et modifier"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onPencilClick}
            >
              <svg
                width={Math.round(FOCUS_ADD_BTN_PX * 0.5)}
                height={Math.round(FOCUS_ADD_BTN_PX * 0.5)}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            <button
              type="button"
              className="pointer-events-auto flex shrink-0 items-center justify-center rounded-full bg-border transition-colors hover:bg-border/80 !cursor-pointer"
              style={{
                width: FOCUS_ADD_BTN_PX,
                height: FOCUS_ADD_BTN_PX,
                zIndex: 61,
                color: '#EF4444',
              }}
              aria-label="Supprimer le lien"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onRemoveLinkClick}
            >
              <svg
                width={Math.round(FOCUS_ADD_BTN_PX * 0.5)}
                height={Math.round(FOCUS_ADD_BTN_PX * 0.5)}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
        <motion.div
          ref={cardRef}
          className={innerCardClass}
          style={{
            width: cardW,
            height: cardH,
            borderColor,
            borderWidth,
            boxShadow: resolvedCardShadow,
            borderStyle: 'solid',
            transitionDelay:
              focusStaggerDelayMs != null
                ? `${focusStaggerDelayMs}ms`
                : undefined,
          }}
          animate={{
            scale:
              focusSlideActive || focusInnerClass
                ? 1
                : focusExploreNeighbor &&
                    hover &&
                    !explosionMode &&
                    !focusTransitionAnimating
                  ? FOCUS_CHILD_HOVER_SCALE
                  : isSelectedUi && !explosionMode
                    ? 1.05
                    : 1,
          }}
          transition={
            focusSlideActive || focusInnerClass
              ? { duration: 0 }
              : focusExploreNeighbor
                ? { duration: 0.22, ease: easeOut }
                : { type: 'spring', stiffness: 380, damping: 28 }
          }
          onPointerEnter={onCardMouseEnter}
          onPointerLeave={onCardMouseLeave}
        >
          {/* Moitié haute — un peu moins de hauteur pour laisser 2 lignes au titre */}
          <div
            className="relative min-h-0 w-full flex-[1_1_44%] overflow-hidden"
            style={{
              borderRadius: '8px 8px 0 0',
            }}
          >
            {hasImage && imageDisplaySrc && !imageError ? (
              <Image
                src={imageDisplaySrc}
                alt=""
                width={140}
                height={100}
                loading="lazy"
                placeholder="empty"
                className="h-full w-full object-cover"
                sizes="140px"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  setImageError(true);
                }}
                unoptimized={
                  Boolean(rawImageUrl?.startsWith('/images/')) ||
                  Boolean(rawImageUrl?.includes('placehold.co')) ||
                  Boolean(rawImageUrl?.startsWith('http://localhost')) ||
                  Boolean(rawImageUrl?.startsWith('https://localhost'))
                }
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center px-2 text-center font-semibold leading-tight text-white"
                style={{
                  backgroundColor: categoryColor,
                  fontSize: explosionMode
                    ? `${12 + centralityNorm * 0.5}px`
                    : '15px',
                }}
              >
                <span className="line-clamp-3">{displayName}</span>
              </div>
            )}
          </div>

          {/* Moitié basse — titre sur 2 lignes + méta */}
          <div
            className="flex min-h-0 w-full flex-[1_1_56%] flex-col items-stretch justify-start overflow-hidden px-3 pt-3 pb-4 text-left"
            style={{
              backgroundColor: 'var(--surface-elevated)',
              borderRadius: '0 0 8px 8px',
            }}
          >
            <div
              className="flex min-h-[2lh] shrink-0 items-start justify-between gap-1.5"
              style={{ marginBottom: 6 }}
            >
              <span
                className="line-clamp-2 min-w-0 flex-1 break-words font-bold leading-snug text-foreground"
                style={{
                  fontSize: nameSize,
                }}
              >
                {displayName}
              </span>
              <span
                className="shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-muted-foreground"
                style={{
                  borderColor: hexToRgba(categoryColor, 0.45),
                  backgroundColor: hexToRgba(categoryColor, 0.08),
                }}
                title={tExplore('layerBadgeTitle', { layer: layerNum })}
                aria-label={tExplore('layerBadgeTitle', { layer: layerNum })}
              >
                {layerNum}
              </span>
            </div>
            {yearLabel ? (
              <span
                className="inline-block w-fit rounded px-2 py-1 text-[11px] text-muted-foreground"
                style={{
                  backgroundColor: 'var(--border)',
                  marginBottom: 6,
                }}
              >
                {yearLabel}
              </span>
            ) : null}
            <span
              className="inline-block w-fit rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.5px]"
              style={{
                backgroundColor: hexToRgba(categoryColor, 0.2),
                color: categoryColor,
              }}
            >
              {categoryBadge}
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
    {focusDescTooltip && typeof document !== 'undefined'
      ? createPortal(
          <FocusNeighborDescTooltipView
            placement={focusDescTooltip.placement}
            left={focusDescTooltip.left}
            top={focusDescTooltip.top}
            name={displayName}
            description={focusDescTooltip.description}
            emptyLabel={tExplore('focusTooltipNoDescription')}
          />,
          document.body
        )
      : null}
    {deleteLinkModal && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-link-suggest-title"
          >
            <div
              className="w-full max-w-[360px] rounded-lg border border-border bg-surface-elevated p-4 shadow-xl"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p
                id="delete-link-suggest-title"
                className="text-[14px] font-semibold leading-snug text-foreground"
              >
                {tExplore('suggestDeleteLinkTitle', {
                  source: deleteLinkModal.sourceLabel,
                  target: deleteLinkModal.targetLabel,
                })}
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border border-border px-3 py-2 text-[13px] text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
                  onClick={() => setDeleteLinkModal(null)}
                >
                  {tAuth('cancel')}
                </button>
                <button
                  type="button"
                  className="rounded-md bg-amber-600 px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-amber-500"
                  onClick={() => void confirmDeleteLinkSuggestion()}
                >
                  {tExplore('suggestDeleteLinkSend')}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null}
    </>
  );
}

TechNodeComponent.displayName = 'TechNode';

export const TechNode = memo(
  TechNodeComponent,
  techNodeAreEqual
) as typeof TechNodeComponent;

/** Alias — carte invention React Flow (Tree / Explore). */
export const TechNodeCard = TechNode;

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
import Image from 'next/image';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { getCategoryColor, hexToRgba } from '@/lib/colors';
import { useLocale, useTranslations } from 'next-intl';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { getNameEnForNode } from '@/lib/name-en-lookup';
import { formatYear } from '@/lib/utils';
import {
  getDirectPredecessors,
  getDirectSuccessors,
} from '@/lib/graph-adjacency';
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
import type { Era, NodeCategory, TechNodeType } from '@/lib/types';

const BORDER_DEFAULT = '#2A3042';

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
}

function techNodeVisualKey(d: TechNodeData): string {
  return [
    d.dimmed === true ? '1' : '0',
    d.neighborHighlight === true ? '1' : '0',
    d.hoverCenter === true ? '1' : '0',
    d.focusSelected === true ? '1' : '0',
    d.focusPred === true ? '1' : '0',
    d.focusExploreNeighbor === true ? '1' : '0',
    d.focusLinkId ?? '',
    d.focusInnerClass ?? '',
    String(d.focusStaggerDelayMs ?? ''),
    d.focusSlideBorder === true ? '1' : '0',
    d.focusSlideActive === true ? '1' : '0',
    d.focusWillChange === true ? '1' : '0',
    d.name,
    String(d.year_approx ?? ''),
    String(d.category),
    String(d.introDelayMs ?? ''),
    d.explosionMode === true ? '1' : '0',
    d.explosionRevealed === true ? '1' : '0',
    String(d.centralityNorm ?? ''),
    d.isolatedNoLinks === true ? '1' : '0',
  ].join('|');
}

type TechNodeFlowProps = {
  position?: { x?: number; y?: number };
  xPos?: number;
  yPos?: number;
  id: string;
  selected?: boolean;
  className?: string;
  data: Record<string, unknown>;
};

/** React Flow peut ne pas fournir `position` au premier rendu ; les coords passent parfois par xPos/yPos. */
function getFlowNodeXY(n: NodeProps): { x: number; y: number } {
  const raw = n as unknown as TechNodeFlowProps;
  const x = raw.position?.x ?? raw.xPos ?? 0;
  const y = raw.position?.y ?? raw.yPos ?? 0;
  return { x, y };
}

function areTechNodePropsEqual(prev: NodeProps, next: NodeProps): boolean {
  const pa = getFlowNodeXY(prev);
  const na = getFlowNodeXY(next);
  if (pa.x !== na.x || pa.y !== na.y) return false;
  const pPrev = prev as unknown as TechNodeFlowProps;
  const pNext = next as unknown as TechNodeFlowProps;
  if (pPrev.id !== pNext.id) return false;
  if (pPrev.selected !== pNext.selected) return false;
  if (pPrev.className !== pNext.className) return false;
  const p = pPrev.data as unknown as TechNodeData;
  const n = pNext.data as unknown as TechNodeData;
  if (p.image_url !== n.image_url) return false;
  if (p.imageBust !== n.imageBust) return false;
  return techNodeVisualKey(p) === techNodeVisualKey(n);
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
  const displayName = useMemo(
    () =>
      pickNodeDisplayName(
        locale,
        nodeData.name,
        nodeData.name_en ?? getNameEnForNode(id)
      ),
    [locale, nodeData.name, nodeData.name_en, id]
  );
  const categoryBadge = tCat(nodeData.category);
  const categoryColor = getCategoryColor(nodeData.category);
  const exploreHoveredNodeId = useUIStore((s) => s.exploreHoveredNodeId);
  const exploreFocusLayout = useUIStore(
    (s) => Boolean(s.isSidebarOpen && s.selectedNodeId)
  );
  const focusTransitionAnimating = useUIStore((s) => s.isAnimating);
  const craftEdges = useGraphStore((s) => s.edges);
  const setEdgesAndRecompute = useGraphStore((s) => s.setEdgesAndRecompute);
  const { navigateToNode } = useExploreNavigation();

  const hoverVisual = useMemo(() => {
    if (exploreFocusLayout || !exploreHoveredNodeId) {
      return null;
    }
    const preds = getDirectPredecessors(exploreHoveredNodeId, craftEdges);
    const succs = getDirectSuccessors(exploreHoveredNodeId, craftEdges);
    const related = new Set<string>([
      exploreHoveredNodeId,
      ...preds,
      ...succs,
    ]);
    return {
      dimmed: !related.has(id),
      neighborHighlight: related.has(id) && id !== exploreHoveredNodeId,
      hoverCenter: id === exploreHoveredNodeId,
    };
  }, [exploreFocusLayout, exploreHoveredNodeId, craftEdges, id]);

  const dimmed =
    hoverVisual !== null ? hoverVisual.dimmed : nodeData.dimmed === true;
  const neighborHighlight =
    hoverVisual !== null
      ? hoverVisual.neighborHighlight
      : nodeData.neighborHighlight === true;
  const hoverCenter =
    hoverVisual !== null ? hoverVisual.hoverCenter : nodeData.hoverCenter === true;
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
  const centralityNorm = nodeData.centralityNorm ?? 0;
  const introDelayMs = nodeData.introDelayMs;
  const explosionMode = nodeData.explosionMode === true;
  const explosionRevealed = nodeData.explosionRevealed === true;

  const [hover, setHover] = useState(false);

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
      navigateToNode(id, { center: true, openEdit: true });
    },
    [id, navigateToNode]
  );

  const onRemoveLinkClick = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    deleteAnimDoneRef.current = false;
    setPendingFocusDelete(true);
  }, []);

  useEffect(() => {
    deleteAnimDoneRef.current = false;
    pendingFocusDeleteRef.current = false;
    setPendingFocusDelete(false);
  }, [focusLinkId, id]);

  const rawImageUrl = nodeData.image_url?.trim();
  const bust = nodeData.imageBust ?? 0;
  const imageDisplaySrc =
    rawImageUrl && bust > 0
      ? `${rawImageUrl}${rawImageUrl.includes('?') ? '&' : '?'}t=${bust}`
      : rawImageUrl;
  const hasImage = Boolean(rawImageUrl);
  const yearLabel = formatYear(nodeData.year_approx);
  /**
   * Survol /explore : voisins hors focus → opacité 0.
   * Filtres globaux (dimmed dans les données) → opacité réduite mais carte lisible.
   */
  const isHoverDimmed = hoverVisual !== null && hoverVisual.dimmed;
  const isFilterDimmed =
    hoverVisual === null && nodeData.dimmed === true;
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

  const borderColor = (() => {
    if (focusSlideBorder) return '#3B82F6';
    if (isSelectedUi) return categoryColor;
    if (hover) return hexToRgba(categoryColor, 0.6);
    if (isolatedNoLinks && !explosionMode) return '#F87171';
    return BORDER_DEFAULT;
  })();

  const borderWidth =
    focusSlideBorder || isSelectedUi || isolatedHighlight ? 2 : 1;

  const nameSize = explosionMode ? `${13 + centralityNorm * 1}px` : '14px';

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
    <motion.div
      title={tooltip}
      className={`relative ${focusExploreNeighbor ? 'group' : ''}`}
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
        className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: cardW, height: cardH }}
      >
        {focusExploreNeighbor && focusLinkId && !focusTransitionAnimating ? (
          <div
            className="pointer-events-none absolute right-0 z-[60] flex opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{
              gap: 6,
              top: -FOCUS_ADD_BTN_PX / 2,
            }}
          >
            <button
              type="button"
              className="pointer-events-auto flex shrink-0 items-center justify-center rounded-full bg-[#2A3042] text-white transition-colors hover:bg-[#3B4558] !cursor-pointer"
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
              className="pointer-events-auto flex shrink-0 items-center justify-center rounded-full bg-[#2A3042] transition-colors hover:bg-[#3B4558] !cursor-pointer"
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
          className={innerCardClass}
          style={{
            width: cardW,
            height: cardH,
            borderColor,
            borderWidth,
            boxShadow: cardShadow,
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
                : isSelectedUi && !explosionMode
                  ? 1.05
                  : 1,
          }}
          transition={
            focusSlideActive || focusInnerClass
              ? { duration: 0 }
              : { type: 'spring', stiffness: 380, damping: 28 }
          }
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {/* Moitié haute — un peu moins de hauteur pour laisser 2 lignes au titre */}
          <div
            className="relative min-h-0 w-full flex-[1_1_44%] overflow-hidden"
            style={{
              borderRadius: '8px 8px 0 0',
            }}
          >
            {hasImage && imageDisplaySrc ? (
              <Image
                src={imageDisplaySrc}
                alt=""
                width={140}
                height={100}
                loading="lazy"
                placeholder="empty"
                className="h-full w-full object-cover"
                sizes="150px"
                unoptimized={
                  Boolean(rawImageUrl?.startsWith('/images/')) ||
                  Boolean(rawImageUrl?.includes('placehold.co')) ||
                  Boolean(rawImageUrl?.startsWith('http://localhost'))
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
            className="flex min-h-0 w-full flex-[1_1_56%] flex-col items-stretch justify-start overflow-hidden p-3 text-left"
            style={{
              backgroundColor: '#1E2432',
              borderRadius: '0 0 8px 8px',
            }}
          >
            <span
              className="line-clamp-2 min-h-[2lh] shrink-0 break-words font-bold leading-snug text-[#E8ECF4]"
              style={{
                fontSize: nameSize,
                marginBottom: 6,
              }}
            >
              {displayName}
            </span>
            {yearLabel ? (
              <span
                className="inline-block w-fit rounded px-2 py-1 text-[11px] text-[#8B95A8]"
                style={{
                  backgroundColor: '#2A3042',
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
  );
}

const TechNodeMemo = memo(TechNodeComponent, areTechNodePropsEqual);
TechNodeMemo.displayName = 'TechNode';

export const TechNode = TechNodeMemo;

/** Alias — carte invention React Flow (Tree / Explore). */
export const TechNodeCard = TechNode;

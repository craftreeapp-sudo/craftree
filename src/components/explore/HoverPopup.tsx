'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore, getNodeDetails } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';
import type { ExploreHoverPreview } from '@/components/explore/explore-card-context';
import { formatYear } from '@/lib/utils';
import { getCategoryColor } from '@/lib/colors';
import {
  pickNodeDisplayName,
  pickNodeDescriptionForLocale,
} from '@/lib/node-display-name';
import type { NodeCategory, TechNodeDetails } from '@/lib/types';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { getTagDisplayLabel } from '@/lib/tag-display';
import { getScrollableAncestors } from '@/lib/dom-scroll-parents';
import {
  natureTypeToExploreKey,
  originTypeToExploreKey,
} from '@/lib/explore-classification-badges';
import { CardImagePlaceholder } from '@/components/explore/CardImagePlaceholder';
import { ShareInventionButton } from '@/components/explore/ShareInventionButton';
import { BuiltUponBadgePopover } from '@/components/explore/BuiltUponBadgePopover';
import {
  effectiveDimension,
  effectiveMaterialLevel,
} from '@/lib/node-dimension-helpers';
import { EDITOR_DIM_KEY, EDITOR_LEVEL_KEY } from '@/components/editor/dimension-editor-keys';
import { EXPLORE_DETAIL_PANEL_WIDTH_PX } from '@/lib/explore-layout';

const POPUP_MAX_W = EXPLORE_DETAIL_PANEL_WIDTH_PX;
/** Aligné sur `ExploreDetailPanel` (fiche) : largeur max + petite marge. */
const DETAIL_PANEL_W = EXPLORE_DETAIL_PANEL_WIDTH_PX;
const GAP = 10;
const VIEW_MARGIN = 8;

type HoverLayoutHints = {
  /** Pixels réservés à droite (fiche ouverte desktop) pour ne pas chevaucher la fiche. */
  reserveRight: number;
};

/** Position fixe sans setState au scroll ; bornée au viewport et à gauche de la fiche. */
function applyPopupPosition(
  pop: HTMLDivElement,
  p: ExploreHoverPreview,
  layout: HoverLayoutHints
): void {
  const rect =
    p.anchorEl && p.anchorEl.isConnected
      ? p.anchorEl.getBoundingClientRect()
      : p.rect;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxRight = vw - layout.reserveRight - VIEW_MARGIN;

  /** Largeur max pour rester entre les marges et à gauche de la fiche (viewport réel). */
  const maxPopW = Math.max(80, maxRight - 2 * VIEW_MARGIN);
  const cappedMax = Math.min(POPUP_MAX_W, maxPopW);
  pop.style.maxWidth = `${Math.round(cappedMax)}px`;
  void pop.offsetWidth;

  const br = pop.getBoundingClientRect();
  const popW =
    br.width > 2 ? br.width : Math.min(vw * 0.92, cappedMax);
  const popH =
    br.height > 2 ? br.height : Math.min(vh * 0.85, 560);

  const preferRight = rect.right + GAP + popW <= maxRight;
  let left = preferRight
    ? rect.right + GAP
    : rect.left - GAP - popW;

  left = Math.min(
    Math.max(VIEW_MARGIN, left),
    maxRight - popW
  );
  if (left + popW > maxRight) {
    left = Math.max(VIEW_MARGIN, maxRight - popW);
  }

  const maxBottom = vh - VIEW_MARGIN;
  let top = rect.top;
  top = Math.min(Math.max(VIEW_MARGIN, top), maxBottom - popH);
  if (top + popH > maxBottom) {
    top = Math.max(VIEW_MARGIN, maxBottom - popH);
  }

  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(top)}px`;
}

export function ExploreHoverPopup() {
  const ctx = useExploreCardOptional();
  const locale = useLocale();
  const tCat = useTranslations('categories');
  const tExplore = useTranslations('explore');
  const tEd = useTranslations('editor');

  const getNodeById = useGraphStore((s) => s.getNodeById);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const detailsById = useNodeDetailsStore((s) => s.byId);

  const preview = ctx?.hoverPreview ?? null;
  const node = preview ? getNodeById(preview.nodeId) : undefined;
  const detail: TechNodeDetails | undefined = node
    ? detailsById[node.id]
    : undefined;

  const popupRef = useRef<HTMLDivElement | null>(null);
  const detailOpen = Boolean(ctx?.detailNodeId);
  const isMobile = Boolean(ctx?.isMobile);
  const layoutHints = useMemo<HoverLayoutHints>(
    () => ({
      reserveRight:
        detailOpen && !isMobile ? DETAIL_PANEL_W + GAP : 0,
    }),
    [detailOpen, isMobile]
  );

  /** Position dès que le nœud portail existe (évite un premier frame sans left/top). */
  const setPopupRef = useCallback(
    (el: HTMLDivElement | null) => {
      popupRef.current = el;
      if (el && preview) {
        applyPopupPosition(el, preview, layoutHints);
      }
    },
    [preview, layoutHints]
  );

  useEffect(() => {
    if (!preview?.nodeId) return;
    let cancelled = false;
    void getNodeDetails(preview.nodeId).then((d) => {
      if (!cancelled && d) mergeDetail(preview.nodeId, d);
    });
    return () => {
      cancelled = true;
    };
  }, [preview?.nodeId, mergeDetail]);

  useLayoutEffect(() => {
    if (!preview) return;
    const scrollOpts: AddEventListenerOptions = { passive: true };
    const scrollTargets: (Window | HTMLElement)[] = [window];
    const anchor = preview.anchorEl;
    if (anchor?.isConnected) {
      scrollTargets.push(...getScrollableAncestors(anchor));
    }
    const uniqueScroll = [...new Set(scrollTargets)];

    const bump = () => {
      const pop = popupRef.current;
      if (!preview || !pop) return;
      applyPopupPosition(pop, preview, layoutHints);
    };

    bump();
    for (const t of uniqueScroll) {
      t.addEventListener('scroll', bump, scrollOpts);
    }
    window.addEventListener('resize', bump);
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
      vv.addEventListener('scroll', bump, scrollOpts);
      vv.addEventListener('resize', bump);
    }
    let ro: ResizeObserver | null = null;
    if (anchor?.isConnected) {
      ro = new ResizeObserver(bump);
      ro.observe(anchor);
    }
    return () => {
      for (const t of uniqueScroll) {
        t.removeEventListener('scroll', bump, scrollOpts);
      }
      window.removeEventListener('resize', bump);
      if (vv) {
        vv.removeEventListener('scroll', bump, scrollOpts);
        vv.removeEventListener('resize', bump);
      }
      ro?.disconnect();
    };
  }, [preview, detailOpen, isMobile, layoutHints]);

  const displayName = useMemo(() => {
    if (!node) return '';
    return pickNodeDisplayName(locale, node.name, detail?.name_en);
  }, [locale, node, detail?.name_en]);

  const description = useMemo(() => {
    if (!detail) return '';
    return pickNodeDescriptionForLocale(
      locale,
      detail.description,
      detail.description_en
    );
  }, [detail, locale]);

  const categoryColor = node
    ? getCategoryColor(node.category as NodeCategory)
    : '#3B82F6';

  const getRecipeForNode = useGraphStore((s) => s.getRecipeForNode);
  const builtUponCount = useMemo(
    () => (node ? getRecipeForNode(node.id).length : 0),
    [node, getRecipeForNode]
  );

  const popupImageUrl = useMemo(() => {
    if (!node) return null;
    const raw = (detail?.image_url ?? node.image_url)?.trim();
    if (!raw) return null;
    const bust = imageBustByNodeId[node.id] ?? 0;
    return bust > 0
      ? `${raw}${raw.includes('?') ? '&' : '?'}t=${bust}`
      : raw;
  }, [node, detail?.image_url, imageBustByNodeId]);

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

  const originLine = (node?.origin ?? detail?.origin ?? '').trim();

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

  const cancelHoverClose = ctx?.cancelHoverClose;
  const requestHoverClose = ctx?.requestHoverClose;

  const onPopupPointerEnter = useCallback(() => {
    cancelHoverClose?.();
  }, [cancelHoverClose]);

  const onPopupPointerLeave = useCallback(() => {
    requestHoverClose?.();
  }, [requestHoverClose]);

  if (!ctx || typeof document === 'undefined') return null;

  /** Sous la fiche (z-80) quand elle est ouverte ; sinon au-dessus du contenu explore. */
  const hoverZClass = detailOpen ? 'z-[70]' : 'z-[95]';

  const el =
    preview && node ? (
      <div
        key={preview.nodeId}
        ref={setPopupRef}
        data-explore-hover-popup
        role="tooltip"
        onPointerEnter={onPopupPointerEnter}
        onPointerLeave={onPopupPointerLeave}
        className={`glass-explore-hover pointer-events-auto fixed ${hoverZClass} max-h-[min(85vh,560px)] overflow-y-auto overscroll-contain rounded-xl`}
        style={{
          width: `min(92vw, ${EXPLORE_DETAIL_PANEL_WIDTH_PX}px)`,
          maxWidth: `min(92vw, ${EXPLORE_DETAIL_PANEL_WIDTH_PX}px)`,
        }}
      >
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex min-w-0 shrink-0 items-start gap-x-2 border-b border-border px-5 pb-3 pt-4">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
              <h2
                className="min-w-0 line-clamp-2 text-xl font-bold leading-tight text-foreground"
                style={{
                  fontFamily:
                    'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
                }}
              >
                {displayName}
              </h2>
              <BuiltUponBadgePopover
                count={builtUponCount}
                borderColor={categoryColor}
              />
            </div>
            <div className="flex shrink-0 justify-end">
              <ShareInventionButton nodeId={node.id} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 px-5 pt-4">
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
            {node.origin_type ? (
              <span className="rounded-full bg-border/25 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {tExplore(originTypeToExploreKey(node.origin_type))}
              </span>
            ) : null}
            {node.nature_type ? (
              <span className="rounded-full bg-border/25 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {tExplore(natureTypeToExploreKey(node.nature_type))}
              </span>
            ) : null}
          </div>

          {secondaryTags.length > 0 ? (
            <div className="px-5 pt-4">
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

          <div className="mt-4 w-full shrink-0 px-5">
            {popupImageUrl ? (
              <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-page">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={popupImageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <CardImagePlaceholder
                categoryColor={categoryColor}
                variant="panel"
              />
            )}
          </div>

          <div className="px-5 pt-4 text-sm tabular-nums text-muted-foreground">
            {formatYear(node.year_approx ?? null)}
          </div>

          {originLine ? (
            <p className="px-5 pt-3 text-[13px] leading-snug text-muted-foreground">
              {originLine}
            </p>
          ) : null}

          <p className="px-5 pb-4 pt-4 text-sm leading-relaxed text-muted-foreground">
            {description || '—'}
          </p>
        </div>
      </div>
    ) : null;

  return createPortal(el, document.body);
}

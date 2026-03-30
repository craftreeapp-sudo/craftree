'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore, getNodeDetails } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';
import type { ExploreHoverPreview } from '@/components/explore/explore-card-context';
import { formatYear } from '@/lib/utils';
import { getCategoryColor, hexToRgba } from '@/lib/colors';
import { directDependencyCount } from '@/lib/built-upon-utils';
import {
  pickNodeDisplayName,
  pickNodeDescriptionForLocale,
} from '@/lib/node-display-name';
import type { NodeCategory, TechNodeDetails } from '@/lib/types';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { getTagDisplayLabel } from '@/lib/tag-display';
import { getScrollableAncestors } from '@/lib/dom-scroll-parents';

const POPUP_MAX_W = 340;
/** Aligné sur `ExploreDetailPanel` (fiche) : largeur max + petite marge. */
const DETAIL_PANEL_W = 340;
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
  let popW =
    br.width > 2 ? br.width : Math.min(vw * 0.92, cappedMax);
  let popH =
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
  const tTypes = useTranslations('types');
  const tExplore = useTranslations('explore');
  const tEd = useTranslations('editor');

  const getNodeById = useGraphStore((s) => s.getNodeById);
  const edges = useGraphStore((s) => s.edges);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const detailsById = useNodeDetailsStore((s) => s.byId);

  const preview = ctx?.hoverPreview ?? null;
  const node = preview ? getNodeById(preview.nodeId) : undefined;
  const detail: TechNodeDetails | undefined = node
    ? detailsById[node.id]
    : undefined;

  const popupRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const layoutRef = useRef<HoverLayoutHints>({ reserveRight: 0 });
  const detailOpen = Boolean(ctx?.detailNodeId);
  const isMobile = Boolean(ctx?.isMobile);
  layoutRef.current = {
    reserveRight:
      detailOpen && !isMobile ? DETAIL_PANEL_W + GAP : 0,
  };

  /** Position dès que le nœud portail existe (évite un premier frame sans left/top). */
  const setPopupRef = useCallback((el: HTMLDivElement | null) => {
    popupRef.current = el;
    const p = previewRef.current;
    if (el && p) {
      applyPopupPosition(el, p, layoutRef.current);
    }
  }, []);

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
      const p = previewRef.current;
      const pop = popupRef.current;
      if (!p || !pop) return;
      applyPopupPosition(pop, p, layoutRef.current);
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
  }, [preview, detailOpen, isMobile]);

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

  const directDeps = useMemo(
    () => (node ? directDependencyCount(node.id, edges) : 0),
    [node, edges]
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
    const dim = node.dimension;
    if (dim === 'matter') {
      const d = tEd('dimensionMatter');
      const ml = node.materialLevel;
      const lvlKey =
        ml === 'raw'
          ? 'levelRaw'
          : ml === 'processed'
            ? 'levelProcessed'
            : ml === 'industrial'
              ? 'levelIndustrial'
              : ml === 'component'
                ? 'levelComponent'
                : null;
      const lvl = lvlKey ? tEd(lvlKey) : '';
      return lvl ? `${d} · ${lvl}` : d;
    }
    if (dim === 'process') return tEd('dimensionProcess');
    if (dim === 'tool') return tEd('dimensionTool');
    return tTypes(node.type);
  }, [node, tEd, tTypes]);

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
        className={`pointer-events-none fixed ${hoverZClass} max-h-[min(85vh,560px)] w-[min(92vw,340px)] max-w-[min(92vw,340px)] overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl`}
      >
        <div className="flex min-h-0 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 pb-3 pt-4">
            <h2
              className="min-w-0 flex-1 text-xl font-bold leading-tight text-foreground"
              style={{
                fontFamily:
                  'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              }}
            >
              {displayName}
            </h2>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 text-xs font-semibold tabular-nums text-foreground"
              style={{
                borderColor: categoryColor,
                backgroundColor: hexToRgba(categoryColor, 0.12),
              }}
              title={tExplore('directDepsBadgeTitle')}
            >
              {directDeps}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 px-4 pt-4">
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{
                backgroundColor: `${categoryColor}35`,
                color: categoryColor,
              }}
            >
              {safeCategoryLabel(
                tCat,
                String(node.category),
                tTypes
              )}
            </span>
            <span className="rounded-full bg-border/25 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {natureLine}
            </span>
          </div>

          {secondaryTags.length > 0 ? (
            <div className="px-4 pt-4">
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

          <div className="mt-4 w-full shrink-0 px-4">
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
              <div
                className="flex min-h-[120px] w-full items-center justify-center rounded-lg px-4 py-6 text-center text-base font-semibold text-white"
                style={{ backgroundColor: categoryColor }}
              >
                {displayName}
              </div>
            )}
          </div>

          <div className="px-4 pt-4 text-sm tabular-nums text-muted-foreground">
            {formatYear(node.year_approx ?? null)}
          </div>

          {originLine ? (
            <p className="px-4 pt-3 text-[13px] leading-snug text-muted-foreground">
              {originLine}
            </p>
          ) : null}

          <p className="px-4 pb-4 pt-4 text-sm leading-relaxed text-muted-foreground">
            {description || '—'}
          </p>
        </div>
      </div>
    ) : null;

  return createPortal(el, document.body);
}

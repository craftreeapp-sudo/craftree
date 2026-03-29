'use client';

import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore, getNodeDetails } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';
import { formatYear } from '@/lib/utils';
import { getCategoryColor } from '@/lib/colors';
import {
  pickNodeDisplayName,
  pickNodeDescriptionForLocale,
} from '@/lib/node-display-name';
import type { NodeCategory, TechNodeDetails } from '@/lib/types';
import { safeCategoryLabel } from '@/lib/safe-category-label';

const POPUP_MAX_W = 300;
const GAP = 10;

export function ExploreHoverPopup() {
  const ctx = useExploreCardOptional();
  const locale = useLocale();
  const tCat = useTranslations('categories');
  const tTypes = useTranslations('types');
  const tEra = useTranslations('eras');
  const tEd = useTranslations('editor');

  const getNodeById = useGraphStore((s) => s.getNodeById);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const detailsById = useNodeDetailsStore((s) => s.byId);

  const preview = ctx?.hoverPreview ?? null;
  const node = preview ? getNodeById(preview.nodeId) : undefined;
  const detail: TechNodeDetails | undefined = node
    ? detailsById[node.id]
    : undefined;

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

  const pos = useMemo(() => {
    if (!preview) return null;
    const { rect } = preview;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const preferRight = rect.right + GAP + POPUP_MAX_W <= vw - 8;
    const left = preferRight
      ? rect.right + GAP
      : Math.max(8, rect.left - GAP - POPUP_MAX_W);
    const top = Math.min(Math.max(8, rect.top), vh - 120);
    return { left, top };
  }, [preview]);

  const displayName = useMemo(() => {
    if (!node) return '';
    return pickNodeDisplayName(locale, node.name, detail?.name_en);
  }, [locale, node, detail?.name_en]);

  const description = useMemo(() => {
    if (!detail) return '';
    const d = pickNodeDescriptionForLocale(
      locale,
      detail.description,
      detail.description_en
    );
    return d.length > 280 ? `${d.slice(0, 277)}…` : d;
  }, [detail, locale]);

  const categoryColor = node
    ? getCategoryColor(node.category as NodeCategory)
    : '#3B82F6';

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
    return out.slice(0, 8);
  }, [node, detail?.tags]);

  if (!ctx || typeof document === 'undefined') return null;

  const el =
    preview && node && pos ? (
      <motion.div
        key={preview.nodeId}
        data-explore-hover-popup
        role="tooltip"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="pointer-events-none fixed z-[95] max-h-[min(70vh,420px)] w-[min(92vw,300px)] overflow-y-auto rounded-xl border border-border bg-surface-elevated p-3 shadow-2xl"
        style={{ left: pos.left, top: pos.top, maxWidth: POPUP_MAX_W }}
      >
        <h3
          className="text-sm font-bold leading-snug text-foreground"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          {displayName}
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {originLine ? (
            <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-100/90">
              {originLine}
            </span>
          ) : null}
          <span className="rounded-md bg-border/20 px-2 py-0.5 text-[10px] text-muted-foreground">
            {natureLine}
          </span>
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `${categoryColor}28`,
              color: categoryColor,
            }}
          >
            {safeCategoryLabel(
              tCat,
              String(node.category),
              tTypes
            )}
          </span>
          <span className="rounded-md bg-border/20 px-2 py-0.5 text-[10px] text-muted-foreground">
            {tEra(node.era)}
          </span>
        </div>
        {secondaryTags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {secondaryTags.map((tag) => (
              <span
                key={tag}
                className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
          {formatYear(node.year_approx ?? null)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </motion.div>
    ) : null;

  return createPortal(
    <AnimatePresence>{el}</AnimatePresence>,
    document.body
  );
}

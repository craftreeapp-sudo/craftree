'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore, getNodeDetails } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';
import { formatYear } from '@/lib/utils';
import { getCategoryColor } from '@/lib/colors';
import { trackEvent } from '@/lib/analytics';
import {
  pickNodeDisplayName,
  pickNodeDescriptionForLocale,
} from '@/lib/node-display-name';
import type { NodeCategory, TechNodeDetails } from '@/lib/types';

const PANEL_W = 340;
const TRANSITION = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const };

function materialLevelEditorKey(
  level: NonNullable<import('@/lib/types').TechNodeBasic['materialLevel']>
) {
  const map = {
    raw: 'levelRaw',
    processed: 'levelProcessed',
    industrial: 'levelIndustrial',
    component: 'levelComponent',
  } as const;
  return map[level];
}

export function ExploreDetailPanel() {
  const ctx = useExploreCardOptional();
  const locale = useLocale();
  const tExplore = useTranslations('explore');
  const tSidebar = useTranslations('sidebar');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tCat = useTranslations('categories');
  const tTypes = useTranslations('types');
  const tEra = useTranslations('eras');
  const tEd = useTranslations('editor');

  const getNodeById = useGraphStore((s) => s.getNodeById);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const detailsById = useNodeDetailsStore((s) => s.byId);
  const selectNode = useUIStore((s) => s.selectNode);
  const { isAdmin } = useAuthStore();
  const pushToast = useToastStore((s) => s.pushToast);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [mainImgErr, setMainImgErr] = useState(false);

  const detailNodeId = ctx?.detailNodeId ?? null;
  const isMobile = ctx?.isMobile ?? false;

  const node = detailNodeId ? getNodeById(detailNodeId) : undefined;
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

  /* Réinitialise menu / image quand on change d’invention dans le panneau */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset explicite au changement de cible
    setMoreOpen(false);
    setMainImgErr(false);
  }, [detailNodeId]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const handleShare = useCallback(() => {
    if (!node) return;
    trackEvent('share', node.id);
    const url = `${window.location.origin}/invention/${encodeURIComponent(node.id)}`;
    void navigator.clipboard.writeText(url);
    pushToast(tCommon('linkCopied'), 'success');
  }, [node, pushToast, tCommon]);

  const enterSuggest = useCallback(() => {
    if (!node) return;
    selectNode(node.id, {
      openSidebar: true,
      openSuggest: true,
      center: false,
    });
  }, [node, selectNode]);

  const enterEdit = useCallback(() => {
    if (!node) return;
    selectNode(node.id, {
      openSidebar: true,
      openEdit: true,
      center: false,
    });
  }, [node, selectNode]);

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
    const dim = node.dimension;
    if (dim === 'matter') {
      const d = tEd('dimensionMatter');
      const ml = node.materialLevel;
      const lvl = ml ? tEd(materialLevelEditorKey(ml)) : '';
      return lvl ? `${d} · ${lvl}` : d;
    }
    if (dim === 'process') return tEd('dimensionProcess');
    if (dim === 'tool') return tEd('dimensionTool');
    return tTypes(node.type);
  }, [node, tEd, tTypes]);

  const originLine = (node?.origin ?? detail?.origin ?? '').trim();

  const panelInner =
    !node ? null : (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 pb-3 pt-4">
          <h2
            id="explore-detail-title"
            className="min-w-0 flex-1 text-xl font-bold leading-tight text-foreground"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            }}
          >
            {displayName}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => void enterEdit()}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground"
                aria-label={tSidebar('editInvention')}
              >
                <span className="text-base leading-none">✏️</span>
              </button>
            ) : null}
            <div className="relative" ref={moreRef}>
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
                  className="absolute end-0 top-[calc(100%+6px)] z-[90] min-w-[180px] rounded-md border border-border bg-surface-elevated py-1 shadow-lg"
                  role="menu"
                >
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
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] text-foreground hover:bg-border/25"
                    role="menuitem"
                    onClick={() => {
                      handleShare();
                      setMoreOpen(false);
                    }}
                  >
                    {tCommon('share')}
                  </button>
                  {!isAdmin ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-start text-[13px] text-foreground hover:bg-border/25"
                      role="menuitem"
                      onClick={() => {
                        enterSuggest();
                        setMoreOpen(false);
                      }}
                    >
                      {tAuth('suggestCorrection')}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-4 pt-4">
          {originLine ? (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-medium text-amber-100/95">
              {tExplore('detailTagOrigin')}: {originLine}
            </span>
          ) : null}
          <span className="rounded-full bg-border/20 px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {tExplore('detailTagNature')}: {natureLine}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: `${categoryColor}30`,
              color: categoryColor,
            }}
          >
            {tCat(node.category as NodeCategory)}
          </span>
          <span className="rounded-full bg-border/20 px-2.5 py-1 text-xs text-muted-foreground">
            {tEra(node.era)}
          </span>
        </div>

        {secondaryTags.length > 0 ? (
          <div className="px-4 pt-3">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tExplore('detailTagSecondary')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {secondaryTags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border bg-surface-elevated px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 w-full shrink-0 px-4">
          {imageSrc && !mainImgErr ? (
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-page">
              <Image
                src={imageSrc}
                alt=""
                fill
                className="object-cover"
                sizes="340px"
                unoptimized={imageUnoptimized}
                onError={() => setMainImgErr(true)}
              />
            </div>
          ) : (
            <div
              className="flex min-h-[140px] w-full items-center justify-center rounded-lg px-4 py-8 text-center text-lg font-semibold text-white"
              style={{ backgroundColor: categoryColor }}
            >
              {displayName}
            </div>
          )}
        </div>

        {extraThumbs.length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
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

        <div className="px-4 pt-4 text-sm tabular-nums text-muted-foreground">
          {formatYear(node.year_approx ?? null)}
        </div>

        <p className="px-4 pt-4 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>

        {!isAdmin ? (
          <div className="mt-6 px-4 pb-8">
            <button
              type="button"
              onClick={() => void enterSuggest()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-amber-500"
            >
              {tAuth('suggestCorrection')}
            </button>
          </div>
        ) : (
          <div className="pb-8" />
        )}
      </div>
    );

  if (!ctx) return null;

  return (
    <AnimatePresence>
      {detailNodeId && node ? (
        <motion.aside
          key="explore-detail"
          role="complementary"
          aria-labelledby="explore-detail-title"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={TRANSITION}
          className={`fixed bottom-0 right-0 top-14 z-[80] flex flex-col border-l border-border bg-surface shadow-2xl ${
            isMobile ? 'w-full' : 'w-[min(100vw,350px)]'
          }`}
          style={isMobile ? undefined : { maxWidth: PANEL_W }}
        >
          {panelInner}
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

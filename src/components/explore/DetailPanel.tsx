'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore, getNodeDetails } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useAuthStore } from '@/stores/auth-store';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';
import { formatYear } from '@/lib/utils';
import { getCategoryColor, hexToRgba } from '@/lib/colors';
import { trackEvent } from '@/lib/analytics';
import {
  pickNodeDisplayName,
  pickNodeDescriptionForLocale,
} from '@/lib/node-display-name';
import type { NodeCategory, TechNodeDetails } from '@/lib/types';
import { SuggestNodeCorrectionPanel } from '@/components/ui/SuggestNodeCorrectionPanel';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { getTagDisplayLabel } from '@/lib/tag-display';
import {
  natureTypeToExploreKey,
  originTypeToExploreKey,
} from '@/lib/explore-classification-badges';
import {
  ExploreLedToRow,
  ExploreRecipeRow,
} from '@/components/explore/ExploreDetailLinkRows';
import { CardImagePlaceholder } from '@/components/explore/CardImagePlaceholder';
import { ShareInventionButton } from '@/components/explore/ShareInventionButton';
import { treeLayerDisplayIndexFromNode } from '@/lib/tree-layers';
import { EXPLORE_DETAIL_PANEL_WIDTH_PX } from '@/lib/explore-layout';
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
  const tAuth = useTranslations('auth');
  const tCat = useTranslations('categories');
  const tTypes = useTranslations('types');
  const tEd = useTranslations('editor');

  const getNodeById = useGraphStore((s) => s.getNodeById);
  const getRecipeForNode = useGraphStore((s) => s.getRecipeForNode);
  const getUsagesOfNode = useGraphStore((s) => s.getUsagesOfNode);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const mergeDetail = useNodeDetailsStore((s) => s.mergeDetail);
  const detailsById = useNodeDetailsStore((s) => s.byId);
  const { isAdmin } = useAuthStore();
  const refreshData = useGraphStore((s) => s.refreshData);

  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [mainImgErr, setMainImgErr] = useState(false);
  const [ledToOpen, setLedToOpen] = useState(true);
  const [builtUponOpen, setBuiltUponOpen] = useState(true);

  const detailNodeId = ctx?.detailNodeId ?? null;
  const detailSubview = ctx?.detailSubview ?? 'detail';
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

  const enterSuggest = useCallback(() => {
    if (!node) return;
    ctx?.openSuggestSubview();
  }, [node, ctx]);

  const enterEdit = useCallback(() => {
    if (!node) return;
    ctx?.openAdminEditSubview();
  }, [node, ctx]);

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

  const recipeLinks = useMemo(
    () => (node ? getRecipeForNode(node.id) : []),
    [node, getRecipeForNode]
  );

  const usages = useMemo(
    () => (node ? getUsagesOfNode(node.id) : []),
    [node, getUsagesOfNode]
  );

  const layerDisplay = useMemo(
    () => (node ? treeLayerDisplayIndexFromNode(node) : 0),
    [node]
  );

  const openPeerDetail = useCallback(
    (id: string, direction: 'upstream' | 'downstream') => {
      if (node) {
        trackEvent('navigate_link', id, {
          from: node.id,
          direction,
        });
      }
      ctx?.openDetail(id);
    },
    [ctx, node]
  );

  const panelInner =
    !node ? null : (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {/* 1. Titre + couche (adjacents) | actions */}
        <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 border-b border-border px-5 pb-3 pt-4">
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
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 text-xs font-semibold tabular-nums text-foreground"
            style={{
              borderColor: categoryColor,
              backgroundColor: hexToRgba(categoryColor, 0.12),
            }}
            title={tExplore('layerShort', { layer: layerDisplay })}
          >
            {layerDisplay}
          </span>
          <div className="flex shrink-0 items-center justify-end gap-0.5">
          <ShareInventionButton nodeId={node.id} />
          {isAdmin ? (
            <button
              type="button"
              onClick={() => void enterEdit()}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground"
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
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* 2. Pastilles : catégorie + nature (matière / procédé / outil & niveau) */}
        <div className="flex flex-wrap gap-2 px-5 pt-4">
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

        {/* 3. Tags */}
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

        {/* 4. Visuel */}
        <div className="mt-4 w-full shrink-0 px-5">
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
              {tExplore('ledTo')} ({usages.length})
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
            usages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tExplore('noDownstream')}
              </p>
            ) : (
              <ul className="space-y-3">
                {usages.map(({ link, product }) => (
                  <ExploreLedToRow
                    key={link.id}
                    link={link}
                    product={product}
                    locale={locale}
                    detailsById={detailsById}
                    onSelectProduct={(id) => openPeerDetail(id, 'downstream')}
                  />
                ))}
              </ul>
            )
          ) : null}

          <button
            type="button"
            onClick={() => setBuiltUponOpen((v) => !v)}
            className="mb-3 mt-6 flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-start transition-colors hover:bg-surface/50"
            aria-expanded={builtUponOpen}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {tExplore('builtUpon')} ({recipeLinks.length})
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
            recipeLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tExplore('noUpstream')}
              </p>
            ) : (
              <ul className="space-y-3">
                {recipeLinks.map((link) => (
                  <ExploreRecipeRow
                    key={link.id}
                    link={link}
                    getNodeById={getNodeById}
                    locale={locale}
                    detailsById={detailsById}
                    onSelectIngredient={(id) => openPeerDetail(id, 'upstream')}
                  />
                ))}
              </ul>
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
          key="explore-detail"
          role="complementary"
          aria-labelledby="explore-detail-title"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={TRANSITION}
          className={`fixed bottom-0 right-0 top-14 z-[80] flex flex-col border-l border-border bg-surface shadow-2xl ${
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

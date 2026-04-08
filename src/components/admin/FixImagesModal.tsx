'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DIMENSION_ORDER, NODE_CATEGORY_ORDER, ERA_ORDER } from '@/lib/node-labels';
import { eraLabelFromMessages } from '@/lib/era-display';
import { EDITOR_DIM_KEY } from '@/components/editor/dimension-editor-keys';
import type { Era, NodeCategory, NodeDimension } from '@/lib/types';
import { AIProgressBar } from '@/components/admin/AIProgressBar';
import {
  AiToolsModalCloseButton,
  AiToolsModalShell,
  AiToolsPanelSections,
} from '@/components/admin/AiToolsModalShell';

type Row = { nodeId: string; name: string; url: string | null };

function countPastedIds(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  return new Set(s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))
    .size;
}

function parseYearInput(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.min(2030, Math.max(-10000, Math.round(n)));
}

function parseComplexity(raw: string): number | null {
  const s = raw.trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

export function FixImagesModal({
  open,
  onClose,
  onToast,
}: {
  open: boolean;
  onClose: () => void;
  onToast: (message: string, kind: 'ok' | 'err') => void;
}) {
  const t = useTranslations('editor');
  const tCat = useTranslations('categories');
  const locale = useLocale();
  const [limit, setLimit] = useState(30);
  const [filterCategory, setFilterCategory] = useState<'all' | NodeCategory>('all');
  const [filterEra, setFilterEra] = useState<'all' | Era>('all');
  const [filterYearMin, setFilterYearMin] = useState('');
  const [filterYearMax, setFilterYearMax] = useState('');
  const [draftScope, setDraftScope] = useState<
    'all' | 'drafts_only' | 'published_only'
  >('all');
  const [excludeLocked, setExcludeLocked] = useState(true);
  const [complexityMinStr, setComplexityMinStr] = useState('');
  const [complexityMaxStr, setComplexityMaxStr] = useState('');
  const [dimension, setDimension] = useState<'all' | NodeDimension>('all');
  const [requireWikipediaUrl, setRequireWikipediaUrl] = useState(false);
  const [onlyWithoutImage, setOnlyWithoutImage] = useState(true);
  const [inventionIdsText, setInventionIdsText] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [poolCount, setPoolCount] = useState<number | null>(null);
  const [costPerPreviewRowEur, setCostPerPreviewRowEur] = useState<number | null>(
    null
  );
  const [dryEstimate, setDryEstimate] = useState<{
    resolved: number;
    pool: number;
    eur: number;
  } | null>(null);

  const scopeBody = useMemo(
    () => ({
      filterCategory: filterCategory === 'all' ? undefined : filterCategory,
      filterEra: filterEra === 'all' ? undefined : filterEra,
      filterYearMin: parseYearInput(filterYearMin),
      filterYearMax: parseYearInput(filterYearMax),
      excludeLocked,
      draftScope: draftScope === 'all' ? undefined : draftScope,
      complexityMin: parseComplexity(complexityMinStr),
      complexityMax: parseComplexity(complexityMaxStr),
      dimension: dimension === 'all' ? undefined : dimension,
      requireWikipediaUrl: requireWikipediaUrl || undefined,
    }),
    [
      filterCategory,
      filterEra,
      filterYearMin,
      filterYearMax,
      excludeLocked,
      draftScope,
      complexityMinStr,
      complexityMaxStr,
      dimension,
      requireWikipediaUrl,
    ]
  );

  const countQuery = useMemo(() => {
    const sp = new URLSearchParams();
    if (scopeBody.filterCategory)
      sp.set('filterCategory', scopeBody.filterCategory);
    if (scopeBody.filterEra) sp.set('filterEra', scopeBody.filterEra);
    if (scopeBody.filterYearMin != null)
      sp.set('filterYearMin', String(scopeBody.filterYearMin));
    if (scopeBody.filterYearMax != null)
      sp.set('filterYearMax', String(scopeBody.filterYearMax));
    sp.set('excludeLocked', excludeLocked ? '1' : '0');
    if (draftScope !== 'all') sp.set('draftScope', draftScope);
    const cmin = parseComplexity(complexityMinStr);
    const cmax = parseComplexity(complexityMaxStr);
    if (cmin != null) sp.set('complexityMin', String(cmin));
    if (cmax != null) sp.set('complexityMax', String(cmax));
    if (dimension !== 'all') sp.set('dimension', dimension);
    if (requireWikipediaUrl) sp.set('requireWikipediaUrl', '1');
    sp.set('onlyWithoutImage', onlyWithoutImage ? '1' : '0');
    if (inventionIdsText.trim())
      sp.set('inventionIdsText', inventionIdsText.trim());
    return sp;
  }, [
    scopeBody.filterCategory,
    scopeBody.filterEra,
    scopeBody.filterYearMin,
    scopeBody.filterYearMax,
    excludeLocked,
    draftScope,
    complexityMinStr,
    complexityMaxStr,
    dimension,
    requireWikipediaUrl,
    onlyWithoutImage,
    inventionIdsText,
  ]);

  const refreshPoolCount = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/ai-tools/fix-images?${countQuery}`,
        { credentials: 'same-origin' }
      );
      const j = (await res.json().catch(() => ({}))) as {
        count?: number;
        costPerPreviewRowEur?: number;
        error?: string;
      };
      if (!res.ok) {
        onToast(String(j.error ?? t('aiToolsImagesError')), 'err');
        return;
      }
      setPoolCount(j.count ?? 0);
      setCostPerPreviewRowEur(
        typeof j.costPerPreviewRowEur === 'number'
          ? j.costPerPreviewRowEur
          : null
      );
    } catch {
      onToast(t('aiToolsImagesError'), 'err');
    }
  }, [countQuery, onToast, t]);

  const imagesPanelSummary = useMemo(() => {
    const yMin = parseYearInput(filterYearMin);
    const yMax = parseYearInput(filterYearMax);
    const cmin = parseComplexity(complexityMinStr);
    const cmax = parseComplexity(complexityMaxStr);
    const idN = countPastedIds(inventionIdsText);
    const dimLabel =
      dimension === 'all'
        ? t('allDimensions')
        : t(EDITOR_DIM_KEY[dimension]);
    const items: { key: string; text: string }[] = [
      {
        key: 'lim',
        text: t('aiToolsPanelImagesBulletLimit', { n: limit }),
      },
      {
        key: 'wiki',
        text: requireWikipediaUrl
          ? t('aiToolsPanelImagesBulletWikiOnly')
          : t('aiToolsPanelImagesBulletWikiFallback'),
      },
      {
        key: 'img',
        text: onlyWithoutImage
          ? t('aiToolsPanelImagesBulletOnlyNoImage')
          : t('aiToolsPanelImagesBulletAnyImage'),
      },
    ];
    if (filterCategory !== 'all') {
      items.push({
        key: 'cat',
        text: t('aiToolsPanelBulletCategory', {
          name: tCat(filterCategory),
        }),
      });
    }
    if (filterEra !== 'all') {
      items.push({
        key: 'era',
        text: t('aiToolsPanelBulletEra', {
          name: eraLabelFromMessages(locale, filterEra),
        }),
      });
    }
    if (yMin != null && yMax != null) {
      items.push({
        key: 'years',
        text: t('aiToolsPanelBulletYears', { min: yMin, max: yMax }),
      });
    } else if (yMin != null) {
      items.push({
        key: 'ymin',
        text: t('aiToolsPanelBulletYearMin', { min: yMin }),
      });
    } else if (yMax != null) {
      items.push({
        key: 'ymax',
        text: t('aiToolsPanelBulletYearMax', { max: yMax }),
      });
    }
    if (dimension !== 'all') {
      items.push({
        key: 'dim',
        text: t('aiToolsPanelAddBulletDim', { name: dimLabel }),
      });
    }
    items.push({
      key: 'lock',
      text: excludeLocked
        ? t('aiToolsPanelBulletLockedExcl')
        : t('aiToolsPanelBulletLockedIncl'),
    });
    if (draftScope === 'drafts_only') {
      items.push({
        key: 'draft',
        text: t('aiToolsPanelBulletDraftsOnly'),
      });
    } else if (draftScope === 'published_only') {
      items.push({
        key: 'pub',
        text: t('aiToolsPanelBulletPublishedOnly'),
      });
    } else {
      items.push({
        key: 'draftall',
        text: t('aiToolsPanelBulletDraftAll'),
      });
    }
    if (cmin != null && cmax != null) {
      items.push({
        key: 'cx',
        text: t('aiToolsPanelBulletComplexity', { min: cmin, max: cmax }),
      });
    } else if (cmin != null) {
      items.push({
        key: 'cxmin',
        text: t('aiToolsPanelBulletComplexityMin', { min: cmin }),
      });
    } else if (cmax != null) {
      items.push({
        key: 'cxmax',
        text: t('aiToolsPanelBulletComplexityMax', { max: cmax }),
      });
    }
    if (idN > 0) {
      items.push({
        key: 'ids',
        text: t('aiToolsPanelBulletIdList', { count: idN }),
      });
    }
    if (poolCount !== null) {
      items.push({
        key: 'pool',
        text: t('aiToolsPanelImagesBulletPool', { n: poolCount }),
      });
    }
    if (dryEstimate) {
      items.push({
        key: 'dry',
        text: t('aiToolsPanelImagesBulletDry', {
          resolved: dryEstimate.resolved,
          pool: dryEstimate.pool,
          eur: dryEstimate.eur.toFixed(4),
        }),
      });
    }
    return (
      <ul className="list-disc space-y-1.5 pl-4">
        {items.map((it) => (
          <li key={it.key}>{it.text}</li>
        ))}
      </ul>
    );
  }, [
    complexityMaxStr,
    complexityMinStr,
    dimension,
    draftScope,
    dryEstimate,
    excludeLocked,
    filterCategory,
    filterEra,
    filterYearMax,
    filterYearMin,
    inventionIdsText,
    limit,
    locale,
    onlyWithoutImage,
    poolCount,
    requireWikipediaUrl,
    t,
    tCat,
  ]);

  const runDryEstimate = async () => {
    setLoading(true);
    setDryEstimate(null);
    try {
      const res = await fetch('/api/ai-tools/fix-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          dryRun: true,
          limit,
          onlyWithoutImage,
          inventionIdsText: inventionIdsText.trim() || undefined,
          ...scopeBody,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        resolvedCount?: number;
        poolSize?: number;
        estimatedCostEur?: number;
      };
      if (!res.ok) {
        onToast(String(j.error ?? t('aiToolsImagesError')), 'err');
        return;
      }
      setDryEstimate({
        resolved: j.resolvedCount ?? 0,
        pool: j.poolSize ?? 0,
        eur: j.estimatedCostEur ?? 0,
      });
    } catch {
      onToast(t('aiToolsImagesError'), 'err');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const indicativeEur =
    poolCount != null && costPerPreviewRowEur != null
      ? Math.min(limit, poolCount) * costPerPreviewRowEur
      : null;

  const preview = async () => {
    setLoading(true);
    setRows([]);
    setSelected({});
    setDryEstimate(null);
    try {
      const res = await fetch('/api/ai-tools/fix-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          limit,
          onlyWithoutImage,
          inventionIdsText: inventionIdsText.trim() || undefined,
          ...scopeBody,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        results?: Row[];
      };
      if (!res.ok) {
        onToast(String(j.error ?? t('aiToolsImagesError')), 'err');
        return;
      }
      const list = j.results ?? [];
      setRows(list);
      const sel: Record<string, boolean> = {};
      for (const r of list) {
        if (r.url) sel[r.nodeId] = true;
      }
      setSelected(sel);
      onToast(t('aiToolsImagesPreviewDone', { n: list.length }), 'ok');
    } catch {
      onToast(t('aiToolsImagesError'), 'err');
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    const updates = rows
      .filter((r) => selected[r.nodeId] && r.url)
      .map((r) => ({ nodeId: r.nodeId, imageUrl: r.url! }));
    if (updates.length === 0) {
      onToast(t('aiToolsImagesNoSelection'), 'err');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ai-tools/fix-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ updates }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        updated?: number;
      };
      if (!res.ok) {
        onToast(String(j.error ?? t('aiToolsImagesError')), 'err');
        return;
      }
      onToast(t('aiToolsImagesApplyDone', { n: j.updated ?? 0 }), 'ok');
      onClose();
    } catch {
      onToast(t('aiToolsImagesError'), 'err');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-xl border border-border bg-page p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 text-lg font-semibold">
            {t('aiToolsImagesTitle')}
          </h2>
          <AiToolsModalCloseButton
            onClose={onClose}
            label={t('aiToolsModalCloseAria')}
          />
        </div>
        <AiToolsModalShell
          form={
            <>
              <p className="text-sm text-muted-foreground">{t('aiToolsImagesHint')}</p>
              <div className="space-y-3 text-sm">
                <p className="text-xs font-medium text-foreground">
                  {t('aiToolsFixScopeTitle')}
                </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-muted-foreground">
              {t('aiReviewFilterCategory')}
              <select
                value={filterCategory}
                onChange={(e) =>
                  setFilterCategory(e.target.value as 'all' | NodeCategory)
                }
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              >
                <option value="all">{t('allCategories')}</option>
                {NODE_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {tCat(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-muted-foreground">
              {t('aiReviewFilterEra')}
              <select
                value={filterEra}
                onChange={(e) =>
                  setFilterEra(e.target.value as 'all' | Era)
                }
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              >
                <option value="all">{t('allEras')}</option>
                {ERA_ORDER.map((e) => (
                  <option key={e} value={e}>
                    {eraLabelFromMessages(locale, e)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-muted-foreground">
              {t('aiReviewFilterYearMin')}
              <input
                type="number"
                inputMode="numeric"
                placeholder={t('aiReviewFilterYearPlaceholder')}
                value={filterYearMin}
                onChange={(e) => setFilterYearMin(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              />
            </label>
            <label className="block text-muted-foreground">
              {t('aiReviewFilterYearMax')}
              <input
                type="number"
                inputMode="numeric"
                placeholder={t('aiReviewFilterYearPlaceholder')}
                value={filterYearMax}
                onChange={(e) => setFilterYearMax(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              />
            </label>
          </div>
          <label className="block text-muted-foreground">
            {t('columnDimension')}
            <select
              value={dimension}
              onChange={(e) => {
                const v = e.target.value;
                setDimension(v === 'all' ? 'all' : (v as NodeDimension));
              }}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
            >
              <option value="all">{t('allDimensions')}</option>
              {DIMENSION_ORDER.map((d) => (
                <option key={d} value={d}>
                  {t(EDITOR_DIM_KEY[d])}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-muted-foreground">
            {t('aiToolsReviewDraftScope')}
            <select
              value={draftScope}
              onChange={(e) =>
                setDraftScope(e.target.value as typeof draftScope)
              }
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
            >
              <option value="all">{t('aiToolsEnrichDraftAll')}</option>
              <option value="drafts_only">{t('aiToolsEnrichDraftsOnly')}</option>
              <option value="published_only">
                {t('aiToolsEnrichPublishedOnly')}
              </option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={excludeLocked}
              onChange={(e) => setExcludeLocked(e.target.checked)}
            />
            {t('aiToolsReviewExcludeLocked')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-muted-foreground">
              {t('aiToolsReviewComplexityMin')}
              <input
                type="number"
                min={0}
                value={complexityMinStr}
                onChange={(e) => setComplexityMinStr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              />
            </label>
            <label className="block text-muted-foreground">
              {t('aiToolsReviewComplexityMax')}
              <input
                type="number"
                min={0}
                value={complexityMaxStr}
                onChange={(e) => setComplexityMaxStr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              />
            </label>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={requireWikipediaUrl}
              onChange={(e) => setRequireWikipediaUrl(e.target.checked)}
            />
            {t('aiToolsFixRequireWiki')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyWithoutImage}
              onChange={(e) => setOnlyWithoutImage(e.target.checked)}
            />
            {t('aiToolsFixOnlyNoImage')}
          </label>
          <label className="block text-muted-foreground">
            {t('aiToolsFixIdList')}
            <textarea
              value={inventionIdsText}
              onChange={(e) => setInventionIdsText(e.target.value)}
              placeholder={t('aiToolsReviewIdListPlaceholder')}
              rows={3}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
            />
          </label>
              </div>

              <div className="flex flex-wrap items-end gap-3 pt-2">
                <label className="text-sm text-muted-foreground">
                  {t('aiToolsImagesLimit')}
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value) || 1)}
                    className="ml-2 w-24 rounded-lg border border-border bg-surface px-2 py-1 text-foreground"
                  />
                </label>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void refreshPoolCount()}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  {t('aiToolsEnrichCount')}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void runDryEstimate()}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  {t('aiToolsCostEstimateBtn')}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void preview()}
                  className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm text-violet-100"
                >
                  {t('aiToolsImagesPreview')}
                </button>
              </div>
              {poolCount !== null ? (
                <p className="text-xs text-muted-foreground">
                  {t('aiToolsEnrichCountResult', { n: poolCount })}
                </p>
              ) : null}
              {indicativeEur != null ? (
                <p className="text-xs text-muted-foreground">
                  {t('aiToolsCostEstimate', {
                    eur: indicativeEur.toFixed(4),
                  })}
                </p>
              ) : null}
              {dryEstimate ? (
                <p className="text-sm text-muted-foreground">
                  {t('aiToolsCostEstimate', {
                    eur: dryEstimate.eur.toFixed(4),
                  })}{' '}
                  · {dryEstimate.resolved} / {dryEstimate.pool} ligne(s)
                </p>
              ) : null}
              {loading ? (
                <div className="mt-3">
                  <AIProgressBar indeterminate />
                </div>
              ) : null}
            </>
          }
          panel={
            <AiToolsPanelSections
              aboutTitle={t('aiToolsPanelAboutTitle')}
              aboutBody={t('aiToolsPanelImagesIntro')}
              summaryTitle={t('aiToolsPanelSummaryTitle')}
              summaryBody={imagesPanelSummary}
            />
          }
        />
        {rows.length > 0 ? (
          <div className="mt-4 max-h-[45vh] overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-surface text-muted-foreground">
                <tr>
                  <th className="p-2 w-8" />
                  <th className="p-2">{t('name')}</th>
                  <th className="p-2">URL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.nodeId} className="border-t border-border/60">
                    <td className="p-2">
                      <input
                        type="checkbox"
                        disabled={!r.url}
                        checked={Boolean(selected[r.nodeId])}
                        onChange={(e) =>
                          setSelected((s) => ({
                            ...s,
                            [r.nodeId]: e.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td className="p-2 text-foreground">{r.name}</td>
                    <td className="max-w-[200px] truncate p-2 font-mono text-[10px] text-muted-foreground">
                      {r.url ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <button
            type="button"
            disabled={loading || rows.length === 0}
            onClick={() => void apply()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {t('aiToolsImagesApply')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground"
          >
            {t('aiReviewBatchClose')}
          </button>
        </div>
      </div>
    </div>
  );
}

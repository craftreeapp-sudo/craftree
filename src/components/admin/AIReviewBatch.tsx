'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { NODE_CATEGORY_ORDER, ERA_ORDER } from '@/lib/node-labels';
import { eraLabelFromMessages } from '@/lib/era-display';
import type { Era, NodeCategory } from '@/lib/types';
import {
  AiToolsModalCloseButton,
  AiToolsModalShell,
  AiToolsPanelSections,
} from '@/components/admin/AiToolsModalShell';

type BatchFilter = 'no_dimension' | 'no_material_level' | 'zero_links' | 'all';
type ReviewMode = 'classify' | 'links' | 'full';

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

function countPastedIds(raw: string): number {
  const s = raw.trim();
  if (!s) return 0;
  return new Set(s.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))
    .size;
}

export function AIReviewBatch({
  onResult,
}: {
  onResult: (message: string, kind: 'ok' | 'err') => void;
}) {
  const t = useTranslations('editor');
  const tCat = useTranslations('categories');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [batchFilter, setBatchFilter] = useState<BatchFilter>('no_dimension');
  const [filterCategory, setFilterCategory] = useState<'all' | NodeCategory>('all');
  const [filterEra, setFilterEra] = useState<'all' | Era>('all');
  const [filterYearMin, setFilterYearMin] = useState('');
  const [filterYearMax, setFilterYearMax] = useState('');
  const [mode, setMode] = useState<ReviewMode>('full');
  const [inventionIdsText, setInventionIdsText] = useState('');
  const [excludeLocked, setExcludeLocked] = useState(true);
  const [draftScope, setDraftScope] = useState<
    'all' | 'drafts_only' | 'published_only'
  >('all');
  const [complexityMinStr, setComplexityMinStr] = useState('');
  const [complexityMaxStr, setComplexityMaxStr] = useState('');
  const [estimated, setEstimated] = useState<{
    count: number;
    eur: number;
    ids: string[];
  } | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<{
    analyzed: number;
    createdSuggestions: number;
    cleanCards: number;
    errorCount: number;
  } | null>(null);

  const scopePayload = useMemo(() => {
    const yMin = parseYearInput(filterYearMin);
    const yMax = parseYearInput(filterYearMax);
    return {
      filterCategory: filterCategory === 'all' ? undefined : filterCategory,
      filterEra: filterEra === 'all' ? undefined : filterEra,
      filterYearMin: yMin,
      filterYearMax: yMax,
    };
  }, [filterCategory, filterEra, filterYearMin, filterYearMax]);

  const reviewSummary = useMemo(() => {
    const yMin = parseYearInput(filterYearMin);
    const yMax = parseYearInput(filterYearMax);
    const cmin = parseComplexity(complexityMinStr);
    const cmax = parseComplexity(complexityMaxStr);
    const modeLabel =
      mode === 'full'
        ? t('aiReviewModeFull')
        : mode === 'classify'
          ? t('aiReviewModeClassify')
          : t('aiReviewModeLinks');
    const filterLabel =
      batchFilter === 'no_dimension'
        ? t('aiReviewFilterNoDimension')
        : batchFilter === 'no_material_level'
          ? t('aiReviewFilterNoMaterialLevel')
          : batchFilter === 'zero_links'
            ? t('aiReviewFilterZeroLinks')
            : t('aiReviewFilterAll');
    const items: { key: string; text: string }[] = [
      { key: 'mode', text: t('aiToolsPanelBulletMode', { mode: modeLabel }) },
      {
        key: 'filter',
        text: t('aiToolsPanelBulletFilter', { filter: filterLabel }),
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
    const idN = countPastedIds(inventionIdsText);
    if (idN > 0) {
      items.push({
        key: 'ids',
        text: t('aiToolsPanelBulletIdList', { count: idN }),
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
    if (estimated) {
      items.push({
        key: 'est',
        text: t('aiToolsPanelBulletEstimate', {
          count: estimated.count,
          eur: estimated.eur.toFixed(3),
        }),
      });
    } else {
      items.push({
        key: 'noest',
        text: t('aiToolsPanelBulletNoEstimate'),
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
    batchFilter,
    complexityMaxStr,
    complexityMinStr,
    draftScope,
    estimated,
    excludeLocked,
    filterCategory,
    filterEra,
    filterYearMax,
    filterYearMin,
    inventionIdsText,
    locale,
    mode,
    t,
    tCat,
  ]);

  const runDryRun = useCallback(async () => {
    setDryRunLoading(true);
    setSummary(null);
    try {
      const res = await fetch('/api/ai-tools/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          dryRun: true,
          batchFilter,
          mode,
          ...scopePayload,
          inventionIdsText: inventionIdsText.trim() || undefined,
          excludeLocked,
          draftScope: draftScope === 'all' ? undefined : draftScope,
          complexityMin: parseComplexity(complexityMinStr),
          complexityMax: parseComplexity(complexityMaxStr),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        resolvedCount?: number;
        estimatedCostEur?: number;
        inventionIds?: string[];
      };
      if (!res.ok) {
        onResult(String(j.error ?? t('aiReviewError')), 'err');
        return;
      }
      setEstimated({
        count: j.resolvedCount ?? 0,
        eur: j.estimatedCostEur ?? 0,
        ids: j.inventionIds ?? [],
      });
    } catch {
      onResult(t('aiReviewError'), 'err');
    } finally {
      setDryRunLoading(false);
    }
  }, [
    batchFilter,
    complexityMaxStr,
    complexityMinStr,
    draftScope,
    excludeLocked,
    inventionIdsText,
    mode,
    onResult,
    scopePayload,
    t,
  ]);

  const closeModal = useCallback(() => {
    setOpen(false);
    setEstimated(null);
    setSummary(null);
  }, []);

  const runAnalysis = useCallback(async () => {
    const ids = estimated?.ids;
    if (!ids?.length) {
      onResult(t('aiReviewBatchNoIds'), 'err');
      return;
    }
    if (
      typeof window !== 'undefined' &&
      !window.confirm(t('aiReviewBatchConfirm', { count: ids.length }))
    ) {
      return;
    }
    setRunLoading(true);
    setProgress(0);
    setSummary(null);
    try {
      const res = await fetch('/api/ai-tools/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          inventionIds: ids,
          mode,
          batchFilter,
          ...scopePayload,
          excludeLocked,
          draftScope: draftScope === 'all' ? undefined : draftScope,
          complexityMin: parseComplexity(complexityMinStr),
          complexityMax: parseComplexity(complexityMaxStr),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        analyzed?: number;
        createdSuggestions?: number;
        cleanCards?: number;
        errors?: unknown[];
      };
      setProgress(1);
      if (!res.ok) {
        onResult(String(j.error ?? t('aiReviewError')), 'err');
        return;
      }
      setSummary({
        analyzed: j.analyzed ?? ids.length,
        createdSuggestions: j.createdSuggestions ?? 0,
        cleanCards: j.cleanCards ?? 0,
        errorCount: Array.isArray(j.errors) ? j.errors.length : 0,
      });
      onResult(
        t('aiReviewBatchDone', {
          analyzed: j.analyzed ?? ids.length,
          created: j.createdSuggestions ?? 0,
          errors: Array.isArray(j.errors) ? j.errors.length : 0,
        }),
        'ok'
      );
    } catch {
      onResult(t('aiReviewError'), 'err');
    } finally {
      setRunLoading(false);
    }
  }, [
    batchFilter,
    complexityMaxStr,
    complexityMinStr,
    draftScope,
    estimated?.ids,
    excludeLocked,
    mode,
    onResult,
    scopePayload,
    t,
  ]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-violet-500/45 bg-violet-500/10 px-3 py-2.5 text-sm font-medium text-violet-100 transition-colors hover:bg-violet-500/20"
      >
        {t('aiReviewBatchButton')}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal
          aria-labelledby="ai-review-batch-title"
          onClick={closeModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-page p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id="ai-review-batch-title"
                className="min-w-0 flex-1 text-lg font-semibold text-foreground"
              >
                {t('aiReviewBatchTitle')}
              </h2>
              <AiToolsModalCloseButton
                onClose={closeModal}
                label={t('aiToolsModalCloseAria')}
              />
            </div>
            <AiToolsModalShell
              form={
                <>
                  <label className="block text-sm text-muted-foreground">
                    {t('aiReviewBatchMode')}
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as ReviewMode)}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                    >
                      <option value="full">{t('aiReviewModeFull')}</option>
                      <option value="classify">{t('aiReviewModeClassify')}</option>
                      <option value="links">{t('aiReviewModeLinks')}</option>
                    </select>
                  </label>
                  <label className="block text-sm text-muted-foreground">
                    {t('aiReviewBatchFilter')}
                    <select
                      value={batchFilter}
                      onChange={(e) =>
                        setBatchFilter(e.target.value as BatchFilter)
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                    >
                      <option value="no_dimension">
                        {t('aiReviewFilterNoDimension')}
                      </option>
                      <option value="no_material_level">
                        {t('aiReviewFilterNoMaterialLevel')}
                      </option>
                      <option value="zero_links">
                        {t('aiReviewFilterZeroLinks')}
                      </option>
                      <option value="all">{t('aiReviewFilterAll')}</option>
                    </select>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {t('aiReviewBatchScopeHint')}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-muted-foreground">
                  {t('aiReviewFilterCategory')}
                  <select
                    value={filterCategory}
                    onChange={(e) =>
                      setFilterCategory(e.target.value as 'all' | NodeCategory)
                    }
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  >
                    <option value="all">{t('allCategories')}</option>
                    {NODE_CATEGORY_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {tCat(c)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm text-muted-foreground">
                  {t('aiReviewFilterEra')}
                  <select
                    value={filterEra}
                    onChange={(e) =>
                      setFilterEra(e.target.value as 'all' | Era)
                    }
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
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
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-muted-foreground">
                  {t('aiReviewFilterYearMin')}
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('aiReviewFilterYearPlaceholder')}
                    value={filterYearMin}
                    onChange={(e) => setFilterYearMin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="block text-sm text-muted-foreground">
                  {t('aiReviewFilterYearMax')}
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('aiReviewFilterYearPlaceholder')}
                    value={filterYearMax}
                    onChange={(e) => setFilterYearMax(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
              </div>
              <label className="block text-sm text-muted-foreground">
                {t('aiToolsReviewIdList')}
                <textarea
                  value={inventionIdsText}
                  onChange={(e) => setInventionIdsText(e.target.value)}
                  placeholder={t('aiToolsReviewIdListPlaceholder')}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={excludeLocked}
                  onChange={(e) => setExcludeLocked(e.target.checked)}
                />
                {t('aiToolsReviewExcludeLocked')}
              </label>
              <label className="block text-sm text-muted-foreground">
                {t('aiToolsReviewDraftScope')}
                <select
                  value={draftScope}
                  onChange={(e) =>
                    setDraftScope(e.target.value as typeof draftScope)
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                >
                  <option value="all">{t('aiToolsEnrichDraftAll')}</option>
                  <option value="drafts_only">{t('aiToolsEnrichDraftsOnly')}</option>
                  <option value="published_only">
                    {t('aiToolsEnrichPublishedOnly')}
                  </option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm text-muted-foreground">
                  {t('aiToolsReviewComplexityMin')}
                  <input
                    type="number"
                    min={0}
                    value={complexityMinStr}
                    onChange={(e) => setComplexityMinStr(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
                <label className="block text-sm text-muted-foreground">
                  {t('aiToolsReviewComplexityMax')}
                  <input
                    type="number"
                    min={0}
                    value={complexityMaxStr}
                    onChange={(e) => setComplexityMaxStr(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                  />
                </label>
              </div>
                  <button
                    type="button"
                    disabled={dryRunLoading}
                    onClick={() => void runDryRun()}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
                  >
                    {dryRunLoading ? '…' : t('aiReviewBatchEstimate')}
                  </button>
                  {estimated ? (
                    <p className="text-sm text-muted-foreground">
                      {t('aiReviewBatchEstimateResult', {
                        count: estimated.count,
                        eur: estimated.eur.toFixed(3),
                      })}
                    </p>
                  ) : null}
                  {runLoading ? (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-violet-500 transition-[width] duration-300"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                  ) : null}
                  {summary ? (
                    <div className="rounded-lg border border-border/60 bg-surface/50 p-3 text-sm text-foreground">
                      <p>
                        {t('aiReviewBatchSummaryAnalyzed', {
                          n: summary.analyzed,
                        })}
                      </p>
                      <p>
                        {t('aiReviewBatchSummaryCreated', {
                          n: summary.createdSuggestions,
                        })}
                      </p>
                      <p>
                        {t('aiReviewBatchSummaryClean', {
                          n: summary.cleanCards,
                        })}
                      </p>
                      <p>
                        {t('aiReviewBatchSummaryErrors', {
                          n: summary.errorCount,
                        })}
                      </p>
                    </div>
                  ) : null}
                </>
              }
              panel={
                <AiToolsPanelSections
                  aboutTitle={t('aiToolsPanelAboutTitle')}
                  aboutBody={t('aiToolsPanelReviewIntro')}
                  summaryTitle={t('aiToolsPanelSummaryTitle')}
                  summaryBody={reviewSummary}
                />
              }
              footer={
                <>
                  <button
                    type="button"
                    disabled={runLoading || !estimated?.ids.length}
                    onClick={() => void runAnalysis()}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {t('aiReviewBatchRun')}
                  </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted/20"
                >
                  {t('aiReviewBatchClose')}
                </button>
                </>
              }
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

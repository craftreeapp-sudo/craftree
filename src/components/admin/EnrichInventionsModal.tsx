'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { NODE_CATEGORY_ORDER, ERA_ORDER } from '@/lib/node-labels';
import { eraLabelFromMessages } from '@/lib/era-display';
import type { Era, NodeCategory } from '@/lib/types';
import { AIProgressBar } from '@/components/admin/AIProgressBar';
import {
  AiToolsModalCloseButton,
  AiToolsModalShell,
  AiToolsPanelSections,
} from '@/components/admin/AiToolsModalShell';

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

export function EnrichInventionsModal({
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
  const [noDescription, setNoDescription] = useState(true);
  const [noYear, setNoYear] = useState(false);
  const [noWikipedia, setNoWikipedia] = useState(false);
  const [noDimension, setNoDimension] = useState(false);
  const [limit, setLimit] = useState(20);
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
  const [countPreview, setCountPreview] = useState<number | null>(null);
  const [costPerCardEur, setCostPerCardEur] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastDryCostEur, setLastDryCostEur] = useState<number | null>(null);
  const [lastDryN, setLastDryN] = useState<number | null>(null);

  const scopeQuery = useMemo(() => {
    const sp = new URLSearchParams();
    if (noDescription) sp.set('noDescription', '1');
    if (noYear) sp.set('noYear', '1');
    if (noWikipedia) sp.set('noWikipedia', '1');
    if (noDimension) sp.set('noDimension', '1');
    if (filterCategory !== 'all') sp.set('filterCategory', filterCategory);
    if (filterEra !== 'all') sp.set('filterEra', filterEra);
    const yMin = parseYearInput(filterYearMin);
    const yMax = parseYearInput(filterYearMax);
    if (yMin != null) sp.set('filterYearMin', String(yMin));
    if (yMax != null) sp.set('filterYearMax', String(yMax));
    sp.set('excludeLocked', excludeLocked ? '1' : '0');
    if (draftScope !== 'all') sp.set('draftScope', draftScope);
    const cmin = parseComplexity(complexityMinStr);
    const cmax = parseComplexity(complexityMaxStr);
    if (cmin != null) sp.set('complexityMin', String(cmin));
    if (cmax != null) sp.set('complexityMax', String(cmax));
    return sp;
  }, [
    noDescription,
    noYear,
    noWikipedia,
    noDimension,
    filterCategory,
    filterEra,
    filterYearMin,
    filterYearMax,
    excludeLocked,
    draftScope,
    complexityMinStr,
    complexityMaxStr,
  ]);

  const postBody = useCallback(
    (dryRun: boolean) => ({
      limit,
      dryRun,
      noDescription,
      noYear,
      noWikipedia,
      noDimension,
      filterCategory: filterCategory === 'all' ? undefined : filterCategory,
      filterEra: filterEra === 'all' ? undefined : filterEra,
      filterYearMin: parseYearInput(filterYearMin),
      filterYearMax: parseYearInput(filterYearMax),
      excludeLocked,
      draftScope: draftScope === 'all' ? undefined : draftScope,
      complexityMin: parseComplexity(complexityMinStr),
      complexityMax: parseComplexity(complexityMaxStr),
    }),
    [
      limit,
      noDescription,
      noYear,
      noWikipedia,
      noDimension,
      filterCategory,
      filterEra,
      filterYearMin,
      filterYearMax,
      excludeLocked,
      draftScope,
      complexityMinStr,
      complexityMaxStr,
    ]
  );

  const refreshCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const res = await fetch(
        `/api/ai-tools/enrich-inventions?${scopeQuery}`,
        { credentials: 'same-origin' }
      );
      const j = (await res.json().catch(() => ({}))) as {
        count?: number;
        costPerCardEur?: number;
        error?: string;
      };
      if (!res.ok) {
        onToast(String(j.error ?? 'Error'), 'err');
        return;
      }
      setCountPreview(j.count ?? 0);
      setCostPerCardEur(
        typeof j.costPerCardEur === 'number' ? j.costPerCardEur : null
      );
    } catch {
      onToast(t('aiToolsEnrichError'), 'err');
    } finally {
      setLoadingCount(false);
    }
  }, [onToast, scopeQuery, t]);

  const enrichPanelSummary = useMemo(() => {
    const yMin = parseYearInput(filterYearMin);
    const yMax = parseYearInput(filterYearMax);
    const cmin = parseComplexity(complexityMinStr);
    const cmax = parseComplexity(complexityMaxStr);
    const missing: string[] = [];
    if (noDescription) missing.push(t('aiToolsFilterNoDescription'));
    if (noYear) missing.push(t('aiToolsFilterNoYear'));
    if (noWikipedia) missing.push(t('aiToolsFilterNoWiki'));
    if (noDimension) missing.push(t('aiToolsFilterNoDimension'));
    const items: { key: string; text: string }[] = [
      {
        key: 'miss',
        text: t('aiToolsPanelEnrichBulletMissing', {
          list: missing.length ? missing.join(' · ') : '—',
        }),
      },
      {
        key: 'limit',
        text: t('aiToolsPanelEnrichBulletLimit', { n: limit }),
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
    if (countPreview !== null) {
      items.push({
        key: 'pool',
        text: t('aiToolsPanelEnrichBulletPool', { n: countPreview }),
      });
    }
    if (lastDryCostEur != null && lastDryN != null) {
      items.push({
        key: 'dry',
        text: t('aiToolsPanelEnrichBulletDry', {
          n: lastDryN,
          eur: lastDryCostEur.toFixed(4),
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
    countPreview,
    draftScope,
    excludeLocked,
    filterCategory,
    filterEra,
    filterYearMax,
    filterYearMin,
    lastDryCostEur,
    lastDryN,
    limit,
    locale,
    noDescription,
    noDimension,
    noWikipedia,
    noYear,
    t,
    tCat,
  ]);

  if (!open) return null;

  const indicativeMaxEur =
    countPreview != null && costPerCardEur != null
      ? Math.min(limit, countPreview) * costPerCardEur
      : null;

  const run = async (dryRun: boolean) => {
    setRunning(true);
    if (dryRun) {
      setLastDryCostEur(null);
      setLastDryN(null);
    }
    try {
      const res = await fetch('/api/ai-tools/enrich-inventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(postBody(dryRun)),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        suggestionsCreated?: number;
        targetIds?: string[];
        estimatedCostEur?: number;
      };
      if (!res.ok) {
        onToast(String(j.error ?? t('aiToolsEnrichError')), 'err');
        return;
      }
      if (dryRun) {
        const n = j.targetIds?.length ?? 0;
        const eur = j.estimatedCostEur ?? 0;
        setLastDryCostEur(eur);
        setLastDryN(n);
        onToast(
          `${t('aiToolsEnrichDryDone', { n })} · ~${eur.toFixed(4)} €`,
          'ok'
        );
      } else {
        onToast(
          t('aiToolsEnrichDone', { n: j.suggestionsCreated ?? 0 }),
          'ok'
        );
        onClose();
      }
    } catch {
      onToast(t('aiToolsEnrichError'), 'err');
    } finally {
      setRunning(false);
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
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-page p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 text-lg font-semibold">
            {t('aiToolsEnrichTitle')}
          </h2>
          <AiToolsModalCloseButton
            onClose={onClose}
            label={t('aiToolsModalCloseAria')}
          />
        </div>
        <AiToolsModalShell
          form={
            <div className="space-y-2 text-sm">
              <p className="text-sm text-muted-foreground">{t('aiToolsEnrichHint')}</p>
              <p className="text-xs text-muted-foreground">
                {t('aiToolsEnrichPriorityHint')}
              </p>
              <p className="pt-2 text-xs font-medium text-foreground">
                {t('aiToolsEnrichScopeTitle')}
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
            {t('aiToolsEnrichDraftScope')}
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
            {t('aiToolsEnrichExcludeLocked')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-muted-foreground">
              {t('aiToolsEnrichComplexityMin')}
              <input
                type="number"
                min={0}
                value={complexityMinStr}
                onChange={(e) => setComplexityMinStr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              />
            </label>
            <label className="block text-muted-foreground">
              {t('aiToolsEnrichComplexityMax')}
              <input
                type="number"
                min={0}
                value={complexityMaxStr}
                onChange={(e) => setComplexityMaxStr(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              />
            </label>
          </div>
          <p className="border-t border-border pt-3 text-xs font-medium text-foreground">
            {t('aiToolsEnrichMissingCriteria')}
          </p>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={noDescription}
              onChange={(e) => setNoDescription(e.target.checked)}
            />
            {t('aiToolsFilterNoDescription')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={noYear}
              onChange={(e) => setNoYear(e.target.checked)}
            />
            {t('aiToolsFilterNoYear')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={noWikipedia}
              onChange={(e) => setNoWikipedia(e.target.checked)}
            />
            {t('aiToolsFilterNoWiki')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={noDimension}
              onChange={(e) => setNoDimension(e.target.checked)}
            />
            {t('aiToolsFilterNoDimension')}
          </label>
          <label className="mt-2 block text-muted-foreground">
            {t('aiToolsEnrichLimit')}
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
            />
          </label>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              disabled={loadingCount}
              onClick={() => void refreshCount()}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              {loadingCount ? '…' : t('aiToolsEnrichCount')}
            </button>
            {countPreview !== null ? (
              <span className="self-center text-sm text-muted-foreground">
                {t('aiToolsEnrichCountResult', { n: countPreview })}
              </span>
            ) : null}
          </div>
          {indicativeMaxEur != null ? (
            <p className="text-xs text-muted-foreground">
              {t('aiToolsCostEstimate', {
                eur: indicativeMaxEur.toFixed(4),
              })}
            </p>
          ) : null}
          {lastDryCostEur != null && lastDryN != null ? (
            <p className="text-sm text-muted-foreground">
              {t('aiToolsCostEstimate', {
                eur: lastDryCostEur.toFixed(4),
              })}{' '}
              · {lastDryN} carte(s) après tri
            </p>
          ) : null}
          {running ? <AIProgressBar indeterminate /> : null}
            </div>
          }
          panel={
            <AiToolsPanelSections
              aboutTitle={t('aiToolsPanelAboutTitle')}
              aboutBody={t('aiToolsPanelEnrichIntro')}
              summaryTitle={t('aiToolsPanelSummaryTitle')}
              summaryBody={enrichPanelSummary}
            />
          }
          footer={
            <>
              <button
                type="button"
                disabled={running}
                onClick={() => void run(true)}
                className="rounded-lg border border-border px-4 py-2 text-sm"
              >
                {running ? '…' : t('aiToolsEnrichDryRun')}
              </button>
              <button
                type="button"
                disabled={running}
                onClick={() => void run(false)}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {t('aiToolsEnrichRun')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground"
              >
                {t('aiReviewBatchClose')}
              </button>
            </>
          }
        />
      </div>
    </div>
  );
}

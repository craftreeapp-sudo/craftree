'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { NODE_CATEGORY_ORDER, ERA_ORDER } from '@/lib/node-labels';
import { eraLabelFromMessages } from '@/lib/era-display';
import type { Era, NodeCategory } from '@/lib/types';
import {
  AiToolsModalCloseButton,
  AiToolsModalShell,
  AiToolsPanelSections,
} from '@/components/admin/AiToolsModalShell';
import {
  parseInventionIdOrNameList,
  replaceInventionTokenInRaw,
} from '@/lib/ai-tools/parse-invention-list-for-review';
import { treeInventionPath } from '@/lib/tree-routes';

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

/** Limite lot IA : entier > 0, sinon pas de plafond. */
function parseMaxCardsInput(raw: string): number | undefined {
  const s = raw.trim();
  if (s === '') return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(100_000, Math.floor(n));
}

function countPastedEntries(raw: string): number {
  return parseInventionIdOrNameList(raw).length;
}

function buildExplicitTokenOverrides(
  raw: string,
  choices: Record<string, string>
): { token: string; inventionId: string }[] {
  const keep = new Set(parseInventionIdOrNameList(raw));
  return Object.entries(choices)
    .filter(([token, id]) => Boolean(id) && keep.has(token))
    .map(([token, inventionId]) => ({ token, inventionId }));
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
  const [maxCardsStr, setMaxCardsStr] = useState('');
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
  const [resolveHints, setResolveHints] = useState<{
    unresolved: string[];
    ambiguous: { token: string; candidates: { id: string; name: string }[] }[];
  } | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);
  /** Jeton ambigu → id de fiche choisi (envoyé en explicitTokenOverrides). */
  const [ambiguousTokenChoices, setAmbiguousTokenChoices] = useState<
    Record<string, string>
  >({});
  const [renameByToken, setRenameByToken] = useState<Record<string, string>>(
    {}
  );

  const explicitListActive = Boolean(inventionIdsText.trim());

  useEffect(() => {
    setResolveHints(null);
    const keep = new Set(parseInventionIdOrNameList(inventionIdsText));
    setAmbiguousTokenChoices((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (keep.has(k)) next[k] = v;
      }
      return next;
    });
  }, [inventionIdsText]);

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
    const idN = countPastedEntries(inventionIdsText);
    const items: { key: string; text: string }[] = [
      { key: 'mode', text: t('aiToolsPanelBulletMode', { mode: modeLabel }) },
    ];
    if (explicitListActive) {
      if (idN > 0) {
        items.push({
          key: 'explicit',
          text: t('aiToolsPanelBulletExplicitListDetail', { count: idN }),
        });
      } else {
        items.push({
          key: 'explicitEmpty',
          text: t('aiToolsPanelBulletExplicitListEmpty'),
        });
      }
      if (resolveHints?.unresolved.length) {
        items.push({
          key: 'unres',
          text: t('aiToolsPanelBulletUnresolved', {
            count: resolveHints.unresolved.length,
          }),
        });
      }
      const ambRemaining =
        resolveHints?.ambiguous.filter((a) => !ambiguousTokenChoices[a.token])
          .length ?? 0;
      if (ambRemaining > 0) {
        items.push({
          key: 'amb',
          text: t('aiToolsPanelBulletAmbiguous', {
            count: ambRemaining,
          }),
        });
      }
    } else {
      items.push({
        key: 'filter',
        text: t('aiToolsPanelBulletFilter', { filter: filterLabel }),
      });
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
    if (!explicitListActive) {
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
    }
    const maxN = parseMaxCardsInput(maxCardsStr);
    if (maxN != null) {
      items.push({
        key: 'maxc',
        text: explicitListActive
          ? t('aiToolsPanelBulletMaxCardsExplicitList', { n: maxN })
          : t('aiToolsPanelBulletMaxCards', { n: maxN }),
      });
    }
    if (explicitListActive && idN > 0) {
      items.push({
        key: 'noestBypass',
        text: t('aiToolsPanelBulletNoEstimateBypass'),
      });
    } else if (estimated) {
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
    explicitListActive,
    filterCategory,
    filterEra,
    filterYearMax,
    filterYearMin,
    inventionIdsText,
    locale,
    maxCardsStr,
    mode,
    resolveHints,
    ambiguousTokenChoices,
    t,
    tCat,
  ]);

  const runDryRun = useCallback(
    async (opts?: {
      inventionIdsText?: string;
      tokenChoices?: Record<string, string>;
    }) => {
    const rawText = opts?.inventionIdsText ?? inventionIdsText;
    const choices = opts?.tokenChoices ?? ambiguousTokenChoices;
    const explicitTokenOverrides = buildExplicitTokenOverrides(
      rawText,
      choices
    );
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
          inventionIdsText: rawText.trim() || undefined,
          ...(explicitTokenOverrides.length > 0
            ? { explicitTokenOverrides }
            : {}),
          excludeLocked,
          draftScope: draftScope === 'all' ? undefined : draftScope,
          complexityMin: rawText.trim()
            ? undefined
            : parseComplexity(complexityMinStr),
          complexityMax: rawText.trim()
            ? undefined
            : parseComplexity(complexityMaxStr),
          maxCards: parseMaxCardsInput(maxCardsStr),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        resolvedCount?: number;
        estimatedCostEur?: number;
        inventionIds?: string[];
        unresolvedTokens?: string[];
        ambiguousMatches?: {
          token: string;
          candidates: { id: string; name: string }[];
        }[];
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
      if (rawText.trim()) {
        setResolveHints({
          unresolved: j.unresolvedTokens ?? [],
          ambiguous: j.ambiguousMatches ?? [],
        });
      } else {
        setResolveHints(null);
      }
    } catch {
      onResult(t('aiReviewError'), 'err');
    } finally {
      setDryRunLoading(false);
    }
    },
    [
      ambiguousTokenChoices,
      batchFilter,
      complexityMaxStr,
      complexityMinStr,
      draftScope,
      excludeLocked,
      inventionIdsText,
      mode,
      onResult,
      maxCardsStr,
      scopePayload,
      t,
    ]
  );

  const closeModal = useCallback(() => {
    setOpen(false);
    setEstimated(null);
    setSummary(null);
    setResolveHints(null);
    setAmbiguousTokenChoices({});
    setRenameByToken({});
  }, []);

  const seedDraftNames = useMemo(() => {
    if (!resolveHints) return [];
    const fromAmb = resolveHints.ambiguous
      .filter((a) => !ambiguousTokenChoices[a.token])
      .map((a) => a.token);
    return [...new Set([...resolveHints.unresolved, ...fromAmb])];
  }, [resolveHints, ambiguousTokenChoices]);

  const runSeedMissingDrafts = useCallback(async () => {
    const names = seedDraftNames;
    if (names.length === 0) return;
    setSeedBusy(true);
    try {
      const res = await fetch('/api/ai-tools/seed-named-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ names }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: { id: string; name: string }[];
        errors?: string[];
      };
      if (!res.ok) {
        onResult(String(j.error ?? t('aiReviewError')), 'err');
        return;
      }
      const n = j.created?.length ?? 0;
      onResult(
        t('aiReviewBatchSeedMissingToast', { n }),
        n > 0 ? 'ok' : 'err'
      );
      if (n > 0) {
        await runDryRun();
      }
    } catch {
      onResult(t('aiReviewError'), 'err');
    } finally {
      setSeedBusy(false);
    }
  }, [onResult, runDryRun, seedDraftNames, t]);

  const runAnalysis = useCallback(async () => {
    const text = inventionIdsText.trim();
    const fromList = text ? parseInventionIdOrNameList(text) : [];
    const ids = estimated?.ids;
    if (!text && !ids?.length) {
      onResult(t('aiReviewBatchNoIdsEstimate'), 'err');
      return;
    }
    if (text && fromList.length === 0) {
      onResult(t('aiReviewBatchNoIdsExplicitEmpty'), 'err');
      return;
    }
    const confirmCount =
      text && estimated != null
        ? estimated.count
        : text
          ? fromList.length
          : (ids?.length ?? 0);
    if (
      typeof window !== 'undefined' &&
      !window.confirm(t('aiReviewBatchConfirm', { count: confirmCount }))
    ) {
      return;
    }
    setRunLoading(true);
    setProgress(0);
    setSummary(null);
    const explicitTokenOverrides = buildExplicitTokenOverrides(
      inventionIdsText,
      ambiguousTokenChoices
    );
    try {
      const res = await fetch('/api/ai-tools/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          ...(text
            ? {
                inventionIdsText: text,
                ...(explicitTokenOverrides.length > 0
                  ? { explicitTokenOverrides }
                  : {}),
              }
            : { inventionIds: ids ?? [] }),
          mode,
          batchFilter,
          ...scopePayload,
          excludeLocked,
          draftScope: draftScope === 'all' ? undefined : draftScope,
          complexityMin: explicitListActive
            ? undefined
            : parseComplexity(complexityMinStr),
          complexityMax: explicitListActive
            ? undefined
            : parseComplexity(complexityMaxStr),
          maxCards: parseMaxCardsInput(maxCardsStr),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        analyzed?: number;
        createdSuggestions?: number;
        cleanCards?: number;
        errors?: unknown[];
        unresolvedTokens?: string[];
        ambiguousMatches?: {
          token: string;
          candidates: { id: string; name: string }[];
        }[];
      };
      setProgress(1);
      if (!res.ok) {
        onResult(String(j.error ?? t('aiReviewError')), 'err');
        return;
      }
      if (text && Array.isArray(j.unresolvedTokens)) {
        setResolveHints({
          unresolved: j.unresolvedTokens,
          ambiguous: j.ambiguousMatches ?? [],
        });
      }
      const analyzedN = j.analyzed ?? confirmCount;
      setSummary({
        analyzed: analyzedN,
        createdSuggestions: j.createdSuggestions ?? 0,
        cleanCards: j.cleanCards ?? 0,
        errorCount: Array.isArray(j.errors) ? j.errors.length : 0,
      });
      onResult(
        t('aiReviewBatchDone', {
          analyzed: analyzedN,
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
    ambiguousTokenChoices,
    batchFilter,
    complexityMaxStr,
    complexityMinStr,
    draftScope,
    estimated,
    excludeLocked,
    explicitListActive,
    inventionIdsText,
    maxCardsStr,
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
                    {t('aiReviewBatchIdOrNameList')}
                    <textarea
                      value={inventionIdsText}
                      onChange={(e) => setInventionIdsText(e.target.value)}
                      placeholder={t('aiReviewBatchIdOrNameListPlaceholder')}
                      rows={4}
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
                    />
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t('aiReviewBatchIdOrNameListHint')}
                    </span>
                  </label>
                  {explicitListActive ? (
                    <p className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
                      {t('aiReviewBatchExplicitCallout')}
                    </p>
                  ) : null}
                  <label
                    className={`block text-sm text-muted-foreground ${explicitListActive ? 'opacity-50' : ''}`}
                  >
                    {t('aiReviewBatchFilter')}
                    <select
                      value={batchFilter}
                      disabled={explicitListActive}
                      onChange={(e) =>
                        setBatchFilter(e.target.value as BatchFilter)
                      }
                      className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
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
                  {!explicitListActive ? (
                    <p className="text-xs text-muted-foreground">
                      {t('aiReviewBatchScopeHint')}
                    </p>
                  ) : null}
                  <div
                    className={`grid gap-3 sm:grid-cols-2 ${explicitListActive ? 'opacity-50' : ''}`}
                  >
                <label className="block text-sm text-muted-foreground">
                  {t('aiReviewFilterCategory')}
                  <select
                    value={filterCategory}
                    disabled={explicitListActive}
                    onChange={(e) =>
                      setFilterCategory(e.target.value as 'all' | NodeCategory)
                    }
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
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
                    disabled={explicitListActive}
                    onChange={(e) =>
                      setFilterEra(e.target.value as 'all' | Era)
                    }
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
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
              <div
                className={`grid gap-3 sm:grid-cols-2 ${explicitListActive ? 'opacity-50' : ''}`}
              >
                <label className="block text-sm text-muted-foreground">
                  {t('aiReviewFilterYearMin')}
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('aiReviewFilterYearPlaceholder')}
                    value={filterYearMin}
                    disabled={explicitListActive}
                    onChange={(e) => setFilterYearMin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
                  />
                </label>
                <label className="block text-sm text-muted-foreground">
                  {t('aiReviewFilterYearMax')}
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('aiReviewFilterYearPlaceholder')}
                    value={filterYearMax}
                    disabled={explicitListActive}
                    onChange={(e) => setFilterYearMax(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
                  />
                </label>
              </div>
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
              <div
                className={`grid gap-3 sm:grid-cols-2 ${explicitListActive ? 'opacity-50' : ''}`}
              >
                <label className="block text-sm text-muted-foreground">
                  {t('aiToolsReviewComplexityMin')}
                  <input
                    type="number"
                    min={0}
                    value={complexityMinStr}
                    disabled={explicitListActive}
                    title={
                      explicitListActive
                        ? t('aiReviewBatchComplexityDisabledHint')
                        : undefined
                    }
                    onChange={(e) => setComplexityMinStr(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
                  />
                </label>
                <label className="block text-sm text-muted-foreground">
                  {t('aiToolsReviewComplexityMax')}
                  <input
                    type="number"
                    min={0}
                    value={complexityMaxStr}
                    disabled={explicitListActive}
                    title={
                      explicitListActive
                        ? t('aiReviewBatchComplexityDisabledHint')
                        : undefined
                    }
                    onChange={(e) => setComplexityMaxStr(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed"
                  />
                </label>
              </div>
              <label className="block text-sm text-muted-foreground">
                {t('aiReviewBatchMaxCards')}
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  placeholder={t('aiReviewBatchMaxCardsPlaceholder')}
                  value={maxCardsStr}
                  onChange={(e) => setMaxCardsStr(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  {t(
                    explicitListActive
                      ? 'aiReviewBatchMaxCardsHintExplicit'
                      : 'aiReviewBatchMaxCardsHint'
                  )}
                </span>
              </label>
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
                <>
                  <AiToolsPanelSections
                    aboutTitle={t('aiToolsPanelAboutTitle')}
                    aboutBody={t('aiToolsPanelReviewIntro')}
                    summaryTitle={t('aiToolsPanelSummaryTitle')}
                    summaryBody={reviewSummary}
                  />
                  {explicitListActive &&
                  resolveHints &&
                  (resolveHints.unresolved.length > 0 ||
                    resolveHints.ambiguous.length > 0) ? (
                    <section className="mt-4 rounded-lg border border-amber-500/45 bg-amber-950/30 p-3">
                      <h3 className="text-sm font-semibold text-amber-100/95">
                        {resolveHints.unresolved.length === 0 &&
                        resolveHints.ambiguous.length > 0
                          ? t('aiReviewBatchMissingTitleAmbiguous')
                          : t('aiReviewBatchMissingTitle')}
                      </h3>
                      {resolveHints.unresolved.length > 0 ? (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {t('aiReviewBatchUnresolvedIntro')}
                          </p>
                          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-foreground">
                            {resolveHints.unresolved.map((name) => (
                              <li key={name}>{name}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {resolveHints.ambiguous.length > 0 ? (
                        <div
                          className={
                            resolveHints.unresolved.length > 0 ? 'mt-4' : 'mt-2'
                          }
                        >
                          <p className="text-xs font-medium text-muted-foreground">
                            {t('aiReviewBatchAmbiguousIntro')}
                          </p>
                          <ul className="mt-1.5 space-y-3 text-xs text-foreground">
                            {resolveHints.ambiguous.map((a) => (
                              <li
                                key={a.token}
                                className="rounded-lg border border-amber-500/25 bg-black/20 p-2.5"
                              >
                                <div className="font-medium text-amber-200/90">
                                  « {a.token} »
                                </div>
                                <ul className="mt-2 space-y-2">
                                  {a.candidates.map((c) => {
                                    const selected =
                                      ambiguousTokenChoices[a.token] === c.id;
                                    return (
                                      <li
                                        key={c.id}
                                        className="flex flex-wrap items-center gap-2"
                                      >
                                        <button
                                          type="button"
                                          disabled={dryRunLoading}
                                          onClick={() => {
                                            const next = {
                                              ...ambiguousTokenChoices,
                                              [a.token]: c.id,
                                            };
                                            setAmbiguousTokenChoices(next);
                                            void runDryRun({
                                              tokenChoices: next,
                                            });
                                          }}
                                          className={`rounded-md border px-2 py-1 text-left transition-colors ${
                                            selected
                                              ? 'border-violet-400 bg-violet-600/35 text-violet-50'
                                              : 'border-border bg-surface/80 text-foreground hover:bg-muted/30'
                                          } disabled:opacity-50`}
                                        >
                                          {t('aiReviewBatchAmbiguousUseCard')}:{' '}
                                          {c.name}{' '}
                                          <span className="text-muted-foreground">
                                            ({c.id})
                                          </span>
                                        </button>
                                        <a
                                          href={treeInventionPath(c.id)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="shrink-0 text-[11px] font-medium text-violet-300 underline underline-offset-2 hover:text-violet-200"
                                        >
                                          {t('aiReviewBatchAmbiguousOpenTree')}
                                        </a>
                                      </li>
                                    );
                                  })}
                                </ul>
                                {ambiguousTokenChoices[a.token] ? (
                                  <button
                                    type="button"
                                    disabled={dryRunLoading}
                                    onClick={() => {
                                      const next = {
                                        ...ambiguousTokenChoices,
                                      };
                                      delete next[a.token];
                                      setAmbiguousTokenChoices(next);
                                      void runDryRun({ tokenChoices: next });
                                    }}
                                    className="mt-2 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                  >
                                    {t('aiReviewBatchAmbiguousClearChoice')}
                                  </button>
                                ) : null}
                                <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center">
                                  <input
                                    type="text"
                                    value={renameByToken[a.token] ?? ''}
                                    onChange={(e) =>
                                      setRenameByToken((prev) => ({
                                        ...prev,
                                        [a.token]: e.target.value,
                                      }))
                                    }
                                    placeholder={t(
                                      'aiReviewBatchAmbiguousRenamePlaceholder'
                                    )}
                                    className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground"
                                  />
                                  <button
                                    type="button"
                                    disabled={
                                      dryRunLoading ||
                                      !(renameByToken[a.token] ?? '').trim()
                                    }
                                    onClick={() => {
                                      const newName = (
                                        renameByToken[a.token] ?? ''
                                      ).trim();
                                      if (!newName) return;
                                      const newText = replaceInventionTokenInRaw(
                                        inventionIdsText,
                                        a.token,
                                        newName
                                      );
                                      const nextChoices = {
                                        ...ambiguousTokenChoices,
                                      };
                                      delete nextChoices[a.token];
                                      setInventionIdsText(newText);
                                      setAmbiguousTokenChoices(nextChoices);
                                      setRenameByToken((prev) => {
                                        const n = { ...prev };
                                        delete n[a.token];
                                        return n;
                                      });
                                      void runDryRun({
                                        inventionIdsText: newText,
                                        tokenChoices: nextChoices,
                                      });
                                    }}
                                    className="shrink-0 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
                                  >
                                    {t('aiReviewBatchAmbiguousApplyRename')}
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {seedDraftNames.length > 0 ? (
                        <div className="mt-4 border-t border-amber-500/25 pt-3">
                          {resolveHints.unresolved.length === 0 &&
                          resolveHints.ambiguous.length > 0 ? (
                            <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                              {t('aiReviewBatchSeedMissingHintAmbiguous')}
                            </p>
                          ) : null}
                          <button
                            type="button"
                            disabled={seedBusy || dryRunLoading}
                            onClick={() => void runSeedMissingDrafts()}
                            className="w-full rounded-lg border border-violet-500/50 bg-violet-600/30 px-3 py-2.5 text-xs font-semibold text-violet-50 transition-colors hover:bg-violet-600/45 disabled:opacity-50"
                          >
                            {seedBusy
                              ? t('aiReviewBatchSeedMissingBusy')
                              : t('aiReviewBatchSeedMissingButton')}
                          </button>
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </>
              }
              footer={
                <>
                  <button
                    type="button"
                    disabled={
                      runLoading ||
                      (explicitListActive
                        ? countPastedEntries(inventionIdsText) === 0
                        : !estimated?.ids.length)
                    }
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

'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { NODE_CATEGORY_ORDER, ERA_ORDER } from '@/lib/node-labels';
import { eraLabelFromMessages } from '@/lib/era-display';
import type { NodeCategory } from '@/lib/types';
import type { Era } from '@/lib/types';
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

export function AddInventionsModal({
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
  const [category, setCategory] = useState<NodeCategory>(NODE_CATEGORY_ORDER[0]!);
  const [era, setEra] = useState<Era | 'all'>('all');
  const [count, setCount] = useState(5);
  const [dimension, setDimension] = useState<'matter' | 'process' | 'tool' | 'all'>(
    'all'
  );
  const [cascade, setCascade] = useState(true);
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [excludeLocked, setExcludeLocked] = useState(true);
  const [excludeDraftNodes, setExcludeDraftNodes] = useState(false);
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<{
    eur: number;
    count: number;
  } | null>(null);

  const payload = () => ({
    category,
    era,
    count,
    dimension,
    cascade,
    yearMin: parseYearInput(yearMin),
    yearMax: parseYearInput(yearMax),
    excludeLocked,
    excludeDraftNodes,
  });

  const addPanelSummary = useMemo(() => {
    const yMin = parseYearInput(yearMin);
    const yMax = parseYearInput(yearMax);
    const dimLabel =
      dimension === 'all'
        ? t('allDimensions')
        : dimension === 'matter'
          ? t('dimensionMatter')
          : dimension === 'process'
            ? t('dimensionProcess')
            : t('dimensionTool');
    const items: { key: string; text: string }[] = [
      {
        key: 'cat',
        text: t('aiToolsPanelBulletCategory', { name: tCat(category) }),
      },
      {
        key: 'era',
        text: t('aiToolsPanelBulletEra', {
          name:
            era === 'all'
              ? t('allEras')
              : eraLabelFromMessages(locale, era),
        }),
      },
    ];
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
      key: 'n',
      text: t('aiToolsPanelAddBulletCount', { n: count }),
    });
    items.push({
      key: 'dim',
      text: t('aiToolsPanelAddBulletDim', { name: dimLabel }),
    });
    items.push({
      key: 'cascade',
      text: cascade ? t('aiToolsPanelAddCascadeOn') : t('aiToolsPanelAddCascadeOff'),
    });
    items.push({
      key: 'lock',
      text: excludeLocked
        ? t('aiToolsPanelAddBulletLinkLocked')
        : t('aiToolsPanelAddBulletLinkLockedOff'),
    });
    items.push({
      key: 'draft',
      text: excludeDraftNodes
        ? t('aiToolsPanelAddBulletLinkDraft')
        : t('aiToolsPanelAddBulletLinkDraftOff'),
    });
    if (estimate) {
      items.push({
        key: 'est',
        text: t('aiToolsPanelAddBulletEstimate', {
          eur: estimate.eur.toFixed(4),
          n: estimate.count,
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
    cascade,
    category,
    count,
    dimension,
    era,
    estimate,
    excludeDraftNodes,
    excludeLocked,
    locale,
    t,
    tCat,
    yearMax,
    yearMin,
  ]);

  if (!open) return null;

  const runEstimate = async () => {
    setLoading(true);
    setEstimate(null);
    try {
      const res = await fetch('/api/ai-tools/add-inventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ dryRun: true, ...payload() }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        estimatedCostEur?: number;
        resolvedCount?: number;
      };
      if (!res.ok) {
        onToast(String(j.error ?? t('aiToolsAddError')), 'err');
        return;
      }
      setEstimate({
        eur: j.estimatedCostEur ?? 0,
        count: j.resolvedCount ?? count,
      });
    } catch {
      onToast(t('aiToolsAddError'), 'err');
    } finally {
      setLoading(false);
    }
  };

  const run = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-tools/add-inventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload()),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        draftsCreated?: number;
        linksCreated?: number;
        errors?: string[];
      };
      if (!res.ok) {
        onToast(String(j.error ?? t('aiToolsAddError')), 'err');
        return;
      }
      onToast(
        t('aiToolsAddDone', {
          drafts: j.draftsCreated ?? 0,
          links: j.linksCreated ?? 0,
        }),
        'ok'
      );
      onClose();
    } catch {
      onToast(t('aiToolsAddError'), 'err');
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
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-page p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 flex-1 text-lg font-semibold">
            {t('aiToolsAddTitle')}
          </h2>
          <AiToolsModalCloseButton
            onClose={onClose}
            label={t('aiToolsModalCloseAria')}
          />
        </div>
        <AiToolsModalShell
          form={
            <div className="space-y-3 text-sm">
              <label className="block text-muted-foreground">
                {t('category')}
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as NodeCategory)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
                >
                  {NODE_CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>
                      {tCat(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-muted-foreground">
                {t('era')}
                <select
                  value={era}
                  onChange={(e) =>
                    setEra(
                      e.target.value === 'all' ? 'all' : (e.target.value as Era)
                    )
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
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-muted-foreground">
                  {t('aiReviewFilterYearMin')}
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('aiReviewFilterYearPlaceholder')}
                    value={yearMin}
                    onChange={(e) => setYearMin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
                  />
                </label>
                <label className="block text-muted-foreground">
                  {t('aiReviewFilterYearMax')}
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('aiReviewFilterYearPlaceholder')}
                    value={yearMax}
                    onChange={(e) => setYearMax(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
                  />
                </label>
              </div>
              <label className="block text-muted-foreground">
                {t('aiToolsAddCount')}
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
                />
              </label>
              <label className="block text-muted-foreground">
                {t('columnDimension')}
                <select
                  value={dimension}
                  onChange={(e) =>
                    setDimension(e.target.value as typeof dimension)
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
                >
                  <option value="all">{t('allDimensions')}</option>
                  <option value="matter">{t('dimensionMatter')}</option>
                  <option value="process">{t('dimensionProcess')}</option>
                  <option value="tool">{t('dimensionTool')}</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={cascade}
                  onChange={(e) => setCascade(e.target.checked)}
                />
                {t('aiToolsAddCascade')}
              </label>
              <label className="flex items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={excludeLocked}
                  onChange={(e) => setExcludeLocked(e.target.checked)}
                />
                {t('aiToolsAddExcludeLocked')}
              </label>
              <label className="flex items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={excludeDraftNodes}
                  onChange={(e) => setExcludeDraftNodes(e.target.checked)}
                />
                {t('aiToolsAddExcludeDraftLinks')}
              </label>
              <button
                type="button"
                disabled={loading}
                onClick={() => void runEstimate()}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/30 disabled:opacity-50"
              >
                {loading ? '…' : t('aiToolsCostEstimateBtn')}
              </button>
              {estimate ? (
                <p className="text-sm text-muted-foreground">
                  {t('aiToolsCostEstimate', {
                    eur: estimate.eur.toFixed(4),
                  })}
                </p>
              ) : null}
              {loading ? <AIProgressBar indeterminate /> : null}
            </div>
          }
          panel={
            <AiToolsPanelSections
              aboutTitle={t('aiToolsPanelAboutTitle')}
              aboutBody={t('aiToolsPanelAddIntro')}
              summaryTitle={t('aiToolsPanelSummaryTitle')}
              summaryBody={addPanelSummary}
            />
          }
          footer={
            <>
              <button
                type="button"
                disabled={loading}
                onClick={() => void run()}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {t('aiToolsRun')}
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

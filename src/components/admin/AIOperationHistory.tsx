'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type OpRow = {
  id: string;
  tool: string;
  status: string;
  cards_processed: number | null;
  cards_modified: number | null;
  cost_estimate: number | null;
  started_at: string;
  completed_at: string | null;
};

export function AIOperationHistory({ className }: { className?: string }) {
  const t = useTranslations('editor');
  const [rows, setRows] = useState<OpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/ai-tools/operations', { credentials: 'same-origin' });
      const j = (await res.json().catch(() => ({}))) as {
        operations?: OpRow[];
        error?: string;
      };
      if (!res.ok) {
        setErr(String(j.error ?? 'Error'));
        return;
      }
      setRows(j.operations ?? []);
    } catch {
      setErr(t('aiToolsHistoryError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      className={
        className ??
        'mt-8 rounded-xl border border-border bg-surface/40 p-4'
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t('aiToolsHistoryTitle')}
        </h3>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t('aiToolsHistoryRefresh')}
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : err ? (
        <p className="text-sm text-red-400">{err}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('aiToolsHistoryEmpty')}</p>
      ) : (
        <div className="max-h-[280px] overflow-auto">
          <table className="w-full text-left text-xs text-foreground">
            <thead className="sticky top-0 bg-surface text-muted-foreground">
              <tr>
                <th className="py-1 pr-2">{t('aiToolsHistoryColTool')}</th>
                <th className="py-1 pr-2">{t('aiToolsHistoryColStatus')}</th>
                <th className="py-1 pr-2">{t('aiToolsHistoryColCards')}</th>
                <th className="py-1 pr-2">{t('aiToolsHistoryColCost')}</th>
                <th className="py-1">{t('aiToolsHistoryColStarted')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="py-1.5 pr-2 font-mono">{r.tool}</td>
                  <td className="py-1.5 pr-2">{r.status}</td>
                  <td className="py-1.5 pr-2">
                    {r.cards_modified ?? 0}/{r.cards_processed ?? 0}
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.cost_estimate != null ? r.cost_estimate.toFixed(4) : '—'}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {new Date(r.started_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

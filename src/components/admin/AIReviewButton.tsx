'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function AIReviewButton({
  inventionId,
  disabled,
  onResult,
}: {
  inventionId: string;
  disabled?: boolean;
  onResult: (message: string, kind: 'ok' | 'err') => void;
}) {
  const t = useTranslations('editor');
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch('/api/ai-tools/ai-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          inventionIds: [inventionId],
          mode: 'full',
        }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        createdSuggestions?: number;
        cleanCards?: number;
        errors?: { inventionId: string; message: string }[];
      };
      if (!res.ok) {
        onResult(String(j.error ?? t('aiReviewError')), 'err');
        return;
      }
      const err = j.errors?.find((e) => e.inventionId === inventionId);
      if (err) {
        onResult(err.message, 'err');
        return;
      }
      const created = j.createdSuggestions ?? 0;
      const clean = (j.cleanCards ?? 0) >= 1;
      if (created > 0) {
        onResult(
          t('aiReviewToastCreated', { count: created }),
          'ok'
        );
      } else if (clean) {
        onResult(t('aiReviewToastNoIssue'), 'ok');
      } else {
        onResult(t('aiReviewToastNoSuggestion'), 'err');
      }
    } catch {
      onResult(t('aiReviewError'), 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled || busy}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-500/45 bg-transparent text-violet-200/90 transition-colors hover:bg-violet-500/15 hover:text-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 disabled:cursor-not-allowed disabled:opacity-40"
      title={t('aiReviewRowTitle')}
      aria-label={t('aiReviewRowTitle')}
      onClick={() => void run()}
    >
      <span className="text-[14px] leading-none" aria-hidden>
        AI
      </span>
    </button>
  );
}

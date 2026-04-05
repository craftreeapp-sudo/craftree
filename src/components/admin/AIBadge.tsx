'use client';

import type { SuggestionRow } from '@/lib/admin-suggestion-shared';

export function suggestionRowIsAi(row: {
  suggestion_type: string;
  data: unknown;
}): boolean {
  if (row.suggestion_type === 'ai_review' || row.suggestion_type === 'enrichment')
    return true;
  const d = row.data as { source?: string } | null;
  return d?.source === 'ai';
}

/** Badge pour suggestions générées par l’IA (review automatique). */
export function SuggestionAiBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded border border-violet-500/45 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-violet-100"
      title="Suggestion IA"
    >
      AI
    </span>
  );
}

export function SuggestionSourceBadge({ row }: { row: SuggestionRow }) {
  if (!suggestionRowIsAi(row)) return null;
  return <SuggestionAiBadge />;
}

import type { useTranslations } from 'next-intl';
import type { AdminApproveSummary } from '@/lib/admin-approve-suggestion';

type AdminT = ReturnType<typeof useTranslations<'admin'>>;

export type AggregatedApproveSummary = {
  nodesCreated: number;
  sheetsUpdatedCount: number;
  linksInserted: number;
  linksUpdated: number;
  linksDeleted: number;
};

export function aggregateApproveSummaries(
  items: AdminApproveSummary[]
): AggregatedApproveSummary {
  const out: AggregatedApproveSummary = {
    nodesCreated: 0,
    sheetsUpdatedCount: 0,
    linksInserted: 0,
    linksUpdated: 0,
    linksDeleted: 0,
  };
  for (const s of items) {
    out.nodesCreated += s.nodesCreated;
    if (s.nodeUpdated) out.sheetsUpdatedCount += 1;
    out.linksInserted += s.linksInserted;
    out.linksUpdated += s.linksUpdated;
    out.linksDeleted += s.linksDeleted;
  }
  return out;
}

function pushNonZeroParts(
  t: AdminT,
  s: AdminApproveSummary,
  parts: string[]
): void {
  if (s.suggestionType === 'anonymous_feedback') {
    parts.push(t('approveSummaryAnonymousArchived'));
    return;
  }
  if (s.nodesCreated > 0) {
    parts.push(t('approveSummaryNodesCreated', { count: s.nodesCreated }));
  }
  if (s.nodeUpdated) {
    parts.push(t('approveSummarySheetUpdatedOne'));
  }
  if (s.linksInserted > 0) {
    parts.push(t('approveSummaryLinksAdded', { count: s.linksInserted }));
  }
  if (s.linksUpdated > 0) {
    parts.push(t('approveSummaryLinksUpdated', { count: s.linksUpdated }));
  }
  if (s.linksDeleted > 0) {
    parts.push(t('approveSummaryLinksRemoved', { count: s.linksDeleted }));
  }
}

/** Message toast pour une suggestion unique. */
export function toastMessageForApproveSummary(
  t: AdminT,
  summary: AdminApproveSummary
): string {
  const parts: string[] = [];
  pushNonZeroParts(t, summary, parts);
  if (parts.length === 0) {
    return t('toastApproved');
  }
  return `${t('approveSummaryApplied')}: ${parts.join(' · ')}`;
}

/** Message toast après approbation groupée. */
export function toastMessageForAggregatedApprove(
  t: AdminT,
  suggestionCount: number,
  agg: AggregatedApproveSummary
): string {
  const parts: string[] = [];
  if (agg.nodesCreated > 0) {
    parts.push(t('approveSummaryNodesCreated', { count: agg.nodesCreated }));
  }
  if (agg.sheetsUpdatedCount > 0) {
    parts.push(
      t('approveSummarySheetsUpdated', { count: agg.sheetsUpdatedCount })
    );
  }
  if (agg.linksInserted > 0) {
    parts.push(t('approveSummaryLinksAdded', { count: agg.linksInserted }));
  }
  if (agg.linksUpdated > 0) {
    parts.push(t('approveSummaryLinksUpdated', { count: agg.linksUpdated }));
  }
  if (agg.linksDeleted > 0) {
    parts.push(t('approveSummaryLinksRemoved', { count: agg.linksDeleted }));
  }
  const intro = t('approveSummaryBulkIntro', { count: suggestionCount });
  if (parts.length === 0) {
    return intro;
  }
  return `${intro} — ${parts.join(' · ')}`;
}

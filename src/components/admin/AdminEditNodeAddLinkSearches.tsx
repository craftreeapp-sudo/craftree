'use client';

import { useCallback, useId, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import {
  buildPeerSearchBlobMap,
  matchesSearchTokens,
} from '@/lib/suggest-peer-search';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { getCategoryColor } from '@/lib/colors';
import { ADMIN_DRAFT_PROPOSED_ADD } from '@/lib/admin-suggestion-shared';
import type { TechNodeBasic } from '@/lib/types';
import { NodeCategory } from '@/lib/types';
import { RelationType } from '@/lib/types';

const ADMIN_ADD_LINK_SEARCH_MAX = 40;

type Props = {
  currentNodeId: string;
  draft: Record<string, unknown>;
  draftAdds: Record<string, unknown>[];
  onEditDraftChange: (d: Record<string, unknown>) => void;
};

export function AdminEditNodeAddLinkSearches({
  currentNodeId,
  draft,
  draftAdds,
  onEditDraftChange,
}: Props) {
  const locale = useLocale();
  const tEditor = useTranslations('editor');
  const tConn = useTranslations('connectionPopup');
  const tCommon = useTranslations('common');
  const tCat = useTranslations('categories');
  const tTypes = useTranslations('types');
  const graphNodes = useGraphStore((s) => s.nodes);
  const detailsById = useNodeDetailsStore((s) => s.byId);
  const peerSearchBlobMap = useMemo(
    () => buildPeerSearchBlobMap(graphNodes, detailsById),
    [graphNodes, detailsById]
  );

  const [qLed, setQLed] = useState('');
  const [qBuilt, setQBuilt] = useState('');
  const ledSearchId = useId();
  const builtSearchId = useId();

  const filterMatches = useCallback(
    (qRaw: string) => {
      const q = qRaw.trim();
      if (!q || !currentNodeId) return [];
      const out: TechNodeBasic[] = [];
      for (const n of graphNodes) {
        if (n.id === currentNodeId) continue;
        const blob =
          peerSearchBlobMap[n.id] ?? `${n.name} ${n.id}`.toLowerCase();
        if (!matchesSearchTokens(blob, q)) continue;
        out.push(n);
      }
      out.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      );
      return out.slice(0, ADMIN_ADD_LINK_SEARCH_MAX);
    },
    [graphNodes, peerSearchBlobMap, currentNodeId]
  );

  const matchesLed = useMemo(() => filterMatches(qLed), [filterMatches, qLed]);
  const matchesBuilt = useMemo(
    () => filterMatches(qBuilt),
    [filterMatches, qBuilt]
  );

  const hasEdge = (source_id: string, target_id: string) =>
    draftAdds.some(
      (a) =>
        String(a.source_id) === source_id && String(a.target_id) === target_id
    );

  const appendLink = (section: 'ledTo' | 'builtUpon', peerId: string) => {
    if (!currentNodeId) return;
    const source_id = section === 'ledTo' ? currentNodeId : peerId;
    const target_id = section === 'ledTo' ? peerId : currentNodeId;
    if (hasEdge(source_id, target_id)) return;
    onEditDraftChange({
      ...draft,
      [ADMIN_DRAFT_PROPOSED_ADD]: [
        ...draftAdds,
        {
          source_id,
          target_id,
          relation_type: RelationType.MATERIAL,
          section,
        },
      ],
    });
    setQLed('');
    setQBuilt('');
  };

  const searchInputClass =
    'w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-[12px] text-foreground outline-none ring-1 ring-border/40 placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/25';

  const renderResultButton = (
    n: TechNodeBasic,
    section: 'ledTo' | 'builtUpon'
  ) => {
    const label = pickNodeDisplayName(
      locale,
      n.name,
      detailsById[n.id]?.name_en
    );
    const dotColor = getCategoryColor(n.category as NodeCategory);
    const disabled =
      section === 'ledTo'
        ? hasEdge(currentNodeId, n.id)
        : hasEdge(n.id, currentNodeId);
    return (
      <li key={`${section}-${n.id}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => appendLink(section, n.id)}
          className="flex w-full items-center gap-2 rounded-md border border-border/50 bg-surface/40 px-2 py-2 text-start transition-colors hover:border-accent/45 hover:bg-surface/70 disabled:cursor-not-allowed disabled:opacity-45"
          aria-label={tEditor('suggestAddLinkAria')}
        >
          <span
            className="mt-0.5 h-2 w-2 shrink-0 rounded-full ring-1 ring-white/10"
            style={{ backgroundColor: dotColor }}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-medium text-foreground">
              {label}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {safeCategoryLabel(tCat, String(n.category), tTypes)}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="mb-3 space-y-4 rounded-[6px] border border-dashed border-border/60 bg-muted/15 px-3 py-3">
      <p className="text-[11px] leading-snug text-muted-foreground">
        {tEditor('suggestAddLinkAria')}
      </p>

      <div>
        <label
          htmlFor={ledSearchId}
          className="mb-1 block text-[11px] font-medium text-foreground"
        >
          {tEditor('ledToSection')}
        </label>
        <input
          id={ledSearchId}
          type="search"
          value={qLed}
          onChange={(e) => setQLed(e.target.value)}
          placeholder={tConn('searchPlaceholder')}
          autoComplete="off"
          className={searchInputClass}
        />
        {qLed.trim() ? (
          matchesLed.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              {tCommon('noResults')}
            </p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
              {matchesLed.map((n) => renderResultButton(n, 'ledTo'))}
            </ul>
          )
        ) : null}
      </div>

      <div>
        <label
          htmlFor={builtSearchId}
          className="mb-1 block text-[11px] font-medium text-foreground"
        >
          {tEditor('builtUponSection')}
        </label>
        <input
          id={builtSearchId}
          type="search"
          value={qBuilt}
          onChange={(e) => setQBuilt(e.target.value)}
          placeholder={tConn('searchPlaceholder')}
          autoComplete="off"
          className={searchInputClass}
        />
        {qBuilt.trim() ? (
          matchesBuilt.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              {tCommon('noResults')}
            </p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-0.5">
              {matchesBuilt.map((n) => renderResultButton(n, 'builtUpon'))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}

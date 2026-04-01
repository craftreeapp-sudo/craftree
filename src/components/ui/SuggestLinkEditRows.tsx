'use client';

import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { RelationType, NodeCategory, TechNodeBasic, TechNodeDetails } from '@/lib/types';
import type { SuggestLinkSnapshot } from '@/lib/suggestion-link-snapshot';
import { getCategoryColor } from '@/lib/colors';
import { matchesSearchTokens } from '@/lib/suggest-peer-search';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { safeCategoryLabel } from '@/lib/safe-category-label';

const RELATION_DOT: Record<RelationType, string> = {
  material: '#94A3B8',
  tool: '#A78BFA',
  energy: '#EF4444',
  knowledge: '#38BDF8',
  catalyst: 'rgba(139, 149, 168, 0.5)',
};

const MAX_GLOBAL_RESULTS = 200;

export type SuggestLinkCardVariant = 'default' | 'stagedRemoval' | 'pendingAdd';

type CardProps = {
  linkId: string;
  peerLabel: string;
  peerCategory: NodeCategory;
  value: SuggestLinkSnapshot;
  onRemove: (linkId: string) => void;
  /** Pas de bouton retirer (contributeur non connecté). */
  readOnly?: boolean;
  variant?: SuggestLinkCardVariant;
  onRestore?: (linkId: string) => void;
};

export function SuggestLinkEditCard({
  linkId,
  peerLabel,
  peerCategory,
  value,
  onRemove,
  readOnly = false,
  variant = 'default',
  onRestore,
}: CardProps) {
  const tRel = useTranslations('relationTypes');
  const tEx = useTranslations('explore');
  const te = useTranslations('editor');
  const rel = value.relation_type;
  const dotColor =
    rel === 'material'
      ? getCategoryColor(peerCategory)
      : RELATION_DOT[rel];

  const isOrange =
    variant === 'stagedRemoval' || variant === 'pendingAdd';
  const cardClass = isOrange
    ? 'border-[#F59E0B]/80 bg-amber-950/25 ring-1 ring-[#F59E0B]/35'
    : 'border-border/80 bg-surface/40';

  return (
    <li
      className={`relative rounded-md border px-2 py-2.5 transition-[background-color,border-color,box-shadow] duration-150 ${
        isOrange
          ? ''
          : 'hover:border-accent/35 hover:bg-surface/60 hover:shadow-sm'
      } ${cardClass} ${readOnly ? 'pr-2' : 'pr-9'}`}
    >
      {!readOnly && variant === 'stagedRemoval' && onRestore ? (
        <button
          type="button"
          onClick={() => onRestore(linkId)}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 text-[#F59E0B] transition-colors hover:bg-[#F59E0B]/20 hover:text-amber-300"
          aria-label={tEx('suggestLinkRestoreAria')}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      ) : null}
      {!readOnly && variant !== 'stagedRemoval' ? (
        <button
          type="button"
          onClick={() => onRemove(linkId)}
          className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded p-0.5 text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          aria-label={te('removeLinkAria')}
        >
          <span className="text-lg leading-none" aria-hidden>
            ×
          </span>
        </button>
      ) : null}
      <div className="flex gap-3">
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
          style={{
            backgroundColor: dotColor,
            opacity: rel === 'catalyst' ? 0.6 : 1,
          }}
          title={tRel(rel)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-snug text-accent">{peerLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tRel(rel)}
            {value.is_optional ? ` · ${tEx('optional')}` : ''}
          </p>
        </div>
      </div>
    </li>
  );
}

function SuggestBrowseReadOnlyCard({
  node,
  locale,
  detailsById,
  onAdd,
}: {
  node: TechNodeBasic;
  locale: string;
  detailsById: Record<string, TechNodeDetails | undefined>;
  onAdd?: () => void;
}) {
  const tCat = useTranslations('categories');
  const te = useTranslations('editor');
  const label = pickNodeDisplayName(
    locale,
    node.name,
    detailsById[node.id]?.name_en
  );
  const dotColor = getCategoryColor(node.category as NodeCategory);

  const inner = (
    <div className="flex gap-3">
      <span
        className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
        style={{ backgroundColor: dotColor }}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug text-accent">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {safeCategoryLabel(tCat, String(node.category))}
        </p>
      </div>
    </div>
  );

  if (onAdd) {
    return (
      <li>
        <button
          type="button"
          onClick={onAdd}
          className="w-full cursor-pointer rounded-md border border-border/50 bg-surface/25 px-2 py-2.5 text-start transition-[background-color,border-color,box-shadow] duration-150 hover:border-accent/45 hover:bg-surface/55 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
          aria-label={te('suggestAddLinkAria')}
        >
          {inner}
        </button>
      </li>
    );
  }

  return (
    <li className="rounded-md border border-border/50 bg-surface/25 px-2 py-2.5">
      {inner}
    </li>
  );
}

type SectionProps = {
  sectionTitle: string;
  count: number;
  open: boolean;
  onToggleOpen: () => void;
  emptyLabel: string;
  currentNodeId: string;
  locale: string;
  graphNodes: TechNodeBasic[];
  peerSearchBlobMap: Record<string, string>;
  detailsById: Record<string, TechNodeDetails | undefined>;
  /** Liens actuels dans cette section (× pour retirer la suggestion). */
  existingRows: {
    linkId: string;
    peerId: string;
    peerLabel: string;
    peerCategory: NodeCategory;
    value: SuggestLinkSnapshot;
    variant?: SuggestLinkCardVariant;
  }[];
  onRemove: (linkId: string) => void;
  /** Annuler une suppression de lien existant. */
  onRestoreLink?: (linkId: string) => void;
  /** Clic sur un résultat de recherche pour proposer un nouveau lien. */
  onAddPeer?: (peerId: string) => void;
  /** Masque recherche / ajout ; cartes sans bouton retirer. */
  readOnly?: boolean;
  /** Classes additionnelles sur le `<section>` (ex. `!mt-0`). */
  className?: string;
};

export function SuggestLinkSection({
  sectionTitle,
  count,
  open,
  onToggleOpen,
  emptyLabel,
  currentNodeId,
  locale,
  graphNodes,
  peerSearchBlobMap,
  detailsById,
  existingRows,
  onRemove,
  onRestoreLink,
  onAddPeer,
  readOnly = false,
  className,
}: SectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputId = useId();
  const tConn = useTranslations('connectionPopup');
  const tCommon = useTranslations('common');

  const globalMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return [];
    const out: TechNodeBasic[] = [];
    for (const n of graphNodes) {
      if (n.id === currentNodeId) continue;
      const blob =
        peerSearchBlobMap[n.id] ??
        `${n.name} ${n.id}`.toLowerCase();
      if (!matchesSearchTokens(blob, q)) continue;
      out.push(n);
    }
    out.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    return out.slice(0, MAX_GLOBAL_RESULTS);
  }, [graphNodes, peerSearchBlobMap, searchQuery, currentNodeId]);

  const existingByPeerId = useMemo(() => {
    const m = new Map<string, (typeof existingRows)[0]>();
    for (const r of existingRows) {
      m.set(r.peerId, r);
    }
    return m;
  }, [existingRows]);

  return (
    <section className={`mt-6 ${className ?? ''}`}>
      <button
        type="button"
        onClick={onToggleOpen}
        className="mb-3 flex w-full items-center justify-between gap-2 rounded-md py-1.5 text-start transition-colors hover:bg-surface/50"
        aria-expanded={open}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {sectionTitle} ({count})
        </h3>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted-foreground transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <>
          {readOnly ? (
            existingRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              <ul className="space-y-3">
                {existingRows.map(
                  ({ linkId, peerLabel, peerCategory, value, variant }) => (
                    <SuggestLinkEditCard
                      key={linkId}
                      linkId={linkId}
                      peerLabel={peerLabel}
                      peerCategory={peerCategory}
                      value={value}
                      onRemove={onRemove}
                      variant={variant ?? 'default'}
                      onRestore={onRestoreLink}
                      readOnly
                    />
                  )
                )}
              </ul>
            )
          ) : null}
          {!readOnly ? (
            <div className="mb-3">
              <label className="sr-only" htmlFor={searchInputId}>
                {tConn('searchPlaceholder')}
              </label>
              <input
                id={searchInputId}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tConn('searchPlaceholder')}
                autoComplete="off"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground shadow-sm outline-none ring-1 ring-border/50 transition-[box-shadow,border-color] placeholder:font-normal placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/25"
              />
            </div>
          ) : null}
          {!readOnly && searchQuery.trim() === '' ? (
            existingRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              <ul className="space-y-3">
                {existingRows.map(
                  ({ linkId, peerLabel, peerCategory, value, variant }) => (
                    <SuggestLinkEditCard
                      key={linkId}
                      linkId={linkId}
                      peerLabel={peerLabel}
                      peerCategory={peerCategory}
                      value={value}
                      onRemove={onRemove}
                      variant={variant ?? 'default'}
                      onRestore={onRestoreLink}
                    />
                  )
                )}
              </ul>
            )
          ) : null}
          {!readOnly && searchQuery.trim() !== '' ? (
            globalMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tCommon('noResults')}</p>
            ) : (
              <ul className="max-h-[min(50vh,28rem)] space-y-3 overflow-y-auto pr-0.5">
                {globalMatches.map((n) => {
                  const row = existingByPeerId.get(n.id);
                  if (row) {
                    return (
                      <SuggestLinkEditCard
                        key={row.linkId}
                        linkId={row.linkId}
                        peerLabel={row.peerLabel}
                        peerCategory={row.peerCategory}
                        value={row.value}
                        onRemove={onRemove}
                        variant={row.variant ?? 'default'}
                        onRestore={onRestoreLink}
                      />
                    );
                  }
                  return (
                    <SuggestBrowseReadOnlyCard
                      key={n.id}
                      node={n}
                      locale={locale}
                      detailsById={detailsById}
                      onAdd={
                        onAddPeer ? () => onAddPeer(n.id) : undefined
                      }
                    />
                  );
                })}
              </ul>
            )
          ) : null}
        </>
      ) : null}
    </section>
  );
}

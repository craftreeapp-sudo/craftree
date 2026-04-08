'use client';

import { useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { NodeCategory, TechNodeBasic, TechNodeDetails } from '@/lib/types';
import type { SuggestLinkSnapshot } from '@/lib/suggestion-link-snapshot';
import { getCategoryColor } from '@/lib/colors';
import { matchesSearchTokens } from '@/lib/suggest-peer-search';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { normalizeRelationTypeForUi } from '@/lib/relation-display';
import { PeerInventionThumb } from '@/components/explore/PeerInventionThumb';
import { useGraphStore } from '@/stores/graph-store';
import type { LinkNeighborhoodMode } from '@/stores/ui-store';
import {
  INVENTION_KIND_ORDER,
  type InventionKindKey,
  inventionKindFromLinkAndPeer,
  relationTypeFromInventionKind,
} from '@/lib/invention-classification';
import { RelationType } from '@/lib/types';

const RELATION_DOT: Record<RelationType, string> = {
  [RelationType.MATERIAL]: '#94A3B8',
  [RelationType.COMPONENT]: '#EAB308',
  [RelationType.TOOL]: '#A78BFA',
  [RelationType.ENERGY]: '#EF4444',
  [RelationType.PROCESS]: '#38BDF8',
  [RelationType.INFRASTRUCTURE]: '#64748B',
};

const MAX_GLOBAL_RESULTS = 200;

export type SuggestLinkCardVariant =
  | 'default'
  | 'existing'
  | 'stagedRemoval'
  | 'pendingAdd'
  | 'unresolvedAdd';

type CardProps = {
  linkId: string;
  peerId: string;
  peerLabel: string;
  peerCategory: NodeCategory;
  detailsById: Record<string, TechNodeDetails | undefined>;
  value: SuggestLinkSnapshot;
  onRemove: (linkId: string) => void;
  /** Pas de bouton retirer (contributeur non connecté). */
  readOnly?: boolean;
  variant?: SuggestLinkCardVariant;
  onRestore?: (linkId: string) => void;
  /** Admin ou utilisateur connecté : liste déroulante pour le type de relation */
  showRelationPicker?: boolean;
  onChangeInventionKind?: (
    linkId: string,
    peerId: string,
    kind: InventionKindKey
  ) => void;
  /**
   * Affiche le choix direct / étendu par lien (`is_optional` ↔ étendu) entre le type de relation et le bouton retirer.
   */
  showInlineLinkNeighborhood?: boolean;
  /** Requis si `showInlineLinkNeighborhood` : met à jour le type direct/étendu pour ce lien uniquement. */
  onChangeLinkNeighborhood?: (
    linkId: string,
    mode: LinkNeighborhoodMode
  ) => void;
  /** Admin modération : déplacer le lien vers l’autre section (À permis ↔ Obtenu à partir de). */
  onMoveToOtherLinkSection?: () => void;
  moveToOtherLinkSectionAria?: string;
  /** Sous-titre sous le nom (ex. « via … » pour un hop étendu). */
  subtitle?: string | null;
  /** Classes additionnelles sur le `<li>` (ex. bordure en pointillés). */
  listItemExtraClassName?: string;
  /** Quand le pair n’est pas dans le graphe (ex. `__unresolved__`), classification stockée sur le brouillon d’ajout. */
  peerKindHint?: Pick<TechNodeBasic, 'dimension' | 'materialLevel'>;
};

export function SuggestLinkEditCard({
  linkId,
  peerId,
  peerLabel,
  peerCategory,
  detailsById,
  value,
  onRemove,
  readOnly = false,
  variant = 'default',
  onRestore,
  showRelationPicker = false,
  onChangeInventionKind,
  showInlineLinkNeighborhood = false,
  onChangeLinkNeighborhood,
  onMoveToOtherLinkSection,
  moveToOtherLinkSectionAria,
  subtitle,
  listItemExtraClassName,
  peerKindHint,
}: CardProps) {
  const relationFieldId = useId();
  const neighborhoodFieldId = useId();
  const tInv = useTranslations('inventionKinds');
  const tEx = useTranslations('explore');
  const te = useTranslations('editor');
  const peerNode = useGraphStore((s) => s.getNodeById(peerId));
  const imageBust = useGraphStore((s) => s.imageBustByNodeId[peerId] ?? 0);
  const peerImageUrl =
    peerNode?.image_url?.trim() ??
    detailsById[peerId]?.image_url?.trim() ??
    null;
  const rel = normalizeRelationTypeForUi(String(value.relation_type));
  const peerForKind = peerNode ?? peerKindHint;
  const kind = inventionKindFromLinkAndPeer(rel, peerForKind);
  const rtForDot = relationTypeFromInventionKind(kind);
  const dotColor =
    kind === 'matter_raw' ||
    kind === 'matter_processed' ||
    kind === 'matter_industrial'
      ? getCategoryColor(peerCategory)
      : RELATION_DOT[rtForDot] ?? RELATION_DOT[RelationType.INFRASTRUCTURE];

  const showNeighborhoodRow =
    Boolean(showInlineLinkNeighborhood) &&
    showRelationPicker &&
    Boolean(onChangeInventionKind) &&
    Boolean(onChangeLinkNeighborhood) &&
    !readOnly;

  const linkTypeMode: LinkNeighborhoodMode = value.is_optional
    ? 'direct_and_extended'
    : 'direct';

  /** Accent : orange = suppression proposée, vert = lien vers fiche existante, bleu = fiche à créer, gris = inchangé. */
  const cardClass =
    variant === 'stagedRemoval'
      ? 'border-[#F59E0B]/80 bg-amber-950/25 ring-1 ring-[#F59E0B]/35'
      : variant === 'pendingAdd'
        ? 'border-emerald-500/50 bg-emerald-950/20 ring-1 ring-emerald-500/25'
        : variant === 'unresolvedAdd'
          ? 'border-sky-500/50 bg-sky-950/25 ring-1 ring-sky-500/30'
          : variant === 'existing' || variant === 'default'
            ? 'border-border/50 bg-surface/25 ring-1 ring-border/30'
            : 'border-border/80 bg-surface/40';

  const showListHover = !readOnly && variant === 'default';

  return (
    <li
      className={`relative rounded-md border px-2 py-2.5 transition-[background-color,border-color,box-shadow] duration-150 ${
        showListHover
          ? 'hover:border-accent/35 hover:bg-surface/60 hover:shadow-sm'
          : ''
      } ${cardClass} ${readOnly ? 'pr-2' : 'pr-9'} ${listItemExtraClassName ?? ''}`}
    >
      {!readOnly && variant === 'stagedRemoval' && onRestore ? (
        <button
          type="button"
          onClick={() => onRestore(linkId)}
          className="absolute right-2 top-2 z-10 rounded p-0.5 text-[#F59E0B] transition-colors hover:bg-[#F59E0B]/20 hover:text-amber-300"
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
          className="absolute right-2 top-2 z-10 rounded p-0.5 text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          aria-label={te('removeLinkAria')}
          title={
            variant === 'unresolvedAdd'
              ? te('unresolvedCardCreateOnApproveHint')
              : undefined
          }
        >
          <span className="text-lg leading-none" aria-hidden>
            ×
          </span>
        </button>
      ) : null}
      <div className="flex items-start gap-1.5 sm:gap-2">
        {onMoveToOtherLinkSection &&
        !readOnly &&
        variant !== 'stagedRemoval' ? (
          <button
            type="button"
            onClick={onMoveToOtherLinkSection}
            className="mt-0.5 shrink-0 rounded-md border border-border/70 bg-surface/80 p-1 text-muted-foreground transition-colors hover:border-accent/40 hover:bg-surface hover:text-foreground"
            aria-label={moveToOtherLinkSectionAria ?? ''}
            title={moveToOtherLinkSectionAria}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M7 16V4M7 4 3 8M7 4l4 4" />
              <path d="M17 8v12m0 0 4-4m-4 4-4-4" />
            </svg>
          </button>
        ) : null}
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <PeerInventionThumb
          category={peerCategory}
          imageUrl={peerImageUrl}
          imageBust={imageBust}
        />
        <div className="min-w-0 flex-1">
          <div className="flex w-full min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-medium leading-snug text-accent">
              {peerLabel}
            </span>
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
              style={{
                backgroundColor: dotColor,
              }}
              title={tInv(kind)}
            />
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
          {showRelationPicker &&
          onChangeInventionKind &&
          !readOnly ? (
            <div className="mt-1.5 w-full min-w-0">
              {showNeighborhoodRow ? (
                <div className="flex w-full min-w-0 flex-nowrap items-end gap-x-2 sm:gap-x-3">
                  <div className="min-w-0 flex-[1_1_0]">
                    <p className="mb-1 truncate text-[10px] font-medium text-muted-foreground">
                      {te('linkColumnRelationTypes')}
                    </p>
                    <label className="sr-only" htmlFor={relationFieldId}>
                      {te('relationTypeLabel')}
                    </label>
                    <select
                      id={relationFieldId}
                      value={kind}
                      onChange={(e) =>
                        onChangeInventionKind(
                          linkId,
                          peerId,
                          e.target.value as InventionKindKey
                        )
                      }
                      className="w-full min-w-0 max-w-full rounded-md border border-border/80 bg-surface px-2 py-1.5 text-xs font-medium text-foreground outline-none ring-1 ring-border/40 focus:border-accent focus:ring-2 focus:ring-accent/25"
                    >
                      {INVENTION_KIND_ORDER.map((k) => (
                        <option key={k} value={k}>
                          {tInv(k)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0 flex-[1_1_0]">
                    <p className="mb-1 truncate text-[10px] font-medium text-muted-foreground">
                      {te('linkColumnLinkType')}
                    </p>
                    <label className="sr-only" htmlFor={neighborhoodFieldId}>
                      {tEx('linkNeighborhoodSelectAria')}
                    </label>
                    <select
                      id={neighborhoodFieldId}
                      value={linkTypeMode}
                      onChange={(e) =>
                        onChangeLinkNeighborhood?.(
                          linkId,
                          e.target.value as LinkNeighborhoodMode
                        )
                      }
                      className="w-full min-w-0 rounded-md border border-border/80 bg-surface px-2 py-1.5 text-xs font-medium text-foreground outline-none ring-1 ring-border/40 focus:border-accent focus:ring-2 focus:ring-accent/25"
                    >
                      <option value="direct">
                        {tEx('linkNeighborhoodDirect')}
                      </option>
                      <option value="direct_and_extended">
                        {tEx('linkNeighborhoodDirectAndExtended')}
                      </option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex w-full min-w-0 flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={relationFieldId}>
                    {te('relationTypeLabel')}
                  </label>
                  <select
                    id={relationFieldId}
                    value={kind}
                    onChange={(e) =>
                      onChangeInventionKind(
                        linkId,
                        peerId,
                        e.target.value as InventionKindKey
                      )
                    }
                    className="min-w-[6.5rem] max-w-full shrink-0 rounded-md border border-border/80 bg-surface px-2 py-1.5 text-xs font-medium text-foreground outline-none ring-1 ring-border/40 focus:border-accent focus:ring-2 focus:ring-accent/25 sm:max-w-[12rem]"
                  >
                    {INVENTION_KIND_ORDER.map((k) => (
                      <option key={k} value={k}>
                        {tInv(k)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">{tInv(kind)}</p>
          )}
        </div>
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
  const imageBust = useGraphStore((s) => s.imageBustByNodeId[node.id] ?? 0);
  const peerImageUrl =
    node.image_url?.trim() ?? detailsById[node.id]?.image_url?.trim() ?? null;
  const label = pickNodeDisplayName(
    locale,
    node.name,
    detailsById[node.id]?.name_en
  );
  const dotColor = getCategoryColor(node.category as NodeCategory);

  const inner = (
    <div className="flex items-start gap-2.5">
      <PeerInventionThumb
        category={node.category as NodeCategory}
        imageUrl={peerImageUrl}
        imageBust={imageBust}
      />
      <div className="min-w-0 flex-1">
        <div className="flex w-full min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-medium leading-snug text-accent">
            {label}
          </span>
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
            style={{ backgroundColor: dotColor }}
          />
        </div>
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
    peerKindHint?: Pick<TechNodeBasic, 'dimension' | 'materialLevel'>;
  }[];
  onRemove: (linkId: string) => void;
  /** Annuler une suppression de lien existant. */
  onRestoreLink?: (linkId: string) => void;
  /** Clic sur un résultat de recherche pour proposer un nouveau lien. */
  onAddPeer?: (peerId: string) => void;
  /** Masque recherche / ajout ; cartes sans bouton retirer. */
  readOnly?: boolean;
  /** Admin ou utilisateur connecté : permet de choisir le type de relation par lien */
  showRelationPicker?: boolean;
  onChangeInventionKind?: (
    linkId: string,
    peerId: string,
    kind: InventionKindKey
  ) => void;
  /** Masque le titre repliable « Section (n) » (ex. section Obtenu à partir de). */
  hideSectionHeading?: boolean;
  /**
   * Affiche le sélecteur direct / étendu par lien sur chaque ligne (entre type de relation et ×).
   */
  linkNeighborhoodInLinkRows?: boolean;
  onChangeLinkNeighborhood?: (
    linkId: string,
    mode: LinkNeighborhoodMode
  ) => void;
  /** Section de cette liste : sert au libellé du bouton « déplacer vers l’autre section ». */
  listSection?: 'ledTo' | 'builtUpon';
  /** Déplace un lien vers l’autre section (admin). */
  onMoveLinkToOtherSection?: (linkId: string) => void;
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
  showRelationPicker = false,
  onChangeInventionKind,
  linkNeighborhoodInLinkRows = false,
  onChangeLinkNeighborhood,
  listSection,
  onMoveLinkToOtherSection,
  className,
  hideSectionHeading = false,
}: SectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputId = useId();
  const tConn = useTranslations('connectionPopup');
  const tCommon = useTranslations('common');
  const tEditor = useTranslations('editor');
  const moveOtherAria =
    listSection === 'ledTo'
      ? tEditor('moveLinkToBuiltUponSection')
      : listSection === 'builtUpon'
        ? tEditor('moveLinkToLedToSection')
        : undefined;

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

  const sectionOpen = hideSectionHeading || open;

  return (
    <section className={`mt-6 ${className ?? ''}`}>
      {!hideSectionHeading ? (
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
      ) : null}
      {sectionOpen ? (
        <>
          {readOnly ? (
            existingRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyLabel}</p>
            ) : (
              <ul className="space-y-3">
                {existingRows.map(
                  ({
                    linkId,
                    peerId,
                    peerLabel,
                    peerCategory,
                    value,
                    variant,
                    peerKindHint,
                  }) => (
                    <SuggestLinkEditCard
                      key={linkId}
                      linkId={linkId}
                      peerId={peerId}
                      peerLabel={peerLabel}
                      peerCategory={peerCategory}
                      detailsById={detailsById}
                      value={value}
                      onRemove={onRemove}
                      variant={variant ?? 'default'}
                      onRestore={onRestoreLink}
                      readOnly
                      showRelationPicker={showRelationPicker}
                      onChangeInventionKind={onChangeInventionKind}
                      showInlineLinkNeighborhood={linkNeighborhoodInLinkRows}
                      onChangeLinkNeighborhood={onChangeLinkNeighborhood}
                      peerKindHint={peerKindHint}
                      onMoveToOtherLinkSection={
                        onMoveLinkToOtherSection &&
                        moveOtherAria &&
                        (variant ?? 'default') !== 'stagedRemoval'
                          ? () => onMoveLinkToOtherSection(linkId)
                          : undefined
                      }
                      moveToOtherLinkSectionAria={moveOtherAria}
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
                  ({
                    linkId,
                    peerId,
                    peerLabel,
                    peerCategory,
                    value,
                    variant,
                    peerKindHint,
                  }) => (
                    <SuggestLinkEditCard
                      key={linkId}
                      linkId={linkId}
                      peerId={peerId}
                      peerLabel={peerLabel}
                      peerCategory={peerCategory}
                      detailsById={detailsById}
                      value={value}
                      onRemove={onRemove}
                      variant={variant ?? 'default'}
                      onRestore={onRestoreLink}
                      showRelationPicker={showRelationPicker}
                      onChangeInventionKind={onChangeInventionKind}
                      showInlineLinkNeighborhood={linkNeighborhoodInLinkRows}
                      onChangeLinkNeighborhood={onChangeLinkNeighborhood}
                      peerKindHint={peerKindHint}
                      onMoveToOtherLinkSection={
                        onMoveLinkToOtherSection &&
                        moveOtherAria &&
                        (variant ?? 'default') !== 'stagedRemoval'
                          ? () => onMoveLinkToOtherSection(linkId)
                          : undefined
                      }
                      moveToOtherLinkSectionAria={moveOtherAria}
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
                        peerId={row.peerId}
                        peerLabel={row.peerLabel}
                        peerCategory={row.peerCategory}
                        detailsById={detailsById}
                        value={row.value}
                        onRemove={onRemove}
                        variant={row.variant ?? 'default'}
                        onRestore={onRestoreLink}
                        showRelationPicker={showRelationPicker}
                        onChangeInventionKind={onChangeInventionKind}
                        showInlineLinkNeighborhood={linkNeighborhoodInLinkRows}
                        onChangeLinkNeighborhood={onChangeLinkNeighborhood}
                        peerKindHint={row.peerKindHint}
                        onMoveToOtherLinkSection={
                          onMoveLinkToOtherSection &&
                          moveOtherAria &&
                          (row.variant ?? 'default') !== 'stagedRemoval'
                            ? () => onMoveLinkToOtherSection(row.linkId)
                            : undefined
                        }
                        moveToOtherLinkSectionAria={moveOtherAria}
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

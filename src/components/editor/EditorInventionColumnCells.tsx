'use client';

import Link from 'next/link';
import type { TranslationValues, useTranslations } from 'next-intl';
import { useEffect, useRef, type DragEvent, type ReactNode } from 'react';
import { BuiltUponBadgePopover } from '@/components/explore/BuiltUponBadgePopover';
import { getCategoryColor } from '@/lib/colors';
import { eraLabelFromMessages } from '@/lib/era-display';
import {
  EDITOR_INVENTION_COLUMN_TH_CLASS,
  type EditorInventionColumnId,
} from '@/lib/editor-invention-column-order';
import {
  chemicalNatureTableLabel,
  naturalOriginTableLabel,
} from '@/lib/nature-table-labels';
import { rowIsDraft } from '@/lib/draft-flag';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { treeInventionPath } from '@/lib/tree-routes';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { seedNodeIsLocked } from '@/lib/node-lock';
import { AIReviewButton } from '@/components/admin/AIReviewButton';
import { EDITOR_DIM_KEY, EDITOR_LEVEL_KEY } from './dimension-editor-keys';
import type {
  CraftingLink,
  Era,
  MaterialLevel,
  NodeCategory,
  NodeDimension,
  SeedNode,
} from '@/lib/types';

export type NodeSortKey =
  | 'name'
  | 'category'
  | 'dimension'
  | 'materialLevel'
  | 'era'
  | 'year_approx'
  | 'origin'
  | 'links'
  | 'upstream_in';

type IntlTranslator = ReturnType<typeof useTranslations>;

type SortDir = 'asc' | 'desc';

export function ColumnReorderHandle({
  columnId,
  title,
  onDragStart,
  onDragEnd,
}: {
  columnId: EditorInventionColumnId;
  title: string;
  onDragStart: (id: EditorInventionColumnId) => void;
  onDragEnd: () => void;
}) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', columnId);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(columnId);
      }}
      onDragEnd={() => onDragEnd()}
      title={title}
      className="inline-flex shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
      aria-label={title}
    >
      <svg
        width="12"
        height="14"
        viewBox="0 0 12 14"
        fill="currentColor"
        className="opacity-70"
        aria-hidden
      >
        <circle cx="3" cy="2.5" r="1.2" />
        <circle cx="9" cy="2.5" r="1.2" />
        <circle cx="3" cy="7" r="1.2" />
        <circle cx="9" cy="7" r="1.2" />
        <circle cx="3" cy="11.5" r="1.2" />
        <circle cx="9" cy="11.5" r="1.2" />
      </svg>
    </span>
  );
}

function SelectAllCheckbox({
  allSelected,
  someSelected,
  onToggle,
  ariaLabel,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-4 w-4 rounded border-border accent-accent"
      checked={allSelected}
      onChange={onToggle}
      aria-label={ariaLabel}
      title={ariaLabel}
    />
  );
}

function thWrap(
  columnId: EditorInventionColumnId,
  dragOver: boolean,
  dragging: boolean,
  align: 'start' | 'center' | 'end',
  children: ReactNode,
  drag: {
    onDragOver: (e: DragEvent, id: EditorInventionColumnId) => void;
    onDrop: (e: DragEvent, id: EditorInventionColumnId) => void;
    onDragEnter: (id: EditorInventionColumnId) => void;
    onDragLeave: (e: DragEvent) => void;
  },
  stickyTrailing = false,
  stickyLeading = false
) {
  const base = EDITOR_INVENTION_COLUMN_TH_CLASS[columnId];
  const ring =
    dragOver && !dragging
      ? ' ring-2 ring-accent/60 ring-inset'
      : dragging
        ? ' opacity-60'
        : '';
  const stickyLeadingCls = stickyLeading
    ? ' sticky left-0 z-30 border-r border-border bg-surface-elevated shadow-[8px_0_14px_-6px_rgba(0,0,0,0.35)] dark:shadow-[8px_0_14px_-6px_rgba(0,0,0,0.55)]'
    : '';
  const stickyTrailingCls = stickyTrailing
    ? ' sticky right-0 z-30 border-l border-border bg-surface-elevated shadow-[-8px_0_14px_-6px_rgba(0,0,0,0.35)] dark:shadow-[-8px_0_14px_-6px_rgba(0,0,0,0.55)]'
    : '';
  const justify =
    align === 'end'
      ? 'justify-end'
      : align === 'center'
        ? 'justify-center'
        : 'justify-start';
  return (
    <th
      className={`${base}${ring}${stickyLeadingCls}${stickyTrailingCls}`}
      onDragOver={(e) => drag.onDragOver(e, columnId)}
      onDrop={(e) => drag.onDrop(e, columnId)}
      onDragEnter={() => drag.onDragEnter(columnId)}
      onDragLeave={drag.onDragLeave}
    >
      <div className={`flex items-center gap-1.5 ${justify}`}>{children}</div>
    </th>
  );
}

export function renderEditorInventionColumnHeader({
  columnId,
  te,
  sortKey,
  sortDir,
  toggleSort,
  dragHandle,
  dragOverColumnId,
  draggingColumnId,
  drag,
  stickyActionsColumn,
  stickySelectColumn,
  selectColumnHeader,
}: {
  columnId: EditorInventionColumnId;
  te: (key: string, values?: TranslationValues) => string;
  sortKey: NodeSortKey;
  sortDir: SortDir;
  toggleSort: (k: NodeSortKey) => void;
  dragHandle: ReactNode;
  dragOverColumnId: EditorInventionColumnId | null;
  draggingColumnId: EditorInventionColumnId | null;
  stickyActionsColumn: boolean;
  stickySelectColumn: boolean;
  selectColumnHeader: {
    allVisibleSelected: boolean;
    someVisibleSelected: boolean;
    onToggleAllVisible: () => void;
  } | null;
  drag: {
    onDragOver: (e: DragEvent, id: EditorInventionColumnId) => void;
    onDrop: (e: DragEvent, id: EditorInventionColumnId) => void;
    onDragEnter: (id: EditorInventionColumnId) => void;
    onDragLeave: (e: DragEvent) => void;
  };
}): ReactNode {
  const dragOver = dragOverColumnId === columnId;
  const dragging = draggingColumnId === columnId;

  const sortArrow = (k: NodeSortKey) =>
    sortKey === k ? (sortDir === 'asc' ? '↑' : '↓') : '';

  switch (columnId) {
    case 'select':
      return thWrap(columnId, dragOver, dragging, 'center', [
        dragHandle,
        selectColumnHeader ? (
          <SelectAllCheckbox
            key="cb"
            allSelected={selectColumnHeader.allVisibleSelected}
            someSelected={selectColumnHeader.someVisibleSelected}
            onToggle={selectColumnHeader.onToggleAllVisible}
            ariaLabel={te('columnSelectAllAria')}
          />
        ) : (
          <span key="e" className="text-[10px] text-muted-foreground">
            —
          </span>
        ),
      ], drag, false, stickySelectColumn);
    case 'image':
      return thWrap(columnId, dragOver, dragging, 'center', [
        dragHandle,
        <span key="l" className="min-w-0 flex-1 text-center">
          {te('imageColumn')}
        </span>,
      ], drag, false);
    case 'name':
      return thWrap(columnId, dragOver, dragging, 'start', [
        dragHandle,
        <button
          key="b"
          type="button"
          className="inline-flex min-w-0 flex-1 items-center gap-1 text-start"
          onClick={() => toggleSort('name')}
        >
          {te('name')} {sortArrow('name')}
        </button>,
      ], drag, false);
    case 'upstream':
      return thWrap(columnId, dragOver, dragging, 'center', [
        dragHandle,
        <button
          key="b"
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-1"
          onClick={() => toggleSort('upstream_in')}
        >
          {te('columnDepth')} {sortArrow('upstream_in')}
        </button>,
      ], drag, false);
    case 'category':
      return thWrap(columnId, dragOver, dragging, 'start', [
        dragHandle,
        <button
          key="b"
          type="button"
          className="inline-flex flex-1 items-center gap-1"
          onClick={() => toggleSort('category')}
        >
          {te('category')} {sortArrow('category')}
        </button>,
      ], drag, false);
    case 'dimension':
      return thWrap(columnId, dragOver, dragging, 'start', [
        dragHandle,
        <button
          key="b"
          type="button"
          className="inline-flex flex-1 items-center gap-1"
          onClick={() => toggleSort('dimension')}
        >
          {te('columnDimension')} {sortArrow('dimension')}
        </button>,
      ], drag, false);
    case 'materialLevel':
      return thWrap(columnId, dragOver, dragging, 'start', [
        dragHandle,
        <button
          key="b"
          type="button"
          className="inline-flex flex-1 items-center gap-1"
          onClick={() => toggleSort('materialLevel')}
        >
          {te('columnLevel')} {sortArrow('materialLevel')}
        </button>,
      ], drag, false);
    case 'era':
      return thWrap(columnId, dragOver, dragging, 'start', [
        dragHandle,
        <button
          key="b"
          type="button"
          className="inline-flex flex-1 items-center gap-1"
          onClick={() => toggleSort('era')}
        >
          {te('era')} {sortArrow('era')}
        </button>,
      ], drag, false);
    case 'date':
      return thWrap(columnId, dragOver, dragging, 'start', [
        dragHandle,
        <button
          key="b"
          type="button"
          className="inline-flex flex-1 items-center gap-1"
          onClick={() => toggleSort('year_approx')}
        >
          {te('date')} {sortArrow('year_approx')}
        </button>,
      ], drag, false);
    case 'origin':
      return thWrap(columnId, dragOver, dragging, 'start', [
        dragHandle,
        <button
          key="b"
          type="button"
          className="inline-flex flex-1 items-center gap-1"
          onClick={() => toggleSort('origin')}
        >
          {te('origin')} {sortArrow('origin')}
        </button>,
      ], drag, false);
    case 'naturalOrigins':
      return thWrap(columnId, dragOver, dragging, 'start', [
        dragHandle,
        <span key="l" className="min-w-0 flex-1 leading-tight">
          {te('columnNaturalOrigins')}
        </span>,
      ], drag, false);
    case 'chemicalNature':
      return thWrap(columnId, dragOver, dragging, 'start', [
        dragHandle,
        <span key="l" className="min-w-0 flex-1 leading-tight">
          {te('columnChemicalNature')}
        </span>,
      ], drag, false);
    case 'links':
      return thWrap(columnId, dragOver, dragging, 'center', [
        dragHandle,
        <button
          key="b"
          type="button"
          className="inline-flex flex-1 items-center justify-center gap-1"
          onClick={() => toggleSort('links')}
        >
          {te('links')} {sortArrow('links')}
        </button>,
      ], drag, false);
    case 'actions':
      return thWrap(columnId, dragOver, dragging, 'end', [
        dragHandle,
        <span key="l">{te('actionsColumn')}</span>,
      ], drag, stickyActionsColumn);
    default:
      return null;
  }
}

function linkCounts(
  nodeId: string,
  links: CraftingLink[]
): { in: number; out: number } {
  let inc = 0;
  let out = 0;
  for (const l of links) {
    if (l.target_id === nodeId) inc += 1;
    if (l.source_id === nodeId) out += 1;
  }
  return { in: inc, out: out };
}

export function renderEditorInventionColumnCell({
  columnId,
  n,
  graphModelEdges,
  imageBustByNodeId,
  locale,
  te,
  tCat,
  tExplore,
  tc,
  openEdit,
  publishDraftFromRow,
  setDeleteTarget,
  draftPublishingId,
  stickyActionsColumn,
  rowStripeClass,
  duplicatePeerId = null,
  onCompareDuplicates,
  selectedIds,
  onToggleRowSelect,
  stickySelectColumn,
  onToggleNodeLock,
  toggleLockBusyId,
  onAiReviewToast,
}: {
  columnId: EditorInventionColumnId;
  n: SeedNode;
  graphModelEdges: CraftingLink[];
  imageBustByNodeId: Record<string, number>;
  locale: string;
  te: (key: string, values?: TranslationValues) => string;
  tCat: IntlTranslator;
  tExplore: (key: string, values?: TranslationValues) => string;
  tc: (key: string) => string;
  openEdit: (n: SeedNode) => void;
  publishDraftFromRow: (n: SeedNode) => void | Promise<void>;
  setDeleteTarget: (n: SeedNode) => void;
  draftPublishingId: string | null;
  stickyActionsColumn: boolean;
  stickySelectColumn: boolean;
  rowStripeClass: string;
  duplicatePeerId?: string | null;
  onCompareDuplicates?: (n: SeedNode) => void;
  selectedIds: Set<string>;
  onToggleRowSelect: (id: string) => void;
  onToggleNodeLock: (n: SeedNode) => void;
  toggleLockBusyId: string | null;
  onAiReviewToast?: (message: string, kind: 'ok' | 'err') => void;
}): ReactNode {
  const lc = linkCounts(n.id, graphModelEdges);
  const displayName = pickNodeDisplayName(locale, n.name, n.name_en);
  const locked = seedNodeIsLocked(n);

  switch (columnId) {
    case 'select': {
      const stickyCls = stickySelectColumn
        ? `sticky left-0 z-20 border-r border-border ${rowStripeClass}`
        : '';
      return (
        <td
          key={columnId}
          className={`w-10 px-1 py-2 align-middle${stickyCls ? ` ${stickyCls}` : ''}`}
        >
          <div className="flex justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border accent-accent"
              checked={selectedIds.has(n.id)}
              onChange={() => onToggleRowSelect(n.id)}
              aria-label={te('rowSelectAria')}
              title={te('rowSelectAria')}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </td>
      );
    }
    case 'image':
      return (
        <td
          key={columnId}
          className="w-12 px-1 py-2 align-middle"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center">
            {n.image_url?.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={
                  (imageBustByNodeId[n.id] ?? 0) > 0
                    ? `${n.image_url}${n.image_url.includes('?') ? '&' : '?'}t=${imageBustByNodeId[n.id]}`
                    : n.image_url
                }
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-md object-cover"
              />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
                style={{
                  backgroundColor: getCategoryColor(n.category as NodeCategory),
                }}
                aria-hidden
              >
                {displayName.trim().charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>
        </td>
      );
    case 'name':
      return (
        <td key={columnId} className="px-3 py-2 font-bold text-foreground">
          <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1">
            <Link
              href={treeInventionPath(n.id)}
              className="min-w-0 truncate text-foreground underline-offset-2 hover:text-accent hover:underline"
            >
              {displayName}
            </Link>
            <BuiltUponBadgePopover
              count={lc.in}
              borderColor={getCategoryColor(n.category as NodeCategory)}
            />
            {n.is_draft ? (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-orange-500"
                title={te('draftRowIndicator')}
                aria-label={te('draftRowIndicator')}
              />
            ) : null}
            {locked ? (
              <span
                className="inline-flex shrink-0 text-amber-400/95"
                title={te('rowLockedBadge')}
                aria-label={te('rowLockedBadge')}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
            ) : null}
          </span>
        </td>
      );
    case 'upstream':
      return (
        <td
          key={columnId}
          className="px-2 py-2 text-center align-middle text-xs text-muted-foreground"
        >
          —
        </td>
      );
    case 'category':
      return (
        <td key={columnId} className="px-3 py-2">
          <span
            className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs"
            style={{
              borderColor: getCategoryColor(n.category as NodeCategory),
              color: getCategoryColor(n.category as NodeCategory),
            }}
          >
            {safeCategoryLabel(tCat, String(n.category))}
          </span>
        </td>
      );
    case 'dimension':
      return (
        <td key={columnId} className="px-3 py-2 text-muted-foreground">
          {n.dimension
            ? te(EDITOR_DIM_KEY[n.dimension as NodeDimension])
            : '—'}
        </td>
      );
    case 'materialLevel':
      return (
        <td key={columnId} className="px-3 py-2 text-muted-foreground">
          {n.dimension === 'matter' && n.materialLevel
            ? te(EDITOR_LEVEL_KEY[n.materialLevel as MaterialLevel])
            : '—'}
        </td>
      );
    case 'era':
      return (
        <td key={columnId} className="px-3 py-2 text-muted-foreground">
          {eraLabelFromMessages(locale, n.era as Era)}
        </td>
      );
    case 'date':
      return (
        <td key={columnId} className="px-3 py-2">
          {n.year_approx === null || n.year_approx === undefined
            ? '—'
            : String(n.year_approx)}
        </td>
      );
    case 'origin':
      return (
        <td
          key={columnId}
          className="max-w-[150px] truncate px-3 py-2 text-muted-foreground"
        >
          {n.origin?.trim() ? n.origin : '—'}
        </td>
      );
    case 'naturalOrigins':
      return (
        <td
          key={columnId}
          className="max-w-[120px] truncate px-3 py-2 text-muted-foreground"
        >
          {naturalOriginTableLabel(n, tExplore)}
        </td>
      );
    case 'chemicalNature':
      return (
        <td
          key={columnId}
          className="max-w-[120px] truncate px-3 py-2 text-muted-foreground"
        >
          {chemicalNatureTableLabel(n, tExplore)}
        </td>
      );
    case 'links':
      return (
        <td
          key={columnId}
          className="px-3 py-2 text-center font-mono text-xs text-muted-foreground"
        >
          ↓{lc.in} ↑{lc.out}
        </td>
      );
    case 'actions': {
      const stickyCls = stickyActionsColumn
        ? `sticky right-0 z-20 border-l border-border shadow-[-8px_0_14px_-6px_rgba(0,0,0,0.35)] dark:shadow-[-8px_0_14px_-6px_rgba(0,0,0,0.55)] ${rowStripeClass}`
        : '';
      return (
        <td
          key={columnId}
          className={`px-3 py-2${stickyCls ? ` ${stickyCls}` : ''}`}
        >
          <div className="flex flex-wrap items-center justify-end gap-0.5">
            <button
              type="button"
              disabled={toggleLockBusyId === n.id}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${
                locked
                  ? 'border-amber-500/55 text-amber-300 hover:bg-amber-500/15 focus-visible:ring-amber-500/40'
                  : 'border-border/60 text-muted-foreground hover:bg-border/40 hover:text-foreground focus-visible:ring-accent/50'
              }`}
              title={locked ? te('rowActionUnlock') : te('rowActionLock')}
              aria-label={locked ? te('rowActionUnlock') : te('rowActionLock')}
              onClick={() => onToggleNodeLock(n)}
            >
              {locked ? (
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
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                </svg>
              ) : (
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
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              )}
            </button>
            {rowIsDraft(n as unknown as Record<string, unknown>) ? (
              <button
                type="button"
                disabled={locked || draftPublishingId === n.id}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-transparent text-emerald-500 transition-colors hover:bg-emerald-500/15 hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                title={te('rowActionPublishDraft')}
                aria-label={te('rowActionPublishDraft')}
                onClick={() => void publishDraftFromRow(n)}
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
                  <path d="M9 12.75L11.25 15L15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </button>
            ) : null}
            {onAiReviewToast ? (
              <AIReviewButton
                inventionId={n.id}
                disabled={locked}
                onResult={onAiReviewToast}
              />
            ) : null}
            <button
              type="button"
              disabled={locked}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-transparent text-muted-foreground transition-colors hover:bg-border/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={te('panelEditInvention')}
              title={te('panelEditInvention')}
              onClick={() => openEdit(n)}
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
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            {duplicatePeerId && onCompareDuplicates ? (
              <button
                type="button"
                disabled={locked}
                className="inline-flex h-8 max-w-[9rem] shrink-0 items-center justify-center gap-1 rounded-lg border border-amber-500/50 bg-transparent px-1.5 text-amber-200/90 transition-colors hover:bg-amber-500/15 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={te('rowActionCompareDuplicates')}
                title={te('rowActionCompareDuplicates')}
                onClick={() => onCompareDuplicates(n)}
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
                  className="shrink-0"
                  aria-hidden
                >
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <rect x="4" y="4" width="12" height="12" rx="2" />
                </svg>
                <span className="hidden text-left text-[10px] font-medium leading-tight sm:inline">
                  {te('rowActionCompareDuplicatesLabel')}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              disabled={locked}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-transparent text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label={tc('delete')}
              title={tc('delete')}
              onClick={() => setDeleteTarget(n)}
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
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </button>
          </div>
        </td>
      );
    }
    default:
      return null;
  }
}

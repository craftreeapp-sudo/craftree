'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import {
  CATEGORY_LIST_CARD_LAYOUT_STORAGE_KEY,
  type CategoryListCardLayout,
  isCategoryListCardLayout,
} from '@/components/categories/category-list-card-layout';

const layoutListeners = new Set<() => void>();

function readLayoutFromStorage(): CategoryListCardLayout {
  if (typeof window === 'undefined') return 'balanced';
  try {
    const raw = localStorage.getItem(CATEGORY_LIST_CARD_LAYOUT_STORAGE_KEY);
    if (isCategoryListCardLayout(raw)) return raw;
  } catch {
    /* ignore */
  }
  return 'balanced';
}

function subscribeLayout(onChange: () => void) {
  layoutListeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (
      e.key === CATEGORY_LIST_CARD_LAYOUT_STORAGE_KEY ||
      e.key === null
    ) {
      onChange();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    layoutListeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function notifyLayoutListeners() {
  layoutListeners.forEach((fn) => fn());
}

function persistLayout(next: CategoryListCardLayout) {
  try {
    localStorage.setItem(CATEGORY_LIST_CARD_LAYOUT_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  notifyLayoutListeners();
}

function IconLayoutComfort({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="2" y="3" width="8" height="7" rx="1.2" />
      <rect x="14" y="3" width="8" height="7" rx="1.2" />
      <rect x="2" y="14" width="8" height="7" rx="1.2" />
      <rect x="14" y="14" width="8" height="7" rx="1.2" />
    </svg>
  );
}

function IconLayoutBalanced({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <rect x="1" y="4" width="5" height="6" rx="0.8" />
      <rect x="8" y="4" width="5" height="6" rx="0.8" />
      <rect x="15" y="4" width="5" height="6" rx="0.8" />
      <rect x="1" y="14" width="5" height="6" rx="0.8" />
      <rect x="8" y="14" width="5" height="6" rx="0.8" />
      <rect x="15" y="14" width="5" height="6" rx="0.8" />
    </svg>
  );
}

function IconLayoutDense({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      {[0, 1, 2, 3].flatMap((col) =>
        [0, 1, 2].map((row) => (
          <rect
            key={`${col}-${row}`}
            x={1.5 + col * 5.5}
            y={3 + row * 6}
            width="4.5"
            height="4.5"
            rx="0.6"
          />
        ))
      )}
    </svg>
  );
}

const MODES: {
  id: CategoryListCardLayout;
  Icon: typeof IconLayoutComfort;
}[] = [
  { id: 'comfort', Icon: IconLayoutComfort },
  { id: 'balanced', Icon: IconLayoutBalanced },
  { id: 'dense', Icon: IconLayoutDense },
];

export function useCategoryListCardLayout(): [
  CategoryListCardLayout,
  (next: CategoryListCardLayout) => void,
] {
  const layout = useSyncExternalStore<CategoryListCardLayout>(
    subscribeLayout,
    readLayoutFromStorage,
    () => 'balanced'
  );

  const setLayout = useCallback((next: CategoryListCardLayout) => {
    persistLayout(next);
  }, []);

  return [layout, setLayout];
}

export function CategoryListCardLayoutSwitcher({
  layout,
  onChange,
  compact = false,
}: {
  layout: CategoryListCardLayout;
  onChange: (next: CategoryListCardLayout) => void;
  /** Réduit libellé et boutons (ex. header liste époque en mode compact). */
  compact?: boolean;
}) {
  const tPage = useTranslations('categoriesPage');
  const groupLabel = tPage('cardLayoutLabel');

  return (
    <div
      className={
        compact
          ? 'flex flex-row flex-wrap items-center gap-2'
          : 'flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4'
      }
    >
      <span
        id="category-list-card-layout-label"
        className={compact ? 'sr-only' : 'text-sm text-muted-foreground'}
      >
        {groupLabel}
      </span>
      <div
        role="radiogroup"
        aria-labelledby="category-list-card-layout-label"
        className={`inline-flex gap-0.5 rounded-lg glass-search-field ${
          compact ? 'p-0' : 'p-0.5'
        }`}
      >
        {MODES.map(({ id, Icon }) => {
          const selected = layout === id;
          const title =
            id === 'comfort'
              ? tPage('cardLayoutComfort')
              : id === 'balanced'
                ? tPage('cardLayoutBalanced')
                : tPage('cardLayoutDense');
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={title}
              title={title}
              onClick={() => onChange(id)}
              className={`inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus ${
                compact ? 'h-8 w-8' : 'h-10 w-10'
              } ${
                selected
                  ? 'border border-accent/50 bg-accent/15 text-accent shadow-sm ring-1 ring-accent/30'
                  : 'border border-transparent text-muted-foreground hover:border-border/60 hover:bg-surface hover:text-foreground'
              }`}
            >
              <Icon
                className={`shrink-0 ${compact ? 'h-4 w-4' : 'h-5 w-5'} ${selected ? 'text-accent' : ''}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

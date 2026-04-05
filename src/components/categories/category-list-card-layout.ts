export type CategoryListCardLayout = 'comfort' | 'balanced' | 'dense';

export const CATEGORY_LIST_CARD_LAYOUT_STORAGE_KEY =
  'craftree:categoryListCardLayout';

/** À partir de `lg`, exactement 4, 6 ou 8 cartes par rangée selon le mode. */
export const CATEGORY_LIST_GRID_CLASS: Record<
  CategoryListCardLayout,
  string
> = {
  comfort:
    'grid w-full min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4',
  balanced:
    'grid w-full min-w-0 grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-6',
  dense:
    'grid w-full min-w-0 grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-8',
};

export function isCategoryListCardLayout(
  v: string | null
): v is CategoryListCardLayout {
  return v === 'comfort' || v === 'balanced' || v === 'dense';
}

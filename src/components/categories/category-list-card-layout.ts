export type CategoryListCardLayout = 'comfort' | 'balanced' | 'dense';

/** 6 cartes par rangée à partir de `lg` — valeur par défaut (pages /categories et filtres). */
export const DEFAULT_CATEGORY_LIST_CARD_LAYOUT: CategoryListCardLayout =
  'balanced';

/** v2 : défaut `balanced` (6 cols) sans hériter de l’ancienne clé `craftree:categoryListCardLayout`. */
export const CATEGORY_LIST_CARD_LAYOUT_STORAGE_KEY =
  'craftree:categoryListCardLayout_v2';

/** À partir de `lg` : exactement 4, 6 ou 8 cartes par rangée (pas de colonnes intermédiaires 3/5/7). */
export const CATEGORY_LIST_GRID_CLASS: Record<
  CategoryListCardLayout,
  string
> = {
  comfort:
    'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4',
  balanced:
    'grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-6',
  dense:
    'grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-8',
};

export function isCategoryListCardLayout(
  v: string | null
): v is CategoryListCardLayout {
  return v === 'comfort' || v === 'balanced' || v === 'dense';
}

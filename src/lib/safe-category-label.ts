import type { useTranslations } from 'next-intl';

type Translator = ReturnType<typeof useTranslations>;

/**
 * Avoids next-intl MISSING_MESSAGE when `category` from the graph/API is not a
 * valid `messages.categories` key (e.g. legacy rows or a type slug stored by mistake).
 */
export function safeCategoryLabel(
  tCat: Translator,
  category: string,
  tTypes?: Translator
): string {
  if (tCat.has(category)) return tCat(category);
  if (tTypes?.has(category)) return tTypes(category);
  return category;
}

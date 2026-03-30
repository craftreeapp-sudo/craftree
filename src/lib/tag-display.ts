import tagLabelsEn from '@/data/tag-labels-en.json';

/**
 * Libellé affiché pour un tag d’invention selon la locale.
 * Les traductions anglaises sont dans `src/data/tag-labels-en.json` (généré / éditable).
 */
export function getTagDisplayLabel(locale: string, tag: string): string {
  const t = tag.trim();
  if (!t) return t;
  if (!locale.toLowerCase().startsWith('en')) return t;
  const map = tagLabelsEn as Record<string, string>;
  const en = map[t];
  return typeof en === 'string' && en.length > 0 ? en : t;
}

/**
 * Affichage du nom d’invention selon la locale UI (voir règles i18n Craftree).
 */
export function pickNodeDisplayName(
  locale: string,
  name: string,
  nameEn?: string | null
): string {
  if (locale === 'fr') return name;
  const en = nameEn?.trim();
  if (en) return en;
  return name;
}

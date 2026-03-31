/** UI en français (noms canoniques `name`). */
export function isFrenchLocale(locale: string): boolean {
  return locale === 'fr' || locale.startsWith('fr-');
}

/**
 * Affichage du nom d’invention selon la locale UI (voir règles i18n Craftree).
 */
export function pickNodeDisplayName(
  locale: string,
  name: string,
  nameEn?: string | null
): string {
  if (isFrenchLocale(locale)) return name;
  const en = nameEn?.trim();
  if (en) return en;
  return name;
}

/**
 * Description pour formulaires / suggestions : FR = champ principal, sinon EN puis repli FR.
 */
export function pickNodeDescriptionForLocale(
  locale: string,
  descriptionFr: string | undefined | null,
  descriptionEn?: string | null
): string {
  if (isFrenchLocale(locale)) return (descriptionFr ?? '').trim();
  const en = descriptionEn?.trim();
  if (en) return en;
  return (descriptionFr ?? '').trim();
}

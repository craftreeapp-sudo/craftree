export const locales = ['fr', 'en', 'es', 'zh', 'hi', 'ar'] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = 'fr';

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return Boolean(value && (locales as readonly string[]).includes(value));
}

export function isRtlLocale(locale: string): boolean {
  return locale === 'ar';
}

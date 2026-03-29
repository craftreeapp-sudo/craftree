import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import {
  defaultLocale,
  isAppLocale,
  type AppLocale,
} from '@/lib/i18n-config';

export default getRequestConfig(async () => {
  const store = await cookies();
  const fromCookie = store.get('locale')?.value;
  const locale: AppLocale = isAppLocale(fromCookie) ? fromCookie : defaultLocale;
  /** Hors FR : libellés UI en anglais (recherche, menus, etc.) tout en conservant la locale pour RTL et le sélecteur. */
  const messageLocale = locale === 'fr' ? 'fr' : 'en';

  return {
    locale,
    messages: (await import(`../messages/${messageLocale}.json`)).default,
  };
});

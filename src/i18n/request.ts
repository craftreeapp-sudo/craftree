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

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

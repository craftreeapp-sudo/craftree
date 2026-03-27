'use client';

import { useEffect } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useToastStore } from '@/stores/toast-store';

/**
 * Affiche un toast si l’URL contient `auth_error` (échec OAuth renvoyé depuis /auth/callback).
 */
export function AuthUrlErrorToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const pushToast = useToastStore((s) => s.pushToast);
  const t = useTranslations('auth');

  useEffect(() => {
    const err = searchParams.get('auth_error');
    if (!err) return;
    const dedupeKey = `auth_err_toast:${err}`;
    if (typeof window !== 'undefined' && sessionStorage.getItem(dedupeKey)) {
      return;
    }
    if (typeof window !== 'undefined') sessionStorage.setItem(dedupeKey, '1');
    pushToast(t('oauthSignInFailed'), 'error');
    const next = new URLSearchParams(searchParams.toString());
    next.delete('auth_error');
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }, [searchParams, pathname, router, pushToast, t]);

  return null;
}

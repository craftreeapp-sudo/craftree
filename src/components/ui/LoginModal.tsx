'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { useToastStore } from '@/stores/toast-store';
import { signInWithGoogle } from '@/lib/auth-client';

export function LoginModal() {
  const open = useUIStore((s) => s.loginModalOpen);
  const setOpen = useUIStore((s) => s.setLoginModalOpen);
  const pushToast = useToastStore((s) => s.pushToast);
  const t = useTranslations('auth');

  const onClose = useCallback(() => setOpen(false), [setOpen]);

  const onGoogle = useCallback(async () => {
    const { error, code } = await signInWithGoogle();
    if (!error) return;
    if (code === 'missing_config') {
      pushToast(t('oauthConfigMissing'), 'error');
      return;
    }
    if (code === 'no_oauth_url') {
      pushToast(t('oauthNoUrl'), 'error');
      return;
    }
    pushToast(error.message || t('oauthSignInFailed'), 'error');
  }, [pushToast, t]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        aria-label={t('closeModal')}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[360px] rounded-[12px] glass-surface p-6"
      >
        <h2
          id="login-modal-title"
          className="text-center text-lg font-semibold text-foreground"
        >
          {t('loginModalTitle')}
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t('loginModalSubtitle')}
        </p>
        <button
          type="button"
          onClick={onGoogle}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition-opacity hover:opacity-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {t('signInWithGoogle')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

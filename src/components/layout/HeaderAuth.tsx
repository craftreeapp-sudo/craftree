'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { signInWithGoogle, signOut } from '@/lib/auth-client';

export function HeaderAuth() {
  const t = useTranslations('auth');
  const pushToast = useToastStore((s) => s.pushToast);
  const { user, isLoading } = useAuthStore();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const onSignIn = useCallback(async () => {
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

  const onSignOut = useCallback(() => {
    setOpen(false);
    void signOut();
  }, []);

  if (isLoading) {
    return (
      <div
        className="h-[32px] w-[72px] shrink-0 rounded-md border border-border/50 bg-transparent"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="shrink-0 border border-border bg-transparent px-[14px] py-[6px] text-[13px] text-muted-foreground transition-colors hover:border-accent"
        style={{ borderRadius: 6 }}
      >
        {t('signIn')}
      </button>
    );
  }

  const avatar =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    null;
  const label = user.email ?? user.id;

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-elevated transition-colors hover:border-accent"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('accountMenu')}
      >
        {avatar ? (
          <Image
            src={avatar}
            alt=""
            width={24}
            height={24}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <span className="text-[10px] font-bold text-muted-foreground">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-[150] min-w-[160px] rounded-md border border-border bg-surface-elevated py-1 shadow-lg"
          role="menu"
        >
          <div className="truncate px-3 py-2 text-[11px] text-muted-foreground">
            {label}
          </div>
          <Link
            href="/profile"
            className="block px-3 py-2 text-[13px] text-foreground hover:bg-surface"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            {t('myProfile')}
          </Link>
          <button
            type="button"
            className="w-full px-3 py-2 text-start text-[13px] text-foreground hover:bg-surface"
            role="menuitem"
            onClick={onSignOut}
          >
            {t('signOut')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

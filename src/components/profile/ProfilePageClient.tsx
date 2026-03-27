'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { getCategoryColor } from '@/lib/colors';
import type { NodeCategory } from '@/lib/types';
import { signOut } from '@/lib/auth-client';
import { useToastStore } from '@/stores/toast-store';

type ProfilePayload = {
  profile: {
    id: string;
    email: string | null;
    display_name: string | null;
    avatar_url: string | null;
    contributions_count: number;
    created_at: string;
  };
  stats: {
    approved: number;
    pending: number;
    rejected: number;
    inventions_created: number;
  };
  suggestions: Array<{
    id: string;
    suggestion_type: string;
    status: string;
    created_at: string;
    summary: string;
  }>;
  inventedNodes: Array<{ id: string; name: string; category: string }>;
  favoriteCategories: Array<{ category: string; count: number; color: string }>;
  isAdmin: boolean;
};

function ProfileBackLink() {
  const t = useTranslations('profile');
  return (
    <Link
      href="/explore"
      className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-accent"
    >
      <svg
        className="size-4 shrink-0 rtl:rotate-180"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {t('backToTree')}
    </Link>
  );
}

function formatRelativeShort(iso: string, locale: string): string {
  const d = new Date(iso);
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(diffSec) < 45) return rtf.format(0, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
  const diffHours = Math.round(diffMin / 60);
  if (Math.abs(diffHours) < 24) return rtf.format(-diffHours, 'hour');
  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) return rtf.format(-diffDays, 'day');
  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) return rtf.format(-diffMonths, 'month');
  const diffYears = Math.round(diffDays / 365);
  return rtf.format(-diffYears, 'year');
}

function levelProgress(count: number): {
  labelKey: 'apprenti' | 'artisan' | 'maitre' | 'architecte';
  nextLabelKey: 'artisan' | 'maitre' | 'architecte' | null;
  remaining: number;
  progressPct: number;
} {
  if (count >= 100) {
    return {
      labelKey: 'architecte',
      nextLabelKey: null,
      remaining: 0,
      progressPct: 100,
    };
  }
  if (count >= 50) {
    return {
      labelKey: 'maitre',
      nextLabelKey: 'architecte',
      remaining: 100 - count,
      progressPct: ((count - 50) / 50) * 100,
    };
  }
  if (count >= 10) {
    return {
      labelKey: 'artisan',
      nextLabelKey: 'maitre',
      remaining: 50 - count,
      progressPct: ((count - 10) / 40) * 100,
    };
  }
  return {
    labelKey: 'apprenti',
    nextLabelKey: 'artisan',
    remaining: 10 - count,
    progressPct: (count / 10) * 100,
  };
}

export function ProfilePageClient() {
  const t = useTranslations('profile');
  const tCat = useTranslations('categories');
  const locale = useLocale();
  const router = useRouter();
  const pushToast = useToastStore((s) => s.pushToast);

  const [data, setData] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile');
      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/explore');
          return;
        }
        throw new Error('load failed');
      }
      const json = (await res.json()) as ProfilePayload;
      setData(json);
      setEditName(json.profile.display_name ?? '');
    } catch {
      setError(t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const memberSince = useMemo(() => {
    if (!data?.profile.created_at) return '';
    try {
      return new Intl.DateTimeFormat(locale, {
        month: 'long',
        year: 'numeric',
      }).format(new Date(data.profile.created_at));
    } catch {
      return '';
    }
  }, [data, locale]);

  const level = useMemo(
    () =>
      data ? levelProgress(data.profile.contributions_count) : null,
    [data]
  );

  const onSaveDisplayName = useCallback(async () => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: trimmed }),
      });
      if (!res.ok) {
        pushToast(t('saveError'), 'error');
        return;
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              profile: { ...prev.profile, display_name: trimmed },
            }
          : null
      );
      setEditing(false);
      pushToast(t('saveOk'), 'success');
    } finally {
      setSaving(false);
    }
  }, [editName, pushToast, t]);

  const onSignOut = useCallback(async () => {
    await signOut();
    router.replace('/explore');
  }, [router]);

  const displayName =
    data?.profile.display_name ??
    data?.profile.email?.split('@')[0] ??
    '—';

  const initials = useMemo(() => {
    const s = displayName.trim();
    if (!s) return '?';
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    }
    return s.slice(0, 2).toUpperCase();
  }, [displayName]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[720px] bg-page px-8 pb-24 pt-28 text-center text-base text-muted-foreground">
        {t('loading')}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-[720px] bg-page px-8 pb-24 pt-28 text-center text-base text-[#EF4444]">
        {error ?? t('loadError')}
      </div>
    );
  }

  const { profile, stats, suggestions, inventedNodes, favoriteCategories, isAdmin } =
    data;
  const avatarUrl = profile.avatar_url?.trim() || null;

  return (
    <div className="mx-auto max-w-[720px] bg-page px-8 pb-24 pt-28 sm:px-10">
      <ProfileBackLink />
      <header className="mx-auto mb-10 max-w-[720px]">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-center sm:gap-8">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-surface-elevated">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt=""
                width={80}
                height={80}
                className="h-full w-full object-cover"
                unoptimized={
                  avatarUrl.startsWith('http://localhost') ||
                  avatarUrl.startsWith('https://lh3.googleusercontent.com')
                }
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-accent text-[28px] font-bold text-white">
                {initials}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-start">
            <p
              className="text-[26px] font-bold leading-tight text-foreground sm:text-[28px]"
              style={{ fontFamily: 'var(--font-inter), Inter, sans-serif' }}
            >
              {displayName}
            </p>
            <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
              {t('memberSince', { date: memberSince })}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
              {isAdmin ? (
                <span
                  className="inline-block rounded-md px-3 py-1.5 text-[12px] font-semibold leading-none"
                  style={{
                    backgroundColor: '#F59E0B22',
                    color: '#F59E0B',
                  }}
                >
                  {t('badgeFounder')}
                </span>
              ) : null}
              <span
                className="inline-block rounded-md px-3 py-1.5 text-[12px] font-semibold leading-none"
                style={{
                  backgroundColor: '#0F6E5622',
                  color: '#5DCAA5',
                }}
              >
                {t('badgeContributions', {
                  n: profile.contributions_count,
                })}
              </span>
              {profile.contributions_count >= 10 ? (
                <span
                  className="inline-block rounded-md px-3 py-1.5 text-[12px] font-semibold leading-none"
                  style={{
                    backgroundColor: '#3B82F622',
                    color: '#3B82F6',
                  }}
                >
                  {t('badgeVerified')}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="mb-10 md:mb-12">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {(
            [
              ['approved', stats.approved],
              ['pending', stats.pending],
              ['rejected', stats.rejected],
              ['inventions', stats.inventions_created],
            ] as const
          ).map(([key, n]) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-surface px-4 py-5 text-center shadow-sm"
            >
              <p className="text-[30px] font-medium tabular-nums leading-none text-foreground sm:text-[32px]">
                {n}
              </p>
              <p className="mt-3 text-[13px] leading-tight text-muted-foreground">
                {t(`stat_${key}`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {level ? (
        <section className="mb-10 md:mb-12">
          <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between">
            <span className="text-[16px] font-bold text-foreground">
              {t(`level_${level.labelKey}`)}
            </span>
            {level.nextLabelKey ? (
              <span className="text-[13px] text-muted-foreground sm:text-right">
                {t('levelProgress', {
                  n: level.remaining,
                  next: t(`level_${level.nextLabelKey}`),
                })}
              </span>
            ) : (
              <span className="text-[13px] text-muted-foreground">
                {t('levelMax')}
              </span>
            )}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, level.progressPct))}%`,
              }}
            />
          </div>
        </section>
      ) : null}

      <section className="mb-10 md:mb-12">
        <h2 className="mb-4 border-b border-border-subtle pb-3 text-[18px] font-semibold text-foreground">
          {t('recentSuggestions')}
        </h2>
        <ul className="space-y-2">
          {suggestions.length === 0 ? (
            <li className="text-[15px] italic leading-relaxed text-muted-foreground">
              {t('noSuggestions')}
            </li>
          ) : (
            suggestions.map((s) => (
              <li
                key={s.id}
                className="flex items-start gap-4 rounded-lg border border-border bg-surface px-4 py-4"
              >
                <span
                  className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      s.status === 'approved'
                        ? '#22C55E'
                        : s.status === 'pending'
                          ? '#F59E0B'
                          : '#EF4444',
                  }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold leading-snug text-foreground">
                    {s.summary}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {formatRelativeShort(s.created_at, locale)}
                  </p>
                </div>
                <span
                  className="shrink-0 self-center rounded-md px-2.5 py-1 text-[12px] font-semibold"
                  style={
                    s.status === 'approved'
                      ? { backgroundColor: '#22C55E22', color: '#22C55E' }
                      : s.status === 'pending'
                        ? { backgroundColor: '#F59E0B22', color: '#F59E0B' }
                        : { backgroundColor: '#EF444422', color: '#EF4444' }
                  }
                >
                  {t(`status_${s.status}`)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mb-10 md:mb-12">
        <h2 className="mb-4 border-b border-border-subtle pb-3 text-[18px] font-semibold text-foreground">
          {t('myInventions')}
        </h2>
        {inventedNodes.length === 0 ? (
          <p className="text-[15px] italic leading-relaxed text-muted-foreground">
            {t('noInventions')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {inventedNodes.map((n) => (
              <Link
                key={n.id}
                href={`/explore?node=${encodeURIComponent(n.id)}`}
                className="inline-flex min-h-[44px] items-center gap-2.5 rounded-lg border border-border bg-surface px-4 py-2.5 text-[14px] font-medium text-foreground/85 transition-colors hover:border-accent"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: getCategoryColor(n.category as NodeCategory),
                  }}
                  aria-hidden
                />
                {n.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mb-10 md:mb-12">
        <h2 className="mb-4 border-b border-border-subtle pb-3 text-[18px] font-semibold text-foreground">
          {t('favoriteCategories')}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          {favoriteCategories.length === 0 ? (
            <p className="text-[15px] italic leading-relaxed text-muted-foreground">
              {t('noCategories')}
            </p>
          ) : (
            favoriteCategories.map((c) => (
              <div
                key={c.category}
                className="rounded-lg border border-border bg-surface px-4 py-5 text-center"
              >
                <p
                  className="text-[18px] font-medium leading-tight"
                  style={{ color: c.color }}
                >
                  {tCat(c.category as NodeCategory)}
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {t('categoryContributions', { n: c.count })}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
        {editing ? (
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-border bg-surface px-4 py-3 text-[15px] text-foreground outline-none focus:border-accent"
              maxLength={120}
              aria-label={t('displayNameLabel')}
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void onSaveDisplayName()}
              className="min-h-[44px] shrink-0 rounded-lg border border-accent px-5 py-3 text-[14px] font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
            >
              {t('save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditName(profile.display_name ?? '');
              }}
              className="min-h-[44px] shrink-0 rounded-lg border border-border px-5 py-3 text-[14px] text-muted-foreground"
            >
              {t('cancelEdit')}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-[44px] rounded-lg border border-border px-5 py-3 text-[14px] font-medium text-muted-foreground transition-colors hover:border-accent"
            >
              {t('editProfile')}
            </button>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="min-h-[44px] rounded-lg border border-border px-5 py-3 text-[14px] font-medium text-muted-foreground transition-colors hover:border-accent"
            >
              {t('signOut')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';

type SuggestionRow = {
  id: string;
  user_id: string | null;
  suggestion_type: string;
  status: string;
  node_id: string | null;
  data: Record<string, unknown>;
  admin_comment: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type ProfileLite = {
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  contributions_count: number;
};

function formatRelativeFr(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days}j`;
  return d.toLocaleDateString('fr-FR');
}

export function AdminPageClient() {
  const router = useRouter();
  const t = useTranslations('admin');
  const tAuth = useTranslations('auth');
  const pushToast = useToastStore((s) => s.pushToast);
  const { isAdmin, isLoading } = useAuthStore();

  const [tab, setTab] = useState<'pending' | 'history' | 'contributors'>(
    'pending'
  );
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [contributorList, setContributorList] = useState<
    {
      id: string;
      email: string | null;
      display_name: string | null;
      avatar_url: string | null;
      contributions_count: number;
      created_at: string;
    }[]
  >([]);
  const [editOverride, setEditOverride] = useState<{
    id: string;
    json: string;
  } | null>(null);

  const loadSuggestions = useCallback(
    async (status: 'pending' | 'history') => {
      setLoading(true);
      try {
        const q = status === 'pending' ? 'pending' : 'history';
        const res = await fetch(`/api/admin/suggestions?status=${q}`);
        if (!res.ok) {
          pushToast('Erreur chargement', 'error');
          return;
        }
        const j = (await res.json()) as {
          suggestions: SuggestionRow[];
          profiles: Record<string, ProfileLite>;
        };
        setSuggestions(j.suggestions ?? []);
        setProfiles(j.profiles ?? {});
      } finally {
        setLoading(false);
      }
    },
    [pushToast, tAuth]
  );

  const loadContributors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/profiles');
      if (!res.ok) return;
      const j = (await res.json()) as {
        profiles: {
          id: string;
          email: string | null;
          display_name: string | null;
          avatar_url: string | null;
          contributions_count: number;
          created_at: string;
        }[];
      };
      setContributorList(j.profiles ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAdmin) {
      router.replace('/explore');
      return;
    }
    if (tab === 'contributors') void loadContributors();
    else void loadSuggestions(tab);
  }, [isAdmin, isLoading, tab, router, loadSuggestions, loadContributors]);

  const pendingCount = useMemo(() => {
    if (tab !== 'pending') return 0;
    return suggestions.length;
  }, [suggestions, tab]);

  const approve = async (id: string, overrideProposed?: Record<string, unknown>) => {
    const res = await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, overrideProposed }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      pushToast(String(e?.error ?? 'Erreur'), 'error');
      return;
    }
    pushToast(t('toastApproved'), 'success');
    setEditOverride(null);
    if (tab === 'contributors') void loadContributors();
    else void loadSuggestions(tab);
  };

  const reject = async (id: string) => {
    const res = await fetch('/api/admin/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      pushToast('Erreur', 'error');
      return;
    }
    pushToast(t('toastRejected'), 'success');
    if (tab === 'contributors') void loadContributors();
    else void loadSuggestions(tab);
  };

  const openEditApprove = (s: SuggestionRow) => {
    const data = s.data as { proposed?: Record<string, unknown> };
    setEditOverride({
      id: s.id,
      json: JSON.stringify(data.proposed ?? {}, null, 2),
    });
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-[#0A0E17] text-[#8B95A8]">
        …
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-[#E8ECF4]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#2A3042] px-4 py-4 md:px-8">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <Link
          href="/explore"
          className="text-sm text-[#3B82F6] hover:underline"
        >
          {t('backToTree')}
        </Link>
      </header>

      <div className="border-b border-[#2A3042] px-4 md:px-8">
        <div className="flex flex-wrap gap-2 py-3">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              tab === 'pending'
                ? 'bg-[#1A1F2E] text-white'
                : 'text-[#8B95A8] hover:text-[#E8ECF4]'
            }`}
          >
            {t('tabPending')}
            {tab === 'pending' && pendingCount > 0 ? (
              <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                {pendingCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              tab === 'history'
                ? 'bg-[#1A1F2E] text-white'
                : 'text-[#8B95A8] hover:text-[#E8ECF4]'
            }`}
          >
            {t('tabHistory')}
          </button>
          <button
            type="button"
            onClick={() => setTab('contributors')}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              tab === 'contributors'
                ? 'bg-[#1A1F2E] text-white'
                : 'text-[#8B95A8] hover:text-[#E8ECF4]'
            }`}
          >
            {t('tabContributors')}
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6 md:px-8">
        {loading ? (
          <p className="text-[#8B95A8]">…</p>
        ) : tab === 'contributors' ? (
          <ul className="space-y-2">
            {contributorList.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-[#2A3042] bg-[#1A1F2E] px-4 py-3"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#2A3042] bg-[#111827]">
                  {p.avatar_url ? (
                    <Image
                      src={p.avatar_url}
                      alt=""
                      width={40}
                      height={40}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-[#8B95A8]">
                      {(p.display_name ?? p.email ?? '?').slice(0, 1)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {p.display_name ?? p.email ?? p.id}
                  </p>
                  <p className="truncate text-xs text-[#8B95A8]">{p.email}</p>
                </div>
                <span className="text-sm text-[#8B95A8]">
                  {p.contributions_count} {t('contributions')}
                </span>
              </li>
            ))}
          </ul>
        ) : suggestions.length === 0 ? (
          <p className="text-[#8B95A8]">{t('noSuggestions')}</p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-[#2A3042] bg-[#1A1F2E] p-4"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <TypeBadge type={s.suggestion_type} />
                  <span className="text-xs text-[#8B95A8]">
                    {formatRelativeFr(s.created_at)}
                  </span>
                </div>
                <ContributorLine
                  userId={s.user_id}
                  profiles={profiles}
                />
                <SuggestionBody row={s} />
                {s.status === 'pending' ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void approve(s.id)}
                      className="rounded-md bg-[#22C55E] px-3 py-2 text-sm font-medium text-white"
                    >
                      {t('approve')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reject(s.id)}
                      className="rounded-md border border-[#EF4444] bg-transparent px-3 py-2 text-sm text-[#EF4444]"
                    >
                      {t('reject')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditApprove(s)}
                      className="rounded-md border border-[#3B82F6] bg-transparent px-3 py-2 text-sm text-[#3B82F6]"
                    >
                      {t('editApprove')}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <span
                      className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                        s.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {s.status === 'approved' ? t('approved') : t('rejected')}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      {editOverride ? (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg border border-[#2A3042] bg-[#1A1F2E] p-4">
            <p className="mb-2 text-sm text-[#8B95A8]">{t('overrideHint')}</p>
            <textarea
              value={editOverride.json}
              onChange={(e) =>
                setEditOverride((o) =>
                  o ? { ...o, json: e.target.value } : null
                )
              }
              rows={12}
              className="w-full rounded-md border border-[#2A3042] bg-[#111827] p-2 font-mono text-xs text-[#E8ECF4]"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(editOverride.json) as Record<
                      string,
                      unknown
                    >;
                    void approve(editOverride.id, parsed);
                  } catch {
                    pushToast('JSON invalide', 'error');
                  }
                }}
                className="rounded-md bg-[#22C55E] px-3 py-2 text-sm text-white"
              >
                {t('saveOverride')}
              </button>
              <button
                type="button"
                onClick={() => setEditOverride(null)}
                className="text-sm text-[#8B95A8]"
              >
                {tAuth('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = useTranslations('admin');
  const label =
    type === 'edit_node'
      ? t('typeEdit')
      : type === 'add_link'
        ? t('typeAddLink')
        : type === 'new_node'
          ? t('typeNewNode')
          : type;
  const color =
    type === 'edit_node'
      ? 'bg-amber-500/20 text-amber-400'
      : type === 'add_link'
        ? 'bg-teal-500/20 text-teal-400'
        : 'bg-violet-500/20 text-violet-400';
  return (
    <span className={`rounded px-2 py-1 text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

function ContributorLine({
  userId,
  profiles,
}: {
  userId: string | null;
  profiles: Record<string, ProfileLite>;
}) {
  if (!userId) return <p className="mb-2 text-sm text-[#8B95A8]">—</p>;
  const p = profiles[userId];
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#2A3042]">
        {p?.avatar_url ? (
          <Image
            src={p.avatar_url}
            alt=""
            width={32}
            height={32}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-[#8B95A8]">
            {(p?.display_name ?? p?.email ?? '?').slice(0, 1)}
          </div>
        )}
      </div>
      <span className="text-sm text-[#E8ECF4]">
        {p?.display_name ?? p?.email ?? userId}
      </span>
    </div>
  );
}

function SuggestionBody({ row }: { row: SuggestionRow }) {
  const data = row.data;

  if (row.suggestion_type === 'edit_node') {
    const d = data as {
      diff?: Record<string, { from: unknown; to: unknown }>;
    };
    const diff = d.diff ?? {};
    return (
      <div className="space-y-2 text-sm">
        {Object.entries(diff).map(([k, v]) => (
          <div key={k} className="rounded border border-[#2A3042]/80 bg-[#111827]/50 px-2 py-1">
            <span className="text-xs uppercase text-[#8B95A8]">{k}</span>
            <div className="mt-1">
              <span className="text-red-400 line-through">
                {String(v.from ?? '')}
              </span>
              {' → '}
              <span className="text-emerald-400">{String(v.to ?? '')}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (row.suggestion_type === 'add_link') {
    const d = data as {
      source_id: string;
      target_id: string;
      relation_type: string;
    };
    return (
      <p className="text-sm">
        <span className="text-[#3B82F6]">{d.source_id}</span>
        {' → '}
        <span className="text-[#3B82F6]">{d.target_id}</span>
        <span className="text-[#8B95A8]"> ({d.relation_type})</span>
      </p>
    );
  }

  if (row.suggestion_type === 'new_node') {
    const d = data as {
      node: Record<string, unknown>;
      link: Record<string, unknown>;
    };
    return (
      <pre className="max-h-40 overflow-auto rounded border border-[#2A3042] bg-[#111827] p-2 text-xs text-[#8B95A8]">
        {JSON.stringify(d, null, 2)}
      </pre>
    );
  }

  return (
    <pre className="text-xs text-[#8B95A8]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { computeDiff } from '@/lib/suggestion-diff';
import { getCategoryLabelFr } from '@/lib/category-labels';
import { NodeCategory } from '@/lib/types';
import { RelationType } from '@/lib/types';

type SuggestionRow = {
  id: string;
  user_id: string | null;
  contributor_ip?: string | null;
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

type Stats = {
  pending: number;
  approved: number;
  rejected: number;
  contributorsWithSuggestions: number;
};

type ContributorRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  contributions_count: number;
  created_at: string;
  approved_suggestions: number;
  rejected_suggestions: number;
  total_suggestions: number;
};

type FilterKey = 'all' | 'edit_node' | 'add_link' | 'new_node';

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom',
  description: 'Description',
  description_en: 'Description (EN)',
  category: 'Catégorie',
  type: 'Type',
  era: 'Époque',
  year_approx: 'Année',
  origin: 'Origine',
};

const RELATION_LABELS_FR: Record<string, string> = {
  [RelationType.MATERIAL]: 'Matière première',
  [RelationType.TOOL]: 'Outil',
  [RelationType.ENERGY]: 'Énergie',
  [RelationType.KNOWLEDGE]: 'Connaissance',
  [RelationType.CATALYST]: 'Catalyseur',
};

type LinkSnap = {
  id: string;
  relation_type: string;
  notes: string;
  is_optional: boolean;
};

function formatLinkSnapLine(s: LinkSnap): string {
  const rel = RELATION_LABELS_FR[s.relation_type] ?? s.relation_type;
  const n = s.notes?.trim() || '—';
  const opt = s.is_optional ? 'optionnel' : 'requis';
  return `${rel} · ${opt} · ${n}`;
}

function stripLinkEditsFromPayload(o: Record<string, unknown>) {
  const { linkEdits: _l, ...rest } = o;
  return rest;
}

function formatRelativeFr(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `il y a ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  return d.toLocaleDateString('fr-FR');
}

function avatarHue(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return `hsl(${h} 42% 38%)`;
}

function initialsFromProfile(p: ProfileLite | undefined, fallback: string): string {
  const s = (p?.display_name ?? p?.email ?? fallback).trim();
  if (!s) return '?';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return s.slice(0, 2).toUpperCase();
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
  const [nodeNames, setNodeNames] = useState<Record<string, string>>({});
  const [suggestionCountByUser, setSuggestionCountByUser] = useState<
    Record<string, number>
  >({});
  const [stats, setStats] = useState<Stats | null>(null);
  const [contributorList, setContributorList] = useState<ContributorRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');

  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Record<string, unknown> | null>(
    null
  );
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) return;
      const j = (await res.json()) as Stats;
      setStats(j);
    } catch {
      /* ignore */
    }
  }, []);

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
          nodeNames: Record<string, string>;
          suggestionCountByUser: Record<string, number>;
        };
        setSuggestions(j.suggestions ?? []);
        setProfiles(j.profiles ?? {});
        setNodeNames(j.nodeNames ?? {});
        setSuggestionCountByUser(j.suggestionCountByUser ?? {});
      } finally {
        setLoading(false);
      }
    },
    [pushToast]
  );

  const loadContributors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/contributors');
      if (!res.ok) return;
      const j = (await res.json()) as { contributors: ContributorRow[] };
      setContributorList(j.contributors ?? []);
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
    void loadStats();
    if (tab === 'contributors') void loadContributors();
    else void loadSuggestions(tab);
  }, [isAdmin, isLoading, tab, router, loadSuggestions, loadContributors, loadStats]);

  const removeAfterExit = useCallback((id: string) => {
    setExitingIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setSuggestions((list) => list.filter((s) => s.id !== id));
      setExitingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      void loadStats();
    }, 320);
  }, [loadStats]);

  const approve = useCallback(
    async (id: string, overrideProposed?: Record<string, unknown>) => {
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
      setEditingId(null);
      setEditDraft(null);
      removeAfterExit(id);
      if (tab === 'contributors') void loadContributors();
    },
    [pushToast, t, removeAfterExit, tab, loadContributors]
  );

  const reject = useCallback(
    async (id: string, comment: string | null) => {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, admin_comment: comment || null }),
      });
      if (!res.ok) {
        pushToast('Erreur', 'error');
        return;
      }
      pushToast(t('toastRejected'), 'success');
      setRejectingId(null);
      setRejectComment('');
      removeAfterExit(id);
      if (tab === 'contributors') void loadContributors();
    },
    [pushToast, t, removeAfterExit, tab, loadContributors]
  );

  const filteredSuggestions = useMemo(() => {
    if (filter === 'all') return suggestions;
    return suggestions.filter((s) => s.suggestion_type === filter);
  }, [suggestions, filter]);

  const startEdit = (s: SuggestionRow) => {
    setEditingId(s.id);
    setRejectingId(null);
    if (s.suggestion_type === 'edit_node') {
      const d = s.data as { proposed?: Record<string, unknown> };
      setEditDraft({ ...(d.proposed ?? {}) });
    } else if (s.suggestion_type === 'add_link') {
      const d = s.data as { relation_type?: string };
      setEditDraft({ relation_type: d.relation_type ?? RelationType.MATERIAL });
    } else if (s.suggestion_type === 'new_node') {
      const d = s.data as {
        node: Record<string, unknown>;
        link: Record<string, unknown>;
      };
      setEditDraft({
        node: { ...d.node },
        link: { ...d.link },
      });
    } else {
      setEditDraft({});
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const submitEditApprove = (s: SuggestionRow) => {
    if (!editDraft) return;
    if (s.suggestion_type === 'edit_node') {
      const o = { ...(editDraft as Record<string, unknown>) };
      if (typeof o.year_approx === 'string') {
        o.year_approx =
          o.year_approx.trim() === '' ? null : Number(o.year_approx);
      }
      void approve(s.id, o);
    } else if (s.suggestion_type === 'add_link') {
      void approve(s.id, editDraft as Record<string, unknown>);
    } else if (s.suggestion_type === 'new_node') {
      void approve(s.id, editDraft as Record<string, unknown>);
    }
  };

  if (isLoading || !isAdmin) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-[#0B0F18] text-[#5A6175]">
        …
      </div>
    );
  }

  const pendingBadge = stats?.pending ?? 0;

  return (
    <div className="min-h-screen bg-[#0B0F18] text-[#E8ECF4]">
      <header className="flex shrink-0 items-center justify-between px-4 py-4 md:px-8">
        <h1 className="text-[16px] font-medium text-white">
          {t('title')}
        </h1>
        <Link
          href="/explore"
          className="text-[13px] font-normal text-[#3B82F6] hover:underline"
        >
          {t('backToTree')}
        </Link>
      </header>

      <div className="border-b border-transparent px-4 md:px-8">
        <div className="flex flex-wrap gap-6">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`relative pb-2 text-sm font-medium ${
              tab === 'pending' ? 'text-white' : 'text-[#5A6175]'
            }`}
          >
            {t('tabPending')}
            {pendingBadge > 0 ? (
              <span
                className="ml-2 inline-block rounded-[8px] bg-[#EF4444] px-[5px] py-[1px] text-[9px] font-semibold leading-tight text-white"
                aria-label={`${pendingBadge}`}
              >
                {pendingBadge}
              </span>
            ) : null}
            {tab === 'pending' ? (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3B82F6]" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`relative pb-2 text-sm font-medium ${
              tab === 'history' ? 'text-white' : 'text-[#5A6175]'
            }`}
          >
            {t('tabHistory')}
            {tab === 'history' ? (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3B82F6]" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('contributors')}
            className={`relative pb-2 text-sm font-medium ${
              tab === 'contributors' ? 'text-white' : 'text-[#5A6175]'
            }`}
          >
            {t('tabContributors')}
            {tab === 'contributors' ? (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#3B82F6]" />
            ) : null}
          </button>
        </div>
      </div>

      {tab !== 'contributors' && stats ? (
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-[10px] px-4 py-4 sm:grid-cols-2 lg:grid-cols-4 md:px-8">
          <StatCard
            value={stats.pending}
            color="#F59E0B"
            label="En attente"
          />
          <StatCard
            value={stats.approved}
            color="#22C55E"
            label="Approuvées"
          />
          <StatCard
            value={stats.rejected}
            color="#EF4444"
            label="Rejetées"
          />
          <StatCard
            value={stats.contributorsWithSuggestions}
            color="#3B82F6"
            label="Contributeurs"
          />
        </div>
      ) : null}

      {tab === 'pending' ? (
        <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 pb-2 md:px-8">
          {(
            [
              ['all', 'Tout'],
              ['edit_node', 'Corrections'],
              ['add_link', 'Nouveaux liens'],
              ['new_node', 'Nouvelles inventions'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-[6px] border px-3 py-[5px] text-[11px] ${
                filter === key
                  ? 'border-[#3B82F6] text-[#E8ECF4]'
                  : 'border-[#2A3042] text-[#8B95A8]'
              } bg-[#111827]`}
              style={{ borderWidth: '0.5px' }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <main className="mx-auto max-w-5xl px-4 py-4 md:px-8">
        {loading ? (
          <p className="text-[#5A6175]">…</p>
        ) : tab === 'contributors' ? (
          <ul className="space-y-2">
            {contributorList.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-[#2A3042] bg-[#111827] px-4 py-3"
                style={{ borderWidth: '0.5px' }}
              >
                <div
                  className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full"
                  style={{ width: 32, height: 32 }}
                >
                  {p.avatar_url ? (
                    <Image
                      src={p.avatar_url}
                      alt=""
                      width={32}
                      height={32}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center text-[11px] font-medium text-white"
                      style={{ background: avatarHue(p.id) }}
                    >
                      {initialsFromProfile(
                        {
                          email: p.email,
                          display_name: p.display_name,
                          avatar_url: p.avatar_url,
                          contributions_count: p.contributions_count,
                        },
                        p.id
                      )}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[#E8ECF4]">
                    {p.display_name ?? p.email ?? p.id}
                  </p>
                  <p className="truncate text-[12px] text-[#5A6175]">
                    {p.email}
                  </p>
                </div>
                <span className="rounded-[8px] bg-[#22C55E22] px-2 py-0.5 text-[11px] font-medium text-[#22C55E]">
                  {p.approved_suggestions}{' '}
                  {p.approved_suggestions <= 1
                    ? 'approuvée'
                    : 'approuvées'}
                </span>
                <span className="rounded-[6px] bg-[#EF444422] px-1.5 py-0.5 text-[10px] text-[#EF4444]">
                  {p.rejected_suggestions}{' '}
                  {p.rejected_suggestions <= 1 ? 'rejetée' : 'rejetées'}
                </span>
                <span className="text-[12px] text-[#5A6175]">
                  Inscrit le{' '}
                  {new Date(p.created_at).toLocaleDateString('fr-FR')}
                </span>
              </li>
            ))}
          </ul>
        ) : filteredSuggestions.length === 0 &&
          tab === 'pending' &&
          suggestions.length > 0 ? (
          <p className="py-8 text-center text-[14px] text-[#5A6175]">
            Aucune suggestion pour ce filtre.
          </p>
        ) : filteredSuggestions.length === 0 && tab === 'pending' ? (
          <div className="flex flex-col items-center justify-center py-16">
            <svg
              width={48}
              height={48}
              viewBox="0 0 48 48"
              fill="none"
              className="text-[#22C55E]"
              aria-hidden
            >
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" />
              <path
                d="M14 24l7 7 13-13"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-4 text-[16px] text-[#5A6175]">
              Aucune suggestion en attente
            </p>
            <p className="mt-1 text-center text-[13px] text-[#3D4555]">
              Les nouvelles suggestions des contributeurs apparaîtront ici
            </p>
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <p className="text-[#5A6175]">{t('noSuggestions')}</p>
        ) : (
          <ul className="space-y-0">
            {filteredSuggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                row={s}
                profiles={profiles}
                nodeNames={nodeNames}
                suggestionCountByUser={suggestionCountByUser}
                exiting={exitingIds.has(s.id)}
                isEditing={editingId === s.id}
                editDraft={editingId === s.id ? editDraft : null}
                onEditDraftChange={setEditDraft}
                rejecting={rejectingId === s.id}
                rejectComment={rejectComment}
                onRejectCommentChange={setRejectComment}
                onApprove={() => void approve(s.id)}
                onApproveEdit={() => submitEditApprove(s)}
                onStartEdit={() => startEdit(s)}
                onCancelEdit={cancelEdit}
                onRejectOpen={() => {
                  setRejectingId(s.id);
                  setEditingId(null);
                }}
                onRejectConfirm={() =>
                  void reject(s.id, rejectComment.trim() || null)
                }
                onRejectCancel={() => {
                  setRejectingId(null);
                  setRejectComment('');
                }}
                t={t}
                tAuth={tAuth}
                dateIso={
                  tab === 'history'
                    ? (s.reviewed_at ?? s.created_at)
                    : s.created_at
                }
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function StatCard({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  return (
    <div className="rounded-[8px] bg-[#111827] px-3 py-3 text-center">
      <p className="text-[20px] font-medium" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[10px] text-[#5A6175]">{label}</p>
    </div>
  );
}

function SuggestionCard({
  row,
  profiles,
  nodeNames,
  suggestionCountByUser,
  exiting,
  isEditing,
  editDraft,
  onEditDraftChange,
  rejecting,
  rejectComment,
  onRejectCommentChange,
  onApprove,
  onApproveEdit,
  onStartEdit,
  onCancelEdit,
  onRejectOpen,
  onRejectConfirm,
  onRejectCancel,
  t,
  tAuth,
  dateIso,
}: {
  row: SuggestionRow;
  profiles: Record<string, ProfileLite>;
  nodeNames: Record<string, string>;
  suggestionCountByUser: Record<string, number>;
  exiting: boolean;
  isEditing: boolean;
  editDraft: Record<string, unknown> | null;
  onEditDraftChange: (d: Record<string, unknown>) => void;
  rejecting: boolean;
  rejectComment: string;
  onRejectCommentChange: (s: string) => void;
  onApprove: () => void;
  onApproveEdit: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onRejectOpen: () => void;
  onRejectConfirm: () => void;
  onRejectCancel: () => void;
  t: (k: string) => string;
  tAuth: (k: string) => string;
  dateIso: string;
}) {
  const p = row.user_id ? profiles[row.user_id] : undefined;
  const uid = row.user_id ?? '';

  return (
    <li
      className={`mb-[10px] rounded-[8px] border border-[#2A3042] bg-[#111827] p-4 transition-opacity duration-300 ${
        exiting ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{ borderWidth: '0.5px' }}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <TypeBadge type={row.suggestion_type} t={t} />
        <span className="text-[11px] text-[#5A6175]">
          {formatRelativeFr(dateIso)}
        </span>
      </div>

      {row.user_id ? (
        <div className="mb-3 flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-semibold text-white"
            style={{
              width: 24,
              height: 24,
              background: p?.avatar_url ? 'transparent' : avatarHue(uid),
            }}
          >
            {p?.avatar_url ? (
              <Image
                src={p.avatar_url}
                alt=""
                width={24}
                height={24}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              initialsFromProfile(p, uid)
            )}
          </div>
          <div>
            <p className="text-[12px] text-[#8B95A8]">
              {p?.display_name ?? p?.email ?? uid}
            </p>
            <p className="text-[10px] text-[#5A6175]">
              {suggestionCountByUser[row.user_id] ?? 0} {t('contributions')}
            </p>
          </div>
        </div>
      ) : row.contributor_ip ? (
        <div className="mb-3 flex items-start gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1A1F2E] text-[10px] font-bold text-[#8B95A8]"
            style={{ width: 24, height: 24 }}
          >
            ?
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[#8B95A8]">
              {t('anonymousContributor')}
            </p>
            <p className="font-mono text-[11px] text-[#F59E0B]">
              {row.contributor_ip}
            </p>
            <p className="text-[10px] text-[#5A6175]">
              {suggestionCountByUser[`anon:${row.contributor_ip}`] ?? 0}{' '}
              {t('contributions')}
            </p>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-[12px] text-[#5A6175]">
          {t('contributorUnknown')}
        </p>
      )}

      <SuggestionBody
        row={row}
        nodeNames={nodeNames}
        isEditing={isEditing}
        editDraft={editDraft}
        onEditDraftChange={onEditDraftChange}
      />

      {row.status === 'pending' && !isEditing && !rejecting ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="rounded-[6px] bg-[#22C55E] px-4 py-[7px] text-[12px] font-medium text-white"
          >
            {t('approve')}
          </button>
          <button
            type="button"
            onClick={onStartEdit}
            className="rounded-[6px] border border-[#3B82F6] bg-transparent px-4 py-[7px] text-[12px] font-medium text-[#3B82F6]"
          >
            {t('editApprove')}
          </button>
          <button
            type="button"
            onClick={onRejectOpen}
            className="rounded-[6px] border border-[#EF4444] bg-transparent px-4 py-[7px] text-[12px] font-medium text-[#EF4444]"
          >
            {t('reject')}
          </button>
        </div>
      ) : null}

      {row.status === 'pending' && isEditing ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onApproveEdit}
            className="rounded-[6px] bg-[#3B82F6] px-4 py-[7px] text-[12px] font-medium text-white"
          >
            Valider les modifications
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-[12px] text-[#8B95A8] hover:text-[#E8ECF4]"
          >
            {tAuth('cancel')}
          </button>
        </div>
      ) : null}

      {row.status === 'pending' && rejecting ? (
        <div className="mt-3 space-y-2">
          <input
            type="text"
            value={rejectComment}
            onChange={(e) => onRejectCommentChange(e.target.value)}
            placeholder="Raison du rejet (optionnel)"
            className="w-full rounded-md border border-[#2A3042] bg-[#0A0E17] px-3 py-2 text-sm text-[#E8ECF4] placeholder:text-[#5A6175]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRejectConfirm}
              className="rounded-[6px] border border-[#EF4444] bg-transparent px-3 py-1.5 text-[12px] text-[#EF4444]"
            >
              Confirmer le rejet
            </button>
            <button
              type="button"
              onClick={onRejectCancel}
              className="text-[12px] text-[#8B95A8]"
            >
              {tAuth('cancel')}
            </button>
          </div>
        </div>
      ) : null}

      {row.status !== 'pending' ? (
        <div className="mt-3 space-y-1">
          <span
            className={`inline-block rounded px-2 py-1 text-[9px] font-semibold ${
              row.status === 'approved'
                ? 'bg-[#22C55E22] text-[#22C55E]'
                : 'bg-[#EF444422] text-[#EF4444]'
            }`}
          >
            {row.status === 'approved' ? t('approved') : t('rejected')}
          </span>
          {row.status === 'rejected' && row.admin_comment ? (
            <p className="text-[12px] italic text-[#8B95A8]">
              {row.admin_comment}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function TypeBadge({ type, t }: { type: string; t: (k: string) => string }) {
  const label =
    type === 'edit_node'
      ? t('typeEdit')
      : type === 'add_link'
        ? t('typeAddLink')
        : type === 'new_node'
          ? t('typeNewNode')
          : type;
  const cls =
    type === 'edit_node'
      ? 'bg-[#F59E0B22] text-[#F59E0B]'
      : type === 'add_link'
        ? 'bg-[#0F6E5622] text-[#5DCAA5]'
        : 'bg-[#534AB722] text-[#AFA9EC]';
  return (
    <span
      className={`inline-block rounded px-2 py-[2px] text-[9px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}

function SuggestionBody({
  row,
  nodeNames,
  isEditing,
  editDraft,
  onEditDraftChange,
}: {
  row: SuggestionRow;
  nodeNames: Record<string, string>;
  isEditing: boolean;
  editDraft: Record<string, unknown> | null;
  onEditDraftChange: (d: Record<string, unknown>) => void;
}) {
  const data = row.data;

  if (row.suggestion_type === 'edit_node') {
    const d = data as {
      original?: Record<string, unknown>;
      proposed?: Record<string, unknown>;
      diff?: Record<string, { from: unknown; to: unknown }>;
      linkDiff?: Record<string, { from: LinkSnap; to: LinkSnap }>;
      linkContext?: Record<
        string,
        { peerName: string; section: 'ledTo' | 'builtUpon' }
      >;
      removedLinkIds?: string[];
      proposedAddLinks?: Array<{
        source_id: string;
        target_id: string;
        relation_type: string;
        section?: 'ledTo' | 'builtUpon';
      }>;
    };
    const orig = d.original ?? {};
    const prop = d.proposed ?? {};
    const nodeDiff =
      d.diff ??
      computeDiff(
        stripLinkEditsFromPayload(orig) as Record<string, unknown>,
        stripLinkEditsFromPayload(prop) as Record<string, unknown>
      );
    const linkDiff = d.linkDiff ?? {};
    const linkContext = d.linkContext ?? {};
    const removedLinkIds = Array.isArray(d.removedLinkIds) ? d.removedLinkIds : [];
    const proposedAddLinks = Array.isArray(d.proposedAddLinks)
      ? d.proposedAddLinks
      : [];
    const origLinkEdits =
      (orig as { linkEdits?: Record<string, LinkSnap> }).linkEdits ?? {};

    const nodeName =
      typeof prop.name === 'string'
        ? prop.name
        : typeof orig.name === 'string'
          ? orig.name
          : '—';

    if (isEditing && editDraft) {
      const draft = editDraft as Record<string, unknown>;
      return (
        <div className="space-y-2">
          <p className="text-[13px] font-bold text-[#E8ECF4]">
            {nodeName} — correction
          </p>
          <div className="space-y-2 rounded-[6px] bg-[#0A0E17] px-3 py-2.5">
            {Object.keys(nodeDiff).map((key) => (
              <label key={key} className="block text-[11px] text-[#5A6175]">
                {FIELD_LABELS[key] ?? key}
                <input
                  className="mt-1 w-full rounded border border-[#2A3042] bg-[#111827] px-2 py-1 text-[12px] text-[#E8ECF4]"
                  value={String(draft[key] ?? '')}
                  onChange={(e) =>
                    onEditDraftChange({ ...draft, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className="text-[13px] font-bold text-[#E8ECF4]">
          {nodeName} — correction
        </p>
        <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5">
          {Object.entries(nodeDiff).map(([key, ch]) => (
            <div
              key={key}
              className="mb-2 flex flex-wrap items-baseline gap-1 text-[12px] last:mb-0"
            >
              <span
                className="inline-block w-[70px] shrink-0 text-[11px] text-[#5A6175]"
              >
                {FIELD_LABELS[key] ?? key}
              </span>
              <span className="text-[#EF4444] line-through">
                {String((ch as { from: unknown }).from ?? '')}
              </span>
              <span className="text-[#5A6175]">→</span>
              <span className="text-[#22C55E]">
                {String((ch as { to: unknown }).to ?? '')}
              </span>
            </div>
          ))}
        </div>
        {Object.keys(linkDiff).length > 0 ? (
          <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#5A6175]">
              Liens (Led to / Built upon)
            </p>
            <ul className="space-y-3">
              {Object.entries(linkDiff).map(([linkId, ch]) => {
                const ctx = linkContext[linkId];
                const sectionLabel =
                  ctx?.section === 'builtUpon'
                    ? 'Built upon'
                    : ctx?.section === 'ledTo'
                      ? 'Led to'
                      : 'Lien';
                return (
                  <li key={linkId} className="text-[12px]">
                    <p className="mb-1 text-[11px] text-[#8B95A8]">
                      {sectionLabel} · {ctx?.peerName ?? linkId}
                    </p>
                    <p className="text-[#EF4444] line-through">
                      {formatLinkSnapLine(ch.from)}
                    </p>
                    <p className="text-[#5A6175]">→</p>
                    <p className="text-[#22C55E]">{formatLinkSnapLine(ch.to)}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {proposedAddLinks.length > 0 ? (
          <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#5A6175]">
              Liens proposés (nouveaux)
            </p>
            <ul className="space-y-2">
              {proposedAddLinks.map((add, i) => {
                const srcName = nodeNames[add.source_id] ?? add.source_id;
                const tgtName = nodeNames[add.target_id] ?? add.target_id;
                const sectionLabel =
                  add.section === 'builtUpon'
                    ? 'Built upon'
                    : add.section === 'ledTo'
                      ? 'Led to'
                      : 'Lien';
                const relLabel =
                  RELATION_LABELS_FR[add.relation_type] ?? add.relation_type;
                return (
                  <li key={`${add.source_id}-${add.target_id}-${i}`} className="text-[12px]">
                    <p className="mb-1 text-[11px] text-[#8B95A8]">{sectionLabel}</p>
                    <p className="text-[#22C55E]">
                      <span className="font-medium">{srcName}</span>
                      <span className="text-[#5A6175]"> → </span>
                      <span className="font-medium">{tgtName}</span>
                      <span className="text-[#5A6175]"> · </span>
                      <span>{relLabel}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {removedLinkIds.length > 0 ? (
          <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#5A6175]">
              Liens supprimés
            </p>
            <ul className="space-y-2">
              {removedLinkIds.map((linkId) => {
                const ctx = linkContext[linkId];
                const snap = origLinkEdits[linkId];
                const sectionLabel =
                  ctx?.section === 'builtUpon'
                    ? 'Built upon'
                    : ctx?.section === 'ledTo'
                      ? 'Led to'
                      : 'Lien';
                return (
                  <li key={linkId} className="text-[12px]">
                    <p className="mb-1 text-[11px] text-[#8B95A8]">
                      {sectionLabel} · {ctx?.peerName ?? linkId}
                    </p>
                    {snap ? (
                      <p className="text-[#EF4444] line-through">
                        {formatLinkSnapLine(snap)}
                      </p>
                    ) : (
                      <p className="text-[#8B95A8]">{linkId}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  if (row.suggestion_type === 'add_link') {
    const d = data as {
      source_id: string;
      target_id: string;
      relation_type: string;
    };
    const srcName = nodeNames[d.source_id] ?? d.source_id;
    const tgtName = nodeNames[d.target_id] ?? d.target_id;
    const relLabel =
      RELATION_LABELS_FR[d.relation_type] ?? d.relation_type;

    if (isEditing && editDraft) {
      const draft = editDraft as { relation_type?: string };
      return (
        <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded px-2.5 py-1 text-[12px] font-bold text-[#E8ECF4] bg-[#1A1F2E]">
              {srcName}
            </span>
            <span className="text-[#5A6175]">→</span>
            <span className="rounded px-2.5 py-1 text-[12px] font-bold text-[#E8ECF4] bg-[#1A1F2E]">
              {tgtName}
            </span>
          </div>
          <select
            className="mt-2 w-full rounded border border-[#2A3042] bg-[#111827] px-2 py-1 text-[12px] text-[#E8ECF4]"
            value={draft.relation_type ?? d.relation_type}
            onChange={(e) =>
              onEditDraftChange({
                ...draft,
                relation_type: e.target.value as RelationType,
              })
            }
          >
            {Object.values(RelationType).map((rt) => (
              <option key={rt} value={rt}>
                {RELATION_LABELS_FR[rt] ?? rt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded px-2.5 py-1 text-[12px] font-bold text-[#E8ECF4] bg-[#1A1F2E]">
              {srcName}
            </span>
            <span className="text-[#5A6175]">→</span>
            <span className="rounded px-2.5 py-1 text-[12px] font-bold text-[#E8ECF4] bg-[#1A1F2E]">
              {tgtName}
            </span>
          </div>
          <span className="text-[10px] text-[#5A6175]">{relLabel}</span>
        </div>
      </div>
    );
  }

  if (row.suggestion_type === 'new_node') {
    const d = data as {
      node: {
        name: string;
        category: string;
        type: string;
        era: string;
        year_approx?: number | null;
        proposed_id?: string;
      };
      link: {
        source_id: string;
        target_id: string;
        relation_type: string;
      };
    };

    if (isEditing && editDraft) {
      const draft = editDraft as {
        node: Record<string, unknown>;
        link: Record<string, unknown>;
      };
      const n = draft.node ?? {};
      const l = draft.link ?? {};
      return (
        <div className="space-y-2">
          <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5 space-y-2">
            {(
              [
                ['name', 'Nom'],
                ['category', 'Catégorie'],
                ['type', 'Type'],
                ['era', 'Époque'],
                ['year_approx', 'Année'],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="block text-[11px] text-[#5A6175]">
                {lab}
                <input
                  className="mt-0.5 w-full rounded border border-[#2A3042] bg-[#111827] px-2 py-1 text-[12px] text-[#E8ECF4]"
                  value={
                    k === 'year_approx'
                      ? String(n[k] ?? '')
                      : String(n[k] ?? '')
                  }
                  onChange={(e) => {
                    const v =
                      k === 'year_approx'
                        ? e.target.value === ''
                          ? null
                          : Number(e.target.value)
                        : e.target.value;
                    onEditDraftChange({
                      ...draft,
                      node: { ...n, [k]: v },
                      link: { ...l },
                    });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5">
            <p className="mb-1 text-[10px] text-[#5A6175]">Lien</p>
            <select
              className="w-full rounded border border-[#2A3042] bg-[#111827] px-2 py-1 text-[12px] text-[#E8ECF4]"
              value={String(l.relation_type ?? d.link.relation_type)}
              onChange={(e) =>
                onEditDraftChange({
                  ...draft,
                  node: { ...n },
                  link: {
                    ...l,
                    relation_type: e.target.value,
                  },
                })
              }
            >
              {Object.values(RelationType).map((rt) => (
                <option key={rt} value={rt}>
                  {RELATION_LABELS_FR[rt] ?? rt}
                </option>
              ))}
            </select>
          </div>
        </div>
      );
    }

    const newName = d.node.name;
    const ph = (d.node.proposed_id ?? '').trim();
    const srcName =
      nodeNames[d.link.source_id] ??
      (ph && d.link.source_id === ph ? newName : d.link.source_id);
    const tgtName =
      nodeNames[d.link.target_id] ??
      (ph && d.link.target_id === ph ? newName : d.link.target_id);

    return (
      <div className="space-y-2">
        <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5 text-[12px] text-[#22C55E] space-y-1">
          <p>
            <span className="text-[#5A6175]">Nom : </span>
            {d.node.name}
          </p>
          <p>
            <span className="text-[#5A6175]">Catégorie : </span>
            {getCategoryLabelFr(d.node.category as unknown as NodeCategory)}
          </p>
          <p>
            <span className="text-[#5A6175]">Type : </span>
            {d.node.type}
          </p>
          <p>
            <span className="text-[#5A6175]">Époque : </span>
            {d.node.era}
          </p>
          <p>
            <span className="text-[#5A6175]">Année : </span>
            {d.node.year_approx ?? '—'}
          </p>
        </div>
        <div className="rounded-[6px] bg-[#0A0E17] px-3 py-2.5 text-[12px] text-[#8B95A8]">
          <span className="font-medium text-[#E8ECF4]">{srcName}</span>
          <span className="mx-1 text-[#5A6175]">→</span>
          <span className="font-medium text-[#E8ECF4]">{tgtName}</span>
          <span className="ml-2 text-[10px] text-[#5A6175]">
            ({RELATION_LABELS_FR[d.link.relation_type] ?? d.link.relation_type})
          </span>
        </div>
      </div>
    );
  }

  return (
    <pre className="text-xs text-[#5A6175]">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

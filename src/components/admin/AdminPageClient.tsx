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
import { useLocale, useTranslations } from 'next-intl';
import { AdminEditNodeAddLinkSearches } from '@/components/admin/AdminEditNodeAddLinkSearches';
import { AdminNewNodeLinkSearches } from '@/components/admin/AdminNewNodeLinkSearches';
import { useAdminSuggestionCardImageUrl } from '@/components/admin/use-admin-suggestion-card-image';
import { AppContentShell } from '@/components/layout/AppContentShell';
import { BackToExploreLink } from '@/components/layout/BackToExploreLink';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import {
  ADMIN_DRAFT_PROPOSED_ADD,
  ADMIN_DRAFT_REMOVED_IDS,
  type AdminEditNodeLinkListsOverride,
  getContributorContactHintFromSuggestion,
  getContributorFacingMessageFromSuggestion,
  getExploreNodeId,
  initSuggestionEditDraft,
  type LinkSnap,
  type SuggestionRow,
  sanitizeAdminProposedAddLinks,
  VALID_RELATIONS,
  formatLinkSnapLine,
  stripLinkEditsFromPayload,
} from '@/lib/admin-suggestion-shared';
import { PRIMARY_CARD_CATEGORY_ORDER } from '@/lib/card-primary-categories';
import {
  EDIT_NODE_EXTRA_KEYS_AFTER_ADD_CARD,
  SUGGEST_ADD_CARD_NODE_KEYS,
} from '@/lib/suggest-add-card-field-order';
import { computeDiff } from '@/lib/suggestion-diff';
import { getCategoryLabelFr } from '@/lib/category-labels';
import { eraLabelFromMessages } from '@/lib/era-display';
import {
  DIMENSION_ORDER,
  ERA_ORDER,
  MATERIAL_LEVEL_ORDER,
  NODE_CATEGORY_ORDER,
} from '@/lib/node-labels';
import {
  CHEMICAL_NATURE_ORDER,
  NATURAL_ORIGIN_ORDER,
} from '@/lib/suggest-nature-fields';
import { NodeCategory, RelationType, type Era } from '@/lib/types';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';
import {
  EDITOR_DIM_KEY,
  EDITOR_LEVEL_KEY,
} from '@/components/editor/dimension-editor-keys';
import {
  suggestFormLabelClass,
  suggestFormLabelSectionClass,
  suggestFormNatureSectionTitleClass,
  suggestInputClass,
  suggestNatureBlockWrapClass,
  suggestSelectClass,
} from '@/components/ui/suggest-form-classes';
import { SuggestionTagsField } from '@/components/ui/SuggestionTagsField';

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

type AnalyticsPayload = {
  summary: {
    sessionsToday: number;
    clicksToday: number;
    searchesToday: number;
    sharesToday: number;
  };
  topNodes: { nodeId: string; name: string; count: number }[];
  topSearches: { query: string; count: number }[];
  topPaths: {
    fromId: string;
    fromName: string;
    toId: string;
    toName: string;
    count: number;
  }[];
  languageDistribution: { locale: string; count: number; percent: number }[];
};

type FilterKey =
  | 'all'
  | 'edit_node'
  | 'add_link'
  | 'new_node'
  | 'anonymous_users'
  | 'delete_link'
  | 'anonymous_feedback';

type SortKey = 'recent' | 'reliability' | 'type';

type ReliabilityTier = 'trusted' | 'new' | 'anonymous';

const TYPE_SORT_ORDER: Record<string, number> = {
  edit_node: 0,
  add_link: 1,
  new_node: 2,
  delete_link: 3,
  anonymous_feedback: 4,
};

function getReliabilityTier(
  row: SuggestionRow,
  profile: ProfileLite | undefined
): ReliabilityTier {
  if (row.user_id == null) return 'anonymous';
  const n = profile?.contributions_count ?? 0;
  if (n >= 10) return 'trusted';
  return 'new';
}

function compactDisplayName(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${first} ${last[0]!.toUpperCase()}.`;
}

function reliabilitySortRank(tier: ReliabilityTier): number {
  if (tier === 'trusted') return 0;
  if (tier === 'new') return 1;
  return 2;
}

function getSuggestionCardTitle(
  row: SuggestionRow,
  nodeNames: Record<string, string>
): string {
  if (row.suggestion_type === 'edit_node') {
    const d = row.data as {
      proposed?: { name?: string };
      original?: { name?: string };
    };
    if (typeof d.proposed?.name === 'string') return d.proposed.name;
    if (typeof d.original?.name === 'string') return d.original.name;
    return 'Correction';
  }
  if (row.suggestion_type === 'add_link') {
    const d = row.data as { source_id: string; target_id: string };
    const a = nodeNames[d.source_id] ?? d.source_id;
    const b = nodeNames[d.target_id] ?? d.target_id;
    return `${a} → ${b}`;
  }
  if (row.suggestion_type === 'new_node') {
    const d = row.data as { node?: { name?: string } };
    return d.node?.name ?? 'Nouvelle invention';
  }
  if (row.suggestion_type === 'delete_link') {
    const d = row.data as { source_id?: string; target_id?: string };
    const a = nodeNames[d.source_id ?? ''] ?? d.source_id ?? '—';
    const b = nodeNames[d.target_id ?? ''] ?? d.target_id ?? '—';
    return `Supprimer ${a} → ${b}`;
  }
  if (row.suggestion_type === 'anonymous_feedback') {
    const d = row.data as { node_id?: string };
    const nid = d.node_id ?? row.node_id ?? '';
    const n = (nodeNames[nid] ?? nid) || '—';
    return `Retour · ${n}`;
  }
  return 'Suggestion';
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
  const tCommon = useTranslations('common');
  const pushToast = useToastStore((s) => s.pushToast);
  const { isAdmin, isLoading } = useAuthStore();

  const [tab, setTab] = useState<
    'pending' | 'history' | 'contributors' | 'analytics'
  >('pending');
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
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  /** Suggestion ouverte dans le panneau de droite (onglets en attente / historique). */
  const [detailPanelId, setDetailPanelId] = useState<string | null>(null);

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

  const [analyticsPayload, setAnalyticsPayload] =
    useState<AnalyticsPayload | null>(null);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/analytics');
      if (!res.ok) return;
      const j = (await res.json()) as AnalyticsPayload;
      setAnalyticsPayload(j);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAdmin) {
      router.replace(treeInventionPath(getDefaultTreeNodeId()));
      return;
    }
    void loadStats();
    if (tab === 'contributors') void loadContributors();
    else if (tab === 'analytics') void loadAnalytics();
    else void loadSuggestions(tab);
  }, [
    isAdmin,
    isLoading,
    tab,
    router,
    loadSuggestions,
    loadContributors,
    loadStats,
    loadAnalytics,
  ]);

  const removeAfterExit = useCallback((id: string) => {
    setDetailPanelId((cur) => (cur === id ? null : cur));
    setExitingIds((prev) => new Set(prev).add(id));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    window.setTimeout(() => {
      setSuggestions((list) => list.filter((s) => s.id !== id));
      setExitingIds((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      void loadStats();
    }, 300);
  }, [loadStats]);

  const approve = useCallback(
    async (
      id: string,
      overrideProposed?: Record<string, unknown>,
      overrideEditNodeLinkLists?: AdminEditNodeLinkListsOverride
    ) => {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          overrideProposed,
          ...(overrideEditNodeLinkLists !== undefined
            ? { overrideEditNodeLinkLists }
            : {}),
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        pushToast(String(e?.error ?? 'Erreur'), 'error');
        return;
      }
      pushToast(t('toastApproved'), 'success');
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
      removeAfterExit(id);
      if (tab === 'contributors') void loadContributors();
    },
    [pushToast, t, removeAfterExit, tab, loadContributors]
  );

  const finishBulkRemove = useCallback(
    (doneIds: string[]) => {
      if (doneIds.length === 0) return;
      setExitingIds((prev) => {
        const n = new Set(prev);
        for (const id of doneIds) n.add(id);
        return n;
      });
      window.setTimeout(() => {
        setSuggestions((list) => list.filter((s) => !doneIds.includes(s.id)));
        setExitingIds((prev) => {
          const n = new Set(prev);
          for (const id of doneIds) n.delete(id);
          return n;
        });
        setSelectedIds(new Set());
        setDetailPanelId((cur) =>
          cur && doneIds.includes(cur) ? null : cur
        );
        void loadStats();
      }, 300);
    },
    [loadStats]
  );

  const bulkApprove = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkProcessing) return;
    setBulkProcessing(true);
    setBulkProgress(0);
    const successIds: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) successIds.push(id);
      setBulkProgress((i + 1) / ids.length);
    }
    setBulkProcessing(false);
    finishBulkRemove(successIds);
    if (tab === 'contributors') void loadContributors();
    pushToast(`${successIds.length} suggestions approuvées`, 'success');
  }, [
    selectedIds,
    bulkProcessing,
    finishBulkRemove,
    tab,
    loadContributors,
    pushToast,
  ]);

  const bulkReject = useCallback(async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkProcessing) return;
    setBulkProcessing(true);
    setBulkProgress(0);
    const successIds: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, admin_comment: null }),
      });
      if (res.ok) successIds.push(id);
      setBulkProgress((i + 1) / ids.length);
    }
    setBulkProcessing(false);
    finishBulkRemove(successIds);
    if (tab === 'contributors') void loadContributors();
    pushToast(`${successIds.length} suggestions rejetées`, 'success');
  }, [
    selectedIds,
    bulkProcessing,
    finishBulkRemove,
    tab,
    loadContributors,
    pushToast,
  ]);

  const filteredSuggestions = useMemo(() => {
    let list = suggestions;
    if (filter === 'anonymous_users') {
      list = list.filter((s) => s.user_id == null);
    } else if (filter !== 'all') {
      list = list.filter((s) => s.suggestion_type === filter);
    }
    const tierOf = (s: SuggestionRow) =>
      getReliabilityTier(s, s.user_id ? profiles[s.user_id] : undefined);
    const sorted = [...list];
    if (sortKey === 'recent') {
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sortKey === 'reliability') {
      sorted.sort((a, b) => {
        const ra = reliabilitySortRank(tierOf(a));
        const rb = reliabilitySortRank(tierOf(b));
        if (ra !== rb) return ra - rb;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    } else {
      sorted.sort((a, b) => {
        const oa = TYPE_SORT_ORDER[a.suggestion_type] ?? 99;
        const ob = TYPE_SORT_ORDER[b.suggestion_type] ?? 99;
        if (oa !== ob) return oa - ob;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    }
    return sorted;
  }, [suggestions, filter, sortKey, profiles]);

  const selectedDetailRow = useMemo(() => {
    if (!detailPanelId) return null;
    return filteredSuggestions.find((s) => s.id === detailPanelId) ?? null;
  }, [detailPanelId, filteredSuggestions]);

  useEffect(() => {
    if (tab !== 'pending' && tab !== 'history') {
      setDetailPanelId(null);
    }
  }, [tab]);

  useEffect(() => {
    if (!detailPanelId) return;
    if (!filteredSuggestions.some((s) => s.id === detailPanelId)) {
      setDetailPanelId(null);
    }
  }, [detailPanelId, filteredSuggestions]);

  const shortcutTargetId = useMemo(() => {
    if (tab !== 'pending') return null;
    if (filteredSuggestions.length === 1) return filteredSuggestions[0]!.id;
    if (selectedIds.size === 1) return [...selectedIds][0]!;
    return null;
  }, [tab, filteredSuggestions, selectedIds]);

  const pendingVisibleIds = useMemo(
    () => (tab === 'pending' ? filteredSuggestions.map((s) => s.id) : []),
    [tab, filteredSuggestions]
  );

  const allPendingVisibleSelected =
    pendingVisibleIds.length > 0 &&
    pendingVisibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    if (tab !== 'pending' || !shortcutTargetId) return;
    const onKey = (e: KeyboardEvent) => {
      if (bulkProcessing) return;
      const tEl = e.target;
      if (tEl instanceof HTMLElement) {
        if (tEl.closest('input, textarea, select') || tEl.isContentEditable) {
          return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== 'a' && key !== 'r' && key !== 'v') return;
      e.preventDefault();
      const row = suggestions.find((s) => s.id === shortcutTargetId);
      if (!row) return;
      if (key === 'v') {
        const nid = getExploreNodeId(row);
        if (nid) {
          window.open(
            treeInventionPath(nid),
            '_blank',
            'noopener,noreferrer'
          );
        }
        return;
      }
      if (key === 'a') {
        setDetailPanelId(shortcutTargetId);
        return;
      }
      if (key === 'r') {
        void reject(shortcutTargetId, null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    tab,
    shortcutTargetId,
    bulkProcessing,
    suggestions,
    reject,
  ]);

  if (isLoading || !isAdmin) {
    return (
      <AppContentShell
        variant="admin"
        className="flex min-h-[50vh] w-full flex-1 flex-col items-center justify-center text-center text-muted-foreground"
      >
        {tCommon('loading')}
      </AppContentShell>
    );
  }

  const pendingBadge = stats?.pending ?? 0;

  return (
    <AppContentShell
      variant="admin"
      className="flex w-full flex-1 flex-col text-[15px] text-foreground"
    >
      <div className="pb-3">
        <BackToExploreLink />
        <h1
          className="text-xl font-semibold tracking-tight text-foreground md:text-2xl"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          {t('title')}
        </h1>
      </div>

      <div className="border-b border-transparent">
        <div className="flex flex-wrap gap-6">
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`relative pb-2 text-base font-medium ${
              tab === 'pending' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {t('tabPending')}
            {pendingBadge > 0 ? (
              <span
                className="ml-2 inline-block rounded-[8px] bg-red-500 px-[5px] py-[1px] text-[11px] font-semibold leading-tight text-white"
                aria-label={`${pendingBadge}`}
              >
                {pendingBadge}
              </span>
            ) : null}
            {tab === 'pending' ? (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`relative pb-2 text-base font-medium ${
              tab === 'history' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {t('tabHistory')}
            {tab === 'history' ? (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('contributors')}
            className={`relative pb-2 text-base font-medium ${
              tab === 'contributors' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {t('tabContributors')}
            {tab === 'contributors' ? (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTab('analytics')}
            className={`relative pb-2 text-base font-medium ${
              tab === 'analytics' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {t('tabAnalytics')}
            {tab === 'analytics' ? (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
            ) : null}
          </button>
        </div>
      </div>

      {(tab === 'pending' || tab === 'history') && stats ? (
        <div className="grid w-full min-w-0 grid-cols-1 gap-[10px] py-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="flex w-full min-w-0 flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap gap-2">
            {(
              [
                ['all', 'Tout'],
                ['edit_node', 'Corrections'],
                ['add_link', 'Nouveaux liens'],
                ['new_node', 'Nouvelles inventions'],
                ['anonymous_users', 'Anonymes'],
                ['delete_link', 'Suppressions liens'],
                ['anonymous_feedback', 'Retours anonymes'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-[6px] border px-3 py-[5px] text-[13px] ${
                  filter === key
                    ? 'border-accent text-foreground'
                    : 'border-border text-muted-foreground'
                } bg-surface`}
                style={{ borderWidth: '0.5px' }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-[13px] text-muted-foreground">
            <span>Trier par</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-[6px] border border-border bg-surface px-2 py-1.5 text-[13px] text-foreground"
              style={{ borderWidth: '0.5px' }}
            >
              <option value="recent">Plus récentes</option>
              <option value="reliability">Fiabilité</option>
              <option value="type">{t('sortBySuggestionKind')}</option>
            </select>
          </label>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 overflow-x-auto py-4">
        {loading ? (
          <p className="text-muted-foreground">{tCommon('loading')}</p>
        ) : tab === 'analytics' ? (
          analyticsPayload ? (
            <div className="flex min-w-0 flex-col gap-8">
              <div className="grid w-full min-w-0 grid-cols-1 gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  value={analyticsPayload.summary.sessionsToday}
                  color="#6366F1"
                  label={t('analyticsSessionsToday')}
                />
                <StatCard
                  value={analyticsPayload.summary.clicksToday}
                  color="#22C55E"
                  label={t('analyticsClicksToday')}
                />
                <StatCard
                  value={analyticsPayload.summary.searchesToday}
                  color="#F59E0B"
                  label={t('analyticsSearchesToday')}
                />
                <StatCard
                  value={analyticsPayload.summary.sharesToday}
                  color="#EC4899"
                  label={t('analyticsSharesToday')}
                />
              </div>
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  {t('analyticsTopNodes')}
                </h2>
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {analyticsPayload.topNodes.length === 0 ? (
                    <li className="text-muted-foreground">
                      {t('analyticsNoData')}
                    </li>
                  ) : (
                    analyticsPayload.topNodes.map((row, i) => (
                      <li
                        key={row.nodeId}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <Link
                          href={treeInventionPath(row.nodeId)}
                          className="min-w-0 flex-1 truncate text-accent hover:underline"
                        >
                          {row.name}
                        </Link>
                        <span className="shrink-0 text-muted-foreground">
                          {row.count}
                        </span>
                      </li>
                    ))
                  )}
                </ol>
              </section>
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  {t('analyticsTopSearches')}
                </h2>
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {analyticsPayload.topSearches.length === 0 ? (
                    <li className="text-muted-foreground">
                      {t('analyticsNoData')}
                    </li>
                  ) : (
                    analyticsPayload.topSearches.map((row, i) => (
                      <li
                        key={`${row.query}-${i}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {row.query}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {row.count}
                        </span>
                      </li>
                    ))
                  )}
                </ol>
              </section>
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  {t('analyticsPaths')}
                </h2>
                <ul className="space-y-2 text-sm">
                  {analyticsPayload.topPaths.length === 0 ? (
                    <li className="text-muted-foreground">
                      {t('analyticsNoData')}
                    </li>
                  ) : (
                    analyticsPayload.topPaths.map((p) => (
                      <li key={`${p.fromId}-${p.toId}`} className="text-foreground">
                        <span className="font-medium">{p.fromName}</span>
                        {' → '}
                        <span className="font-medium">{p.toName}</span>
                        <span className="ml-2 text-muted-foreground">
                          ({p.count}×)
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </section>
              <section>
                <h2 className="mb-3 text-sm font-semibold text-foreground">
                  {t('analyticsLanguages')}
                </h2>
                {analyticsPayload.languageDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t('analyticsNoData')}
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {analyticsPayload.languageDistribution.map((row) => (
                      <li key={row.locale}>
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>{row.locale}</span>
                          <span>{row.percent}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${Math.min(100, row.percent)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <p className="text-muted-foreground">{t('analyticsNoData')}</p>
          )
        ) : tab === 'contributors' ? (
          <ul className="space-y-2">
            {contributorList.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-3 rounded-lg glass-card px-4 py-3"
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
                  <p className="truncate font-medium text-foreground">
                    {p.display_name ?? p.email ?? p.id}
                  </p>
                  <p className="truncate text-[12px] text-muted-foreground">
                    {p.email}
                  </p>
                </div>
                <span className="rounded-[8px] bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  {p.approved_suggestions}{' '}
                  {p.approved_suggestions <= 1
                    ? 'approuvée'
                    : 'approuvées'}
                </span>
                <span className="rounded-[6px] bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-600">
                  {p.rejected_suggestions}{' '}
                  {p.rejected_suggestions <= 1 ? 'rejetée' : 'rejetées'}
                </span>
                <span className="text-[12px] text-muted-foreground">
                  Inscrit le{' '}
                  {new Date(p.created_at).toLocaleDateString('fr-FR')}
                </span>
              </li>
            ))}
          </ul>
        ) : filteredSuggestions.length === 0 &&
          tab === 'pending' &&
          suggestions.length > 0 ? (
          <p className="py-8 text-center text-[14px] text-muted-foreground">
            Aucune suggestion pour ce filtre.
          </p>
        ) : filteredSuggestions.length === 0 && tab === 'pending' ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ background: 'rgba(34, 197, 94, 0.2)' }}
              aria-hidden
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="#22C55E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="mt-4 text-[16px]" style={{ color: '#5A6175' }}>
              Rien à modérer
            </p>
            <p
              className="mt-1 max-w-sm text-center text-[13px]"
              style={{ color: '#3D4555' }}
            >
              Les nouvelles suggestions apparaîtront ici
            </p>
            <Link
              href={treeInventionPath(getDefaultTreeNodeId())}
              className="mt-4 text-[13px] hover:underline"
              style={{ color: '#3B82F6' }}
            >
              Explorer le Tree →
            </Link>
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <p className="text-muted-foreground">{t('noSuggestions')}</p>
        ) : (
          <div className="relative flex min-w-0 flex-col gap-4 pb-10 xl:flex-row xl:items-start xl:gap-6">
            <div className="relative min-w-0 flex-1">
              {tab === 'pending' && selectedIds.size > 0 ? (
                <div
                  className="mb-3 flex flex-wrap items-center gap-3 px-[14px] py-2"
                  style={{
                    background: '#111827',
                    border: '0.5px solid rgba(59, 130, 246, 0.13)',
                    borderRadius: 8,
                  }}
                >
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#8B95A8]">
                    <input
                      type="checkbox"
                      className="h-[14px] w-[14px] cursor-pointer rounded-[3px] border border-[#2A3042] bg-transparent accent-[#22C55E]"
                      checked={allPendingVisibleSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = !allPendingVisibleSelected && selectedIds.size > 0;
                      }}
                      onChange={() => {
                        if (allPendingVisibleSelected) {
                          setSelectedIds(new Set());
                        } else {
                          setSelectedIds(new Set(pendingVisibleIds));
                        }
                      }}
                    />
                    Tout sélectionner
                  </label>
                  <span className="text-[13px] text-[#8B95A8]">
                    {selectedIds.size} sélectionnées
                  </span>
                  <button
                    type="button"
                    disabled={bulkProcessing}
                    onClick={() => void bulkApprove()}
                  className="rounded px-2 py-1 text-[12px] font-medium text-white disabled:opacity-50"
                  style={{ background: '#22C55E' }}
                  >
                    Tout approuver
                  </button>
                  <button
                    type="button"
                    disabled={bulkProcessing}
                    onClick={() => void bulkReject()}
                  className="rounded border px-2 py-1 text-[12px] font-medium text-[#EF4444] disabled:opacity-50"
                  style={{ borderColor: '#EF4444' }}
                  >
                    Tout rejeter
                  </button>
                  {bulkProcessing ? (
                    <div className="h-1 min-w-[120px] flex-1 overflow-hidden rounded-full bg-[#1F2937]">
                      <div
                        className="h-full rounded-full bg-[#22C55E] transition-[width] duration-200"
                        style={{ width: `${Math.round(bulkProgress * 100)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-border bg-surface-elevated/40">
                      {tab === 'pending' ? (
                        <th className="w-10 px-2 py-2" scope="col">
                          <span className="sr-only">{t('tableSelectColumn')}</span>
                        </th>
                      ) : null}
                      <th className="px-3 py-2 font-medium text-muted-foreground" scope="col">
                        {t('tableColInvention')}
                      </th>
                      <th className="px-3 py-2 font-medium text-muted-foreground" scope="col">
                        {t('tableColContributor')}
                      </th>
                    <th className="px-3 py-2 font-medium text-muted-foreground" scope="col">
                      {t('tableColDate')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuggestions.map((s) => {
                      const p = s.user_id ? profiles[s.user_id] : undefined;
                      const title = getSuggestionCardTitle(s, nodeNames);
                      const dateIso =
                        tab === 'history'
                          ? (s.reviewed_at ?? s.created_at)
                          : s.created_at;
                      const contrib =
                        s.user_id == null
                          ? s.contributor_ip
                            ? `${t('anonymousContributor')} (${s.contributor_ip})`
                            : t('anonymousContributor')
                          : compactDisplayName(
                              p?.display_name ?? p?.email
                            ) || (p?.email ?? s.user_id);
                      const rowSelected = detailPanelId === s.id;
                      return (
                        <tr
                          key={s.id}
                          tabIndex={0}
                          aria-label={t('tableRowOpenPanel', { title })}
                          onClick={() => setDetailPanelId(s.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setDetailPanelId(s.id);
                            }
                          }}
                          className={`cursor-pointer border-b border-border/60 transition-colors transition-opacity duration-300 hover:bg-muted/30 focus-visible:outline focus-visible:ring-2 focus-visible:ring-accent ${
                            exitingIds.has(s.id) ? 'opacity-40' : ''
                          } ${rowSelected ? 'bg-accent/10' : ''}`}
                        >
                          {tab === 'pending' ? (
                            <td className="px-2 py-2 align-top">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(s.id)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() => {
                                  setSelectedIds((prev) => {
                                    const n = new Set(prev);
                                    if (n.has(s.id)) n.delete(s.id);
                                    else n.add(s.id);
                                    return n;
                                  });
                                }}
                                className="h-[14px] w-[14px] cursor-pointer rounded-[3px] border border-[#2A3042] bg-transparent accent-[#22C55E]"
                                aria-label={t('tableSelectRow')}
                              />
                            </td>
                          ) : null}
                          <td className="max-w-[220px] px-3 py-2 align-top font-medium text-foreground">
                            <span className="line-clamp-2">{title}</span>
                          </td>
                          <td className="max-w-[180px] px-3 py-2 align-top text-muted-foreground">
                            <span className="line-clamp-2">{contrib}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 align-top text-muted-foreground">
                            {formatRelativeFr(dateIso)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {tab === 'pending' && shortcutTargetId ? (
                <p
                  className="pointer-events-none fixed bottom-4 right-4 z-10 max-w-[min(100vw-2rem,22rem)] text-[12px] xl:right-[min(28rem,42vw)]"
                  style={{ color: '#3D4555' }}
                >
                  {t('keyboardHintOpenRejectView')}
                </p>
              ) : null}
            </div>
            <aside
              className="w-full shrink-0 rounded-lg border border-border bg-surface-elevated/30 p-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-3rem)] xl:w-[min(420px,38vw)] xl:max-w-[480px] xl:overflow-y-auto"
              aria-label={t('panelApprovalAria')}
            >
              <AdminSuggestionApprovalPanel
                key={detailPanelId ?? 'none'}
                row={selectedDetailRow}
                nodeNames={nodeNames}
                listTotalCount={filteredSuggestions.length}
                onResolved={removeAfterExit}
              />
            </aside>
          </div>
        )}
      </main>
    </AppContentShell>
  );
}

function AdminSuggestionApprovalPanel({
  row,
  nodeNames,
  listTotalCount,
  onResolved,
}: {
  row: SuggestionRow | null;
  nodeNames: Record<string, string>;
  /** Nombre de suggestions dans la liste courante (filtre + onglet). */
  listTotalCount: number;
  onResolved: (id: string) => void;
}) {
  const t = useTranslations('admin');
  const pushToast = useToastStore((s) => s.pushToast);
  const [editDraft, setEditDraft] = useState<Record<string, unknown> | null>(
    () => (row ? initSuggestionEditDraft(row) : null)
  );
  const [adminComment, setAdminComment] = useState('');
  const [busy, setBusy] = useState(false);
  const cardPreviewUrl = useAdminSuggestionCardImageUrl(row);
  const contributorNote = row
    ? getContributorFacingMessageFromSuggestion(row)
    : null;
  const contributorContactHint = row
    ? getContributorContactHintFromSuggestion(row)
    : null;

  useEffect(() => {
    if (!row) {
      setEditDraft(null);
      setAdminComment('');
      return;
    }
    setEditDraft(initSuggestionEditDraft(row));
    setAdminComment('');
  }, [row]);

  const runApprove = useCallback(async () => {
    if (!row || row.status !== 'pending' || !editDraft) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        id: row.id,
        admin_comment: adminComment.trim() || null,
      };

      if (row.suggestion_type === 'edit_node') {
        const raw = { ...editDraft };
        const removed = raw[ADMIN_DRAFT_REMOVED_IDS];
        const adds = raw[ADMIN_DRAFT_PROPOSED_ADD];
        delete raw[ADMIN_DRAFT_REMOVED_IDS];
        delete raw[ADMIN_DRAFT_PROPOSED_ADD];
        const o = { ...raw };
        if (typeof o.year_approx === 'string') {
          o.year_approx =
            o.year_approx.trim() === '' ? null : Number(o.year_approx);
        }
        if (typeof o.tags === 'string') {
          o.tags = o.tags
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
        }
        const removedIds = Array.isArray(removed)
          ? removed.map((x) => String(x))
          : [];
        const proposedAdds = sanitizeAdminProposedAddLinks(adds);
        body.overrideProposed = o;
        body.overrideEditNodeLinkLists = {
          removedLinkIds: removedIds,
          proposedAddLinks: proposedAdds,
        } satisfies AdminEditNodeLinkListsOverride;
      } else if (
        row.suggestion_type === 'add_link' ||
        row.suggestion_type === 'new_node'
      ) {
        body.overrideProposed = editDraft;
      }

      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        pushToast(String(e?.error ?? t('detailLoadError')), 'error');
        return;
      }
      pushToast(t('toastApproved'), 'success');
      onResolved(row.id);
    } finally {
      setBusy(false);
    }
  }, [adminComment, editDraft, onResolved, pushToast, row, t]);

  const runReject = useCallback(async () => {
    if (!row || row.status !== 'pending') return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          admin_comment: adminComment.trim() || null,
        }),
      });
      if (!res.ok) {
        pushToast(t('detailLoadError'), 'error');
        return;
      }
      pushToast(t('toastRejected'), 'success');
      onResolved(row.id);
    } finally {
      setBusy(false);
    }
  }, [adminComment, onResolved, pushToast, row, t]);

  if (!row) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center px-2 text-center">
        <p className="text-[15px] text-muted-foreground">
          {t('panelSelectSuggestion')}
        </p>
      </div>
    );
  }

  const readOnly = row.status !== 'pending';
  const exploreId = getExploreNodeId(row);
  const isAnonFeedback = row.suggestion_type === 'anonymous_feedback';
  const cardTitle = getSuggestionCardTitle(row, nodeNames);
  const headline =
    row.suggestion_type === 'edit_node'
      ? `${cardTitle} — ${t('editNodeCorrectionTitle')}`
      : cardTitle;

  return (
    <div className="space-y-4 text-[15px]">
      {contributorNote ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 p-4 sm:p-5 ring-1 ring-amber-500/20">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
            {t('contributorMessageLabel')}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-foreground">
            {contributorNote}
          </p>
          {contributorContactHint ? (
            <p className="mt-3 text-[12px] text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {t('contributorContactEmailLabel')}
              </span>{' '}
              {contributorContactHint}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-xl border border-border/60 bg-surface/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-3 sm:gap-4">
          {cardPreviewUrl ? (
            <div className="w-[min(128px,32vw)] shrink-0 overflow-hidden rounded-lg border border-border bg-page">
              {/* eslint-disable-next-line @next/next/no-img-element -- URL dynamique graphe / stockage */}
              <img
                src={cardPreviewUrl}
                alt=""
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <h2
                className="text-[15px] font-bold leading-snug text-foreground"
                style={{
                  fontFamily:
                    'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
                }}
              >
                {headline}
              </h2>
              {exploreId ? (
                <a
                  href={treeInventionPath(exploreId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-surface text-muted-foreground transition-colors hover:bg-muted/25 hover:text-foreground"
                  aria-label={t('panelViewInTreeAria')}
                  title={t('panelViewInTreeAria')}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </a>
              ) : null}
            </div>
            <p className="text-[13px] text-muted-foreground">
              {row.suggestion_type} ·{' '}
              {new Date(row.created_at).toLocaleString()}
              {' · '}
              {t('panelListTotal', { count: listTotalCount })}
            </p>
          </div>
        </div>
      </div>
      <AdminSuggestionFormBody
        row={row}
        nodeNames={nodeNames}
        isEditing={!readOnly}
        editDraft={editDraft}
        onEditDraftChange={setEditDraft}
        moderationUi
        editNodeMode={row.suggestion_type === 'edit_node' ? 'full' : 'diff'}
        readOnly={readOnly}
        comfortableText
        suggestedFieldHighlight
      />
      {!readOnly ? (
        <div className="space-y-3 border-t border-border pt-3">
          <label className="block text-[14px] text-muted-foreground">
            {t('adminCommentLabel')}
            <textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[15px] text-foreground"
              placeholder={t('adminCommentPlaceholder')}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runApprove()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-[15px] font-medium text-white disabled:opacity-50"
            >
              {isAnonFeedback ? t('archiveAnonymous') : t('approve')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runReject()}
              className="rounded-md border border-red-600 px-4 py-2 text-[15px] font-medium text-red-600 disabled:opacity-50"
            >
              {isAnonFeedback ? t('ignoreAnonymous') : t('reject')}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border pt-3 text-[14px] text-muted-foreground">
          {row.status === 'approved' ? t('approved') : t('rejected')}
          {row.admin_comment ? (
            <p className="mt-2 italic">{row.admin_comment}</p>
          ) : null}
        </div>
      )}
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
    <div className="rounded-[8px] bg-surface px-3 py-3 text-center">
      <p className="text-[22px] font-medium" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[12px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function AdminSuggestionFormBody({
  row,
  nodeNames,
  isEditing,
  editDraft,
  onEditDraftChange,
  moderationUi = false,
  editNodeMode = 'diff',
  readOnly = false,
  comfortableText = false,
  suggestedFieldHighlight = false,
}: {
  row: SuggestionRow;
  nodeNames: Record<string, string>;
  isEditing: boolean;
  editDraft: Record<string, unknown> | null;
  onEditDraftChange: (d: Record<string, unknown>) => void;
  moderationUi?: boolean;
  editNodeMode?: 'diff' | 'full';
  readOnly?: boolean;
  /** +2px sur les corps de texte (panneau admin à droite). */
  comfortableText?: boolean;
  /** Champs effectivement proposés / modifiés en orange. */
  suggestedFieldHighlight?: boolean;
}) {
  const ta = useTranslations('admin');
  const tRel = useTranslations('relationTypes');
  const locale = useLocale();
  const tEditor = useTranslations('editor');
  const tCat = useTranslations('categories');
  const tExplore = useTranslations('explore');
  const tSidebar = useTranslations('sidebar');

  const fieldLabel = (key: string) =>
    ta(`field_${key}` as Parameters<typeof ta>[0]);
  const relLabel = (code: string) =>
    tRel(code as Parameters<typeof tRel>[0]);

  /** Libellés alignés sur `SuggestionNodeForm` / modal ajout de carte. */
  const getSuggestFormFieldLabel = (key: string): string => {
    switch (key) {
      case 'name':
        return tEditor('name');
      case 'name_en':
        return tEditor('nameEn');
      case 'year_approx':
        return tEditor('date');
      case 'category':
        return tEditor('category');
      case 'naturalOrigin':
        return tExplore('suggestNaturalOriginLabel');
      case 'chemicalNature':
        return tExplore('suggestChemicalNatureLabel');
      case 'tags':
        return tExplore('detailTagsHeading');
      case 'era':
        return tEditor('era');
      case 'origin':
        return tEditor('origin');
      case 'description':
        return tSidebar('description');
      case 'description_en':
        return tEditor('descriptionEn');
      case 'dimension':
        return tEditor('labelDimension');
      case 'materialLevel':
        return tEditor('labelMaterialLevel');
      case 'wikipedia_url':
        return tEditor('wikipediaUrl');
      default:
        return fieldLabel(key);
    }
  };

  const data = row.data;

  if (row.suggestion_type === 'edit_node') {
    const d = data as {
      original?: Record<string, unknown>;
      proposed?: Record<string, unknown>;
      diff?: Record<string, { from: unknown; to: unknown }>;
      linkDiff?: Record<string, { from: LinkSnap; to: LinkSnap }>;
      linkContext?: Record<
        string,
        { peerName: string; section: 'ledTo' | 'builtUpon'; peerId?: string }
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

    if (!readOnly && isEditing && editDraft) {
      const draft = editDraft as Record<string, unknown>;
      const draftLinkEdits =
        (draft.linkEdits as Record<string, LinkSnap> | undefined) ?? {};
      const draftAdds = Array.isArray(draft[ADMIN_DRAFT_PROPOSED_ADD])
        ? (draft[ADMIN_DRAFT_PROPOSED_ADD] as Record<string, unknown>[])
        : [];

      const fieldValue = (key: string): string => {
        const v = draft[key];
        if (key === 'tags' && Array.isArray(v)) {
          return v.map(String).join(', ');
        }
        if (key === 'year_approx' && (v === null || v === undefined)) {
          return '';
        }
        if (key === 'year_approx' && typeof v === 'number') {
          return String(v);
        }
        return String(v ?? '');
      };
      const setField = (key: string, val: string) => {
        if (key === 'tags') {
          onEditDraftChange({
            ...draft,
            [key]: val
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          });
          return;
        }
        if (key === 'year_approx') {
          const trimmed = val.trim();
          onEditDraftChange({
            ...draft,
            year_approx: trimmed === '' ? null : Number(trimmed),
          });
          return;
        }
        onEditDraftChange({ ...draft, [key]: val });
      };

      const origRecord = stripLinkEditsFromPayload(orig) as Record<string, unknown>;
      const origFieldDisplay = (key: string): string => {
        const v = origRecord[key];
        if (key === 'tags') {
          if (Array.isArray(v) && v.length > 0) {
            return v.map(String).join(', ');
          }
          return '—';
        }
        if (key === 'year_approx') {
          if (v === null || v === undefined) return '—';
          return String(v);
        }
        if (key === 'category') {
          const s = typeof v === 'string' ? v : '';
          if (!s) return '—';
          return NODE_CATEGORY_ORDER.includes(s as NodeCategory)
            ? tCat(s as NodeCategory)
            : s;
        }
        if (key === 'era') {
          const s = typeof v === 'string' ? v : '';
          if (!s) return '—';
          return ERA_ORDER.includes(s as Era)
            ? eraLabelFromMessages(locale, s as Era)
            : s;
        }
        if (key === 'dimension') {
          const s = typeof v === 'string' ? v : '';
          if (!s) return '—';
          return DIMENSION_ORDER.includes(s as (typeof DIMENSION_ORDER)[number])
            ? tEditor(EDITOR_DIM_KEY[s as keyof typeof EDITOR_DIM_KEY])
            : s;
        }
        if (key === 'materialLevel') {
          const s = typeof v === 'string' ? v : '';
          if (!s) return '—';
          return MATERIAL_LEVEL_ORDER.includes(
            s as (typeof MATERIAL_LEVEL_ORDER)[number]
          )
            ? tEditor(EDITOR_LEVEL_KEY[s as keyof typeof EDITOR_LEVEL_KEY])
            : s;
        }
        if (key === 'naturalOrigin') {
          const s = typeof v === 'string' ? v : '';
          if (!s) return '—';
          return NATURAL_ORIGIN_ORDER.includes(s as (typeof NATURAL_ORIGIN_ORDER)[number])
            ? tExplore(
                `suggestNaturalOrigin_${s}` as Parameters<typeof tExplore>[0]
              )
            : s;
        }
        if (key === 'chemicalNature') {
          const s = typeof v === 'string' ? v : '';
          if (!s) return '—';
          return CHEMICAL_NATURE_ORDER.includes(s as (typeof CHEMICAL_NATURE_ORDER)[number])
            ? tExplore(
                `suggestChemicalNature_${s}` as Parameters<typeof tExplore>[0]
              )
            : s;
        }
        if (key === 'origin_type') {
          const s = typeof v === 'string' ? v : '';
          if (!s) return '—';
          const opts = ['mineral', 'vegetal', 'animal'] as const;
          const lab: Record<(typeof opts)[number], Parameters<typeof tExplore>[0]> =
            {
              mineral: 'originTypeMineral',
              vegetal: 'originTypeVegetal',
              animal: 'originTypeAnimal',
            };
          return opts.includes(s as (typeof opts)[number])
            ? tExplore(lab[s as (typeof opts)[number]])
            : s;
        }
        if (key === 'nature_type') {
          const s = typeof v === 'string' ? v : '';
          if (!s) return '—';
          const opts = ['element', 'compose', 'materiau'] as const;
          const lab: Record<(typeof opts)[number], Parameters<typeof tExplore>[0]> =
            {
              element: 'natureTypeElement',
              compose: 'natureTypeCompose',
              materiau: 'natureTypeMateriau',
            };
          return opts.includes(s as (typeof opts)[number])
            ? tExplore(lab[s as (typeof opts)[number]])
            : s;
        }
        if (v === null || v === undefined) return '—';
        const str = String(v).trim();
        return str === '' ? '—' : str;
      };

      const nodeFieldKeysDiff = Object.keys(nodeDiff);

      const isKeySuggested = (key: string) =>
        suggestedFieldHighlight &&
        Object.prototype.hasOwnProperty.call(nodeDiff, key);

      const fieldInputClass = (key: string) =>
        suggestInputClass({
          suggested: isKeySuggested(key),
          comfortableText,
        });

      const fieldSelectClass = (key: string) =>
        suggestSelectClass({
          suggested: isKeySuggested(key),
          comfortableText,
        });

      const natureSuggested =
        suggestedFieldHighlight &&
        (Object.prototype.hasOwnProperty.call(nodeDiff, 'naturalOrigin') ||
          Object.prototype.hasOwnProperty.call(nodeDiff, 'chemicalNature'));

      const linkFieldClass = () => {
        const size = comfortableText ? 'text-[14px]' : 'text-[12px]';
        if (suggestedFieldHighlight) {
          return `mt-1 w-full rounded border border-orange-500/50 bg-orange-950/25 px-2 py-1 ${size} text-orange-200`;
        }
        return `mt-1 w-full rounded border border-border bg-surface px-2 py-1 ${size} text-foreground`;
      };

      const sectionTitleClass = () =>
        `${
          comfortableText ? 'text-[13px]' : 'text-[11px]'
        } font-semibold uppercase tracking-wide text-muted-foreground`;

      const emptySelectLabel =
        editNodeMode === 'full' ? '—' : ta('field_empty');

      const renderNodeFieldControl = (key: string) => {
        if (key === 'tags') {
          return (
            <SuggestionTagsField
              tagsCsv={fieldValue('tags')}
              onTagsCsvChange={(csv) => setField('tags', csv)}
              dirty={false}
              suggested={isKeySuggested('tags')}
              comfortableText={comfortableText}
            />
          );
        }
        if (key === 'category') {
          const v = fieldValue('category') || PRIMARY_CARD_CATEGORY_ORDER[0];
          return (
            <select
              className={fieldSelectClass(key)}
              value={
                PRIMARY_CARD_CATEGORY_ORDER.includes(v as NodeCategory)
                  ? v
                  : PRIMARY_CARD_CATEGORY_ORDER[0]
              }
              onChange={(e) =>
                onEditDraftChange({ ...draft, category: e.target.value })
              }
            >
              {PRIMARY_CARD_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {tCat(c)}
                </option>
              ))}
            </select>
          );
        }
        if (key === 'era') {
          const v = fieldValue('era') || ERA_ORDER[0];
          return (
            <select
              className={fieldSelectClass(key)}
              value={ERA_ORDER.includes(v as (typeof ERA_ORDER)[number]) ? v : ERA_ORDER[0]}
              onChange={(e) =>
                onEditDraftChange({ ...draft, era: e.target.value })
              }
            >
              {ERA_ORDER.map((er) => (
                <option key={er} value={er}>
                  {eraLabelFromMessages(locale, er)}
                </option>
              ))}
            </select>
          );
        }
        if (key === 'dimension') {
          const cur = fieldValue('dimension');
          return (
            <select
              className={fieldSelectClass(key)}
              value={cur}
              onChange={(e) =>
                onEditDraftChange({
                  ...draft,
                  dimension: e.target.value,
                })
              }
            >
              <option value="">{ta('field_empty')}</option>
              {DIMENSION_ORDER.map((dim) => (
                <option key={dim} value={dim}>
                  {tEditor(EDITOR_DIM_KEY[dim])}
                </option>
              ))}
            </select>
          );
        }
        if (key === 'materialLevel') {
          const cur = fieldValue('materialLevel');
          return (
            <select
              className={fieldSelectClass(key)}
              value={cur}
              onChange={(e) =>
                onEditDraftChange({
                  ...draft,
                  materialLevel: e.target.value,
                })
              }
            >
              <option value="">{ta('field_empty')}</option>
              {MATERIAL_LEVEL_ORDER.map((lv) => (
                <option key={lv} value={lv}>
                  {tEditor(EDITOR_LEVEL_KEY[lv])}
                </option>
              ))}
            </select>
          );
        }
        if (key === 'naturalOrigin') {
          const cur = fieldValue('naturalOrigin');
          return (
            <select
              className={fieldSelectClass(key)}
              value={cur}
              onChange={(e) =>
                onEditDraftChange({
                  ...draft,
                  naturalOrigin: e.target.value,
                })
              }
            >
              <option value="">{emptySelectLabel}</option>
              {NATURAL_ORIGIN_ORDER.map((no) => (
                <option key={no} value={no}>
                  {tExplore(
                    `suggestNaturalOrigin_${no}` as Parameters<typeof tExplore>[0]
                  )}
                </option>
              ))}
            </select>
          );
        }
        if (key === 'chemicalNature') {
          const cur = fieldValue('chemicalNature');
          return (
            <select
              className={fieldSelectClass(key)}
              value={cur}
              onChange={(e) =>
                onEditDraftChange({
                  ...draft,
                  chemicalNature: e.target.value,
                })
              }
            >
              <option value="">{emptySelectLabel}</option>
              {CHEMICAL_NATURE_ORDER.map((cn) => (
                <option key={cn} value={cn}>
                  {tExplore(
                    `suggestChemicalNature_${cn}` as Parameters<typeof tExplore>[0]
                  )}
                </option>
              ))}
            </select>
          );
        }
        if (key === 'origin_type') {
          const cur = fieldValue('origin_type');
          const opts = ['mineral', 'vegetal', 'animal'] as const;
          const lab: Record<(typeof opts)[number], Parameters<typeof tExplore>[0]> =
            {
              mineral: 'originTypeMineral',
              vegetal: 'originTypeVegetal',
              animal: 'originTypeAnimal',
            };
          return (
            <select
              className={fieldSelectClass(key)}
              value={opts.includes(cur as (typeof opts)[number]) ? cur : ''}
              onChange={(e) =>
                onEditDraftChange({ ...draft, origin_type: e.target.value })
              }
            >
              <option value="">{ta('field_empty')}</option>
              {opts.map((o) => (
                <option key={o} value={o}>
                  {tExplore(lab[o])}
                </option>
              ))}
            </select>
          );
        }
        if (key === 'nature_type') {
          const cur = fieldValue('nature_type');
          const opts = ['element', 'compose', 'materiau'] as const;
          const lab: Record<(typeof opts)[number], Parameters<typeof tExplore>[0]> =
            {
              element: 'natureTypeElement',
              compose: 'natureTypeCompose',
              materiau: 'natureTypeMateriau',
            };
          return (
            <select
              className={fieldSelectClass(key)}
              value={opts.includes(cur as (typeof opts)[number]) ? cur : ''}
              onChange={(e) =>
                onEditDraftChange({ ...draft, nature_type: e.target.value })
              }
            >
              <option value="">{ta('field_empty')}</option>
              {opts.map((o) => (
                <option key={o} value={o}>
                  {tExplore(lab[o])}
                </option>
              ))}
            </select>
          );
        }
        if (key === 'description' || key === 'description_en') {
          const fullDesc = editNodeMode === 'full' && key === 'description';
          return (
            <textarea
              className={
                fullDesc
                  ? fieldInputClass(key)
                  : `${fieldInputClass(key)} min-h-[72px]`
              }
              rows={fullDesc ? 5 : undefined}
              value={fieldValue(key)}
              onChange={(e) => setField(key, e.target.value)}
            />
          );
        }
        return (
          <input
            type="text"
            className={fieldInputClass(key)}
            value={fieldValue(key)}
            onChange={(e) => setField(key, e.target.value)}
          />
        );
      };

      const renderFieldRow = (key: string) => {
        if (key === 'materialLevel') {
          const dim = String(draft.dimension ?? '');
          if (dim !== 'matter') return null;
        }
        const inDiff = Object.prototype.hasOwnProperty.call(nodeDiff, key);
        const ghost =
          editNodeMode === 'full' && !inDiff
            ? 'rounded-md border border-border/60 bg-surface/30 px-3 py-2'
            : '';
        const useAddCard =
          editNodeMode === 'full' &&
          (SUGGEST_ADD_CARD_NODE_KEYS as readonly string[]).includes(key);
        const labelClass = useAddCard
          ? key === 'tags'
            ? suggestFormLabelSectionClass(comfortableText)
            : suggestFormLabelClass(comfortableText)
          : suggestFormLabelClass(comfortableText);
        const labelText = useAddCard
          ? getSuggestFormFieldLabel(key)
          : fieldLabel(key);

        return (
          <div key={key} className={ghost || undefined}>
            <label className={labelClass}>
              {labelText}
              {editNodeMode === 'full' && !inDiff ? (
                <span
                  className={`ml-1 ${
                    comfortableText ? 'text-[12px]' : 'text-[10px]'
                  } text-muted-foreground/80`}
                >
                  ({ta('fieldUnchangedHint')})
                </span>
              ) : null}
            </label>
            {suggestedFieldHighlight ? (
              <p
                className={`mb-1.5 ${
                  comfortableText ? 'text-[13px]' : 'text-[11px]'
                } text-muted-foreground`}
              >
                <span className="font-medium text-foreground/85">
                  {ta('fieldCurrentCard')}
                </span>{' '}
                <span className="whitespace-pre-wrap break-words">
                  {origFieldDisplay(key)}
                </span>
              </p>
            ) : null}
            {key === 'era' && editNodeMode === 'full' ? (
              <p
                className={`mb-1.5 ${
                  comfortableText ? 'text-[12px]' : 'text-[10px]'
                } text-muted-foreground`}
              >
                {tExplore('suggestEraHint')}
              </p>
            ) : null}
            {renderNodeFieldControl(key)}
          </div>
        );
      };

      const tagsUnchangedInFull =
        editNodeMode === 'full' &&
        !Object.prototype.hasOwnProperty.call(nodeDiff, 'tags');

      return (
        <div className="space-y-4">
          {moderationUi && editNodeMode === 'full' ? null : (
            <p
              className={`${
                comfortableText ? 'text-[15px]' : 'text-[13px]'
              } font-bold text-foreground`}
            >
              {nodeName} — {ta('editNodeCorrectionTitle')}
            </p>
          )}
          <div
            className={
              editNodeMode === 'full'
                ? 'space-y-4 rounded-xl border border-border/60 bg-surface/40 p-4 sm:p-5'
                : 'space-y-2 rounded-xl border border-border/60 bg-surface/40 p-4'
            }
          >
            {editNodeMode === 'full' ? (
              <>
                {renderFieldRow('name')}
                {renderFieldRow('name_en')}
                {renderFieldRow('year_approx')}
                {renderFieldRow('category')}
                <div
                  className={suggestNatureBlockWrapClass({
                    suggested: natureSuggested,
                  })}
                >
                  <p
                    className={suggestFormNatureSectionTitleClass(
                      comfortableText
                    )}
                  >
                    {tExplore('detailTagNature')}
                  </p>
                  <div className="space-y-3">
                    {renderFieldRow('naturalOrigin')}
                    {renderFieldRow('chemicalNature')}
                  </div>
                </div>
                <div
                  className={
                    tagsUnchangedInFull
                      ? suggestNatureBlockWrapClass({ suggested: false })
                      : undefined
                  }
                >
                  <label className={suggestFormLabelSectionClass(comfortableText)}>
                    {tExplore('detailTagsHeading')}
                    {tagsUnchangedInFull ? (
                      <span
                        className={`ml-1 ${
                          comfortableText ? 'text-[12px]' : 'text-[10px]'
                        } text-muted-foreground/80`}
                      >
                        ({ta('fieldUnchangedHint')})
                      </span>
                    ) : null}
                  </label>
                  {suggestedFieldHighlight ? (
                    <p
                      className={`mb-1.5 ${
                        comfortableText ? 'text-[13px]' : 'text-[11px]'
                      } text-muted-foreground`}
                    >
                      <span className="font-medium text-foreground/85">
                        {ta('fieldCurrentCard')}
                      </span>{' '}
                      <span className="whitespace-pre-wrap break-words">
                        {origFieldDisplay('tags')}
                      </span>
                    </p>
                  ) : null}
                  {renderNodeFieldControl('tags')}
                </div>
                {renderFieldRow('era')}
                {renderFieldRow('origin')}
                {renderFieldRow('description')}
                {renderFieldRow('description_en')}
                {renderFieldRow('dimension')}
                {renderFieldRow('materialLevel')}
                {renderFieldRow('wikipedia_url')}
                <p
                  className={`${
                    comfortableText ? 'text-[12px]' : 'text-[10px]'
                  } font-semibold uppercase tracking-wide text-muted-foreground pt-1`}
                >
                  {ta('adminExtraNodeFields')}
                </p>
                {EDIT_NODE_EXTRA_KEYS_AFTER_ADD_CARD.map((k) =>
                  renderFieldRow(k)
                )}
              </>
            ) : (
              nodeFieldKeysDiff.map((key) => renderFieldRow(key))
            )}
          </div>

          {Object.keys(linkDiff).length > 0 ? (
            <div className="space-y-2 rounded-xl border border-border/60 bg-surface/40 p-4 sm:p-5">
              <p className={sectionTitleClass()}>
                Liens (Led to / Built upon)
              </p>
              <ul className="space-y-3">
                {Object.entries(linkDiff).map(([linkId, ch]) => {
                  const chTyped = ch as { from?: LinkSnap; to?: LinkSnap };
                  const snap =
                    draftLinkEdits[linkId] ?? chTyped.to;
                  if (!snap) return null;
                  const ctx = linkContext[linkId];
                  const sectionLabel =
                    ctx?.section === 'builtUpon'
                      ? 'Built upon'
                      : ctx?.section === 'ledTo'
                        ? 'Led to'
                        : 'Lien';
                  return (
                    <li
                      key={linkId}
                      className="rounded border border-border/50 bg-surface-elevated/30 p-2"
                    >
                      <p
                        className={`mb-2 ${
                          comfortableText ? 'text-[13px]' : 'text-[11px]'
                        } text-muted-foreground`}
                      >
                        {sectionLabel} · {ctx?.peerName ?? linkId}
                      </p>
                      {suggestedFieldHighlight && chTyped.from ? (
                        <p
                          className={`mb-2 ${
                            comfortableText ? 'text-[13px]' : 'text-[11px]'
                          } text-muted-foreground`}
                        >
                          <span className="font-medium text-foreground/85">
                            {ta('fieldCurrentCard')}
                          </span>{' '}
                          <span className="whitespace-pre-wrap">
                            {formatLinkSnapLine(chTyped.from, relLabel)}
                          </span>
                        </p>
                      ) : null}
                      <p
                        className={`mb-2 ${
                          comfortableText ? 'text-[13px]' : 'text-[11px]'
                        } text-muted-foreground`}
                      >
                        {relLabel(
                          VALID_RELATIONS.has(snap.relation_type)
                            ? snap.relation_type
                            : RelationType.MATERIAL
                        )}
                      </p>
                      <label
                        className={`mb-2 block ${
                          comfortableText ? 'text-[13px]' : 'text-[11px]'
                        } text-muted-foreground`}
                      >
                        {ta('field_link_notes')}
                        <input
                          className={linkFieldClass()}
                          value={snap.notes ?? ''}
                          onChange={(e) => {
                            onEditDraftChange({
                              ...draft,
                              linkEdits: {
                                ...draftLinkEdits,
                                [linkId]: { ...snap, notes: e.target.value },
                              },
                            });
                          }}
                        />
                      </label>
                      <label
                        className={`flex items-center gap-2 ${
                          comfortableText ? 'text-[14px]' : 'text-[12px]'
                        } text-muted-foreground`}
                      >
                        <input
                          type="checkbox"
                          className={
                            suggestedFieldHighlight
                              ? 'accent-orange-500'
                              : undefined
                          }
                          checked={Boolean(snap.is_optional)}
                          onChange={(e) => {
                            onEditDraftChange({
                              ...draft,
                              linkEdits: {
                                ...draftLinkEdits,
                                [linkId]: {
                                  ...snap,
                                  is_optional: e.target.checked,
                                },
                              },
                            });
                          }}
                        />
                        {ta('field_link_optional')}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4 sm:p-5">
            <p className={sectionTitleClass()}>
              {ta('editNodeLinksSuggestionSection')}
            </p>
            {row.node_id ? (
              <AdminEditNodeAddLinkSearches
                currentNodeId={row.node_id}
                draft={draft}
                draftAdds={draftAdds}
                onEditDraftChange={onEditDraftChange}
                nodeNames={nodeNames}
                linkContext={linkContext}
                origLinkEdits={origLinkEdits}
              />
            ) : (
              <p
                className={
                  comfortableText ? 'text-[14px] text-muted-foreground' : 'text-[12px] text-muted-foreground'
                }
              >
                node_id manquant — impossible d&apos;ajouter un lien ici.
              </p>
            )}
          </div>
        </div>
      );
    }

    if (moderationUi && (!isEditing || readOnly)) {
      return (
        <div className="space-y-2">
          <div
            className="rounded-[6px] px-[10px] py-2"
            style={{ background: '#0A0E17' }}
          >
            {Object.entries(nodeDiff).map(([key, ch]) => (
              <div
                key={key}
                className={`mb-2 flex flex-wrap items-baseline gap-1 last:mb-0 ${
                  comfortableText ? 'text-[14px]' : 'text-[12px]'
                }`}
              >
                <span
                  className={`inline-block w-[60px] shrink-0 ${
                    comfortableText ? 'text-[13px]' : 'text-[11px]'
                  }`}
                  style={{ color: '#5A6175' }}
                >
                  {fieldLabel(key)}
                </span>
                <span className="line-through" style={{ color: '#EF4444' }}>
                  {String((ch as { from: unknown }).from ?? '')}
                </span>
                <span className="text-muted-foreground">→</span>
                <span
                  className={
                    suggestedFieldHighlight ? 'font-medium text-orange-400' : ''
                  }
                  style={suggestedFieldHighlight ? undefined : { color: '#22C55E' }}
                >
                  {String((ch as { to: unknown }).to ?? '')}
                </span>
              </div>
            ))}
          </div>
          {Object.keys(linkDiff).length > 0 ? (
            <div
              className="rounded-[6px] px-[10px] py-2"
              style={{ background: '#0A0E17' }}
            >
              <p
                className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: '#5A6175' }}
              >
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
                      <p className="mb-1 text-[11px]" style={{ color: '#5A6175' }}>
                        {sectionLabel} · {ctx?.peerName ?? linkId}
                      </p>
                      <p className="line-through" style={{ color: '#EF4444' }}>
                        {formatLinkSnapLine(ch.from, relLabel)}
                      </p>
                      <p className="text-muted-foreground">→</p>
                      <p
                        className={
                          suggestedFieldHighlight ? 'font-medium text-orange-400' : ''
                        }
                        style={suggestedFieldHighlight ? undefined : { color: '#22C55E' }}
                      >
                        {formatLinkSnapLine(ch.to, relLabel)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {proposedAddLinks.length > 0 ? (
            <div
              className="rounded-[6px] px-[10px] py-2"
              style={{ background: '#0A0E17' }}
            >
              <p
                className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: '#5A6175' }}
              >
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
                  const addRelCaption = relLabel(add.relation_type);
                  return (
                    <li key={`${add.source_id}-${add.target_id}-${i}`} className="text-[12px]">
                      <p className="mb-1 text-[11px]" style={{ color: '#5A6175' }}>
                        {sectionLabel}
                      </p>
                      <p
                        className={
                          suggestedFieldHighlight ? 'font-medium text-orange-400' : ''
                        }
                        style={suggestedFieldHighlight ? undefined : { color: '#22C55E' }}
                      >
                        <span className="font-medium">{srcName}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-medium">{tgtName}</span>
                        <span className="text-muted-foreground"> · </span>
                        <span>{addRelCaption}</span>
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {removedLinkIds.length > 0 ? (
            <div
              className="rounded-[6px] px-[10px] py-2"
              style={{ background: '#0A0E17' }}
            >
              <p
                className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: '#5A6175' }}
              >
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
                      <p className="mb-1 text-[11px]" style={{ color: '#5A6175' }}>
                        {sectionLabel} · {ctx?.peerName ?? linkId}
                      </p>
                      {snap ? (
                        <p className="line-through" style={{ color: '#EF4444' }}>
                          {formatLinkSnapLine(snap, relLabel)}
                        </p>
                      ) : (
                        <p style={{ color: '#5A6175' }}>{linkId}</p>
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

    return (
      <div className="space-y-2">
        <p className="text-[13px] font-bold text-foreground">
          {nodeName} — correction
        </p>
        <div className="rounded-[6px] bg-surface px-3 py-2.5">
          {Object.entries(nodeDiff).map(([key, ch]) => (
            <div
              key={key}
              className="mb-2 flex flex-wrap items-baseline gap-1 text-[12px] last:mb-0"
            >
              <span
                className="inline-block w-[70px] shrink-0 text-[11px] text-muted-foreground"
              >
                {fieldLabel(key)}
              </span>
              <span className="text-red-600 line-through">
                {String((ch as { from: unknown }).from ?? '')}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-emerald-600">
                {String((ch as { to: unknown }).to ?? '')}
              </span>
            </div>
          ))}
        </div>
        {Object.keys(linkDiff).length > 0 ? (
          <div className="rounded-[6px] bg-surface px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                    <p className="mb-1 text-[11px] text-muted-foreground">
                      {sectionLabel} · {ctx?.peerName ?? linkId}
                    </p>
                    <p className="text-red-600 line-through">
                      {formatLinkSnapLine(ch.from, relLabel)}
                    </p>
                    <p className="text-muted-foreground">→</p>
                    <p className="text-emerald-600">{formatLinkSnapLine(ch.to, relLabel)}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {proposedAddLinks.length > 0 ? (
          <div className="rounded-[6px] bg-surface px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                const addRelCaption = relLabel(add.relation_type);
                return (
                  <li key={`${add.source_id}-${add.target_id}-${i}`} className="text-[12px]">
                    <p className="mb-1 text-[11px] text-muted-foreground">{sectionLabel}</p>
                    <p className="text-emerald-600">
                      <span className="font-medium">{srcName}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium">{tgtName}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span>{addRelCaption}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {removedLinkIds.length > 0 ? (
          <div className="rounded-[6px] bg-surface px-3 py-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                    <p className="mb-1 text-[11px] text-muted-foreground">
                      {sectionLabel} · {ctx?.peerName ?? linkId}
                    </p>
                    {snap ? (
                      <p className="text-red-600 line-through">
                        {formatLinkSnapLine(snap, relLabel)}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">{linkId}</p>
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
      is_optional?: boolean;
      notes?: string | null;
    };
    const srcName = nodeNames[d.source_id] ?? d.source_id;
    const tgtName = nodeNames[d.target_id] ?? d.target_id;
    const relTypeLabel = tRel(d.relation_type as Parameters<typeof tRel>[0]);
    const srcResolved = Boolean(nodeNames[d.source_id]);
    const tgtResolved = Boolean(nodeNames[d.target_id]);

    if (!readOnly && isEditing && editDraft) {
      const draft = editDraft as {
        relation_type?: string;
        is_optional?: boolean;
        notes?: string;
      };
      const addLinkFieldClass = suggestedFieldHighlight
        ? `mt-1 w-full rounded border border-orange-500/50 bg-orange-950/30 px-2 py-1 ${
            comfortableText ? 'text-[14px]' : 'text-[12px]'
          } text-orange-200`
        : `mt-1 w-full rounded border border-border bg-surface px-2 py-1 ${
            comfortableText ? 'text-[14px]' : 'text-[12px]'
          } text-foreground`;
      const addLinkLabelClass = `block ${
        comfortableText ? 'text-[13px]' : 'text-[11px]'
      } text-muted-foreground`;
      return (
        <div className="rounded-[6px] border border-border/50 bg-surface px-3 py-2.5 space-y-2">
          {suggestedFieldHighlight ? (
            <p
              className={`${
                comfortableText ? 'text-[13px]' : 'text-[11px]'
              } text-muted-foreground`}
            >
              <span className="font-medium text-foreground/85">
                {ta('fieldCurrentCard')}
              </span>{' '}
              {ta('addLinkNoCurrentLink')}
            </p>
          ) : null}
          {!srcResolved || !tgtResolved ? (
            <p
              className={`${
                comfortableText ? 'text-[13px]' : 'text-[11px]'
              } text-amber-500`}
              role="status"
            >
              {!srcResolved ? ta('addLinkUnknownSource') : null}
              {!srcResolved && !tgtResolved ? ' · ' : null}
              {!tgtResolved ? ta('addLinkUnknownTarget') : null}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2.5 py-1 ${
                comfortableText ? 'text-[14px]' : 'text-[12px]'
              } font-bold text-foreground bg-surface-elevated`}
            >
              {srcName}
            </span>
            <span className="text-muted-foreground">→</span>
            <span
              className={`rounded px-2.5 py-1 ${
                comfortableText ? 'text-[14px]' : 'text-[12px]'
              } font-bold text-foreground bg-surface-elevated`}
            >
              {tgtName}
            </span>
          </div>
          <p
            className={`${
              comfortableText ? 'text-[13px]' : 'text-[11px]'
            } text-muted-foreground`}
          >
            {relLabel(
              VALID_RELATIONS.has(
                String(draft.relation_type ?? d.relation_type)
              )
                ? String(draft.relation_type ?? d.relation_type)
                : RelationType.MATERIAL
            )}
          </p>
          <label className={addLinkLabelClass}>
            {ta('field_link_notes')}
            <input
              className={addLinkFieldClass}
              value={draft.notes ?? d.notes ?? ''}
              onChange={(e) =>
                onEditDraftChange({ ...draft, notes: e.target.value })
              }
            />
          </label>
          <label
            className={`flex items-center gap-2 ${
              comfortableText ? 'text-[14px]' : 'text-[12px]'
            } text-muted-foreground`}
          >
            <input
              type="checkbox"
              className={
                suggestedFieldHighlight ? 'accent-orange-500' : undefined
              }
              checked={Boolean(draft.is_optional ?? d.is_optional)}
              onChange={(e) =>
                onEditDraftChange({
                  ...draft,
                  is_optional: e.target.checked,
                })
              }
            />
            {ta('field_link_optional')}
          </label>
        </div>
      );
    }

    if (moderationUi && (!isEditing || readOnly)) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded px-2.5 py-1 text-[12px] font-bold text-foreground"
              style={{ background: '#1A1F2E' }}
            >
              {srcName}
            </span>
            <span className="text-muted-foreground">→</span>
            <span
              className="rounded px-2.5 py-1 text-[12px] font-bold text-foreground"
              style={{ background: '#1A1F2E' }}
            >
              {tgtName}
            </span>
          </div>
          <span className="text-[10px]" style={{ color: '#5A6175' }}>
            {relTypeLabel}
          </span>
        </div>
      );
    }

    return (
      <div className="rounded-[6px] bg-surface px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded px-2.5 py-1 text-[12px] font-bold text-foreground bg-surface-elevated">
              {srcName}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="rounded px-2.5 py-1 text-[12px] font-bold text-foreground bg-surface-elevated">
              {tgtName}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">{relTypeLabel}</span>
        </div>
      </div>
    );
  }

  if (row.suggestion_type === 'new_node') {
    const d = data as {
      node: {
        name: string;
        category: string;
        era: string;
        year_approx?: number | null;
        proposed_id?: string;
        description?: string;
        origin?: string | null;
        dimension?: string | null;
        materialLevel?: string | null;
      };
      link?: {
        source_id: string;
        target_id: string;
        relation_type: string;
      };
      links?: {
        source_id: string;
        target_id: string;
        relation_type: string;
      }[];
    };

    const linksList: {
      source_id: string;
      target_id: string;
      relation_type: string;
    }[] = [];
    const seenLink = new Set<string>();
    const pushL = (x: {
      source_id: string;
      target_id: string;
      relation_type: string;
    }) => {
      const k = `${x.source_id}|${x.target_id}|${x.relation_type}`;
      if (seenLink.has(k)) return;
      seenLink.add(k);
      linksList.push(x);
    };
    if (d.link?.source_id && d.link?.target_id && d.link?.relation_type) {
      pushL(d.link);
    }
    if (Array.isArray(d.links)) {
      for (const x of d.links) {
        if (x?.source_id && x?.target_id && x?.relation_type) pushL(x);
      }
    }

    if (!readOnly && isEditing && editDraft) {
      const draft = editDraft as {
        node: Record<string, unknown>;
        link?: Record<string, unknown>;
        links?: unknown[];
      };
      const n = draft.node ?? {};
      const l = draft.link ?? {};
      const nnInput = suggestInputClass({
        suggested: suggestedFieldHighlight,
        comfortableText,
      });
      const nnSelect = suggestSelectClass({
        suggested: suggestedFieldHighlight,
        comfortableText,
      });
      const lbl = suggestFormLabelClass(comfortableText);
      const lblSection = suggestFormLabelSectionClass(comfortableText);
      const nv = (key: string): string => {
        const v = n[key];
        if (key === 'tags') {
          if (Array.isArray(v)) return v.map(String).join(', ');
          return String(v ?? '');
        }
        if (key === 'year_approx' && (v === null || v === undefined)) return '';
        if (key === 'year_approx' && typeof v === 'number') return String(v);
        return String(v ?? '');
      };
      const patchNode = (patch: Record<string, unknown>) =>
        onEditDraftChange({
          ...draft,
          node: { ...n, ...patch },
          link: { ...l },
          links: draft.links,
        });
      const matterDim = nv('dimension') === 'matter';
      const tagsCsv = nv('tags');
      const setTagsFromCsv = (csv: string) =>
        patchNode({
          tags: csv
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean),
        });
      const emptyDash = '—';

      return (
        <div className="space-y-3">
          <div className="space-y-4 rounded-xl border border-border/60 bg-surface/40 p-4 sm:p-5">
            {suggestedFieldHighlight ? (
              <p
                className={`${
                  comfortableText ? 'text-[13px]' : 'text-[11px]'
                } text-muted-foreground`}
              >
                {ta('newNodeNoCurrentCard')}
              </p>
            ) : null}

            <div>
              <label className={lbl}>{fieldLabel('proposed_id')}</label>
              <input
                type="text"
                className={nnInput}
                value={nv('proposed_id')}
                onChange={(e) => patchNode({ proposed_id: e.target.value })}
              />
            </div>

            <div>
              <label className={lbl}>{getSuggestFormFieldLabel('name')}</label>
              <input
                type="text"
                className={nnInput}
                value={nv('name')}
                onChange={(e) => patchNode({ name: e.target.value })}
              />
            </div>

            <div>
              <label className={lbl}>
                {getSuggestFormFieldLabel('name_en')}
              </label>
              <input
                type="text"
                className={nnInput}
                value={nv('name_en')}
                onChange={(e) => patchNode({ name_en: e.target.value })}
              />
            </div>

            <div>
              <label className={lbl}>
                {getSuggestFormFieldLabel('year_approx')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                className={nnInput}
                value={nv('year_approx')}
                onChange={(e) => {
                  const t = e.target.value.trim();
                  patchNode({
                    year_approx: t === '' ? null : Number(t),
                  });
                }}
              />
            </div>

            <div>
              <label className={lbl}>
                {getSuggestFormFieldLabel('category')}
              </label>
              <select
                className={nnSelect}
                value={
                  (() => {
                    const v = nv('category') || PRIMARY_CARD_CATEGORY_ORDER[0];
                    return PRIMARY_CARD_CATEGORY_ORDER.includes(v as NodeCategory)
                      ? v
                      : PRIMARY_CARD_CATEGORY_ORDER[0];
                  })()
                }
                onChange={(e) => patchNode({ category: e.target.value })}
              >
                {PRIMARY_CARD_CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {tCat(c)}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={suggestNatureBlockWrapClass({
                suggested: suggestedFieldHighlight,
              })}
            >
              <p
                className={suggestFormNatureSectionTitleClass(comfortableText)}
              >
                {tExplore('detailTagNature')}
              </p>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>
                    {getSuggestFormFieldLabel('naturalOrigin')}
                  </label>
                  <select
                    className={nnSelect}
                    value={nv('naturalOrigin')}
                    onChange={(e) =>
                      patchNode({ naturalOrigin: e.target.value })
                    }
                  >
                    <option value="">{emptyDash}</option>
                    {NATURAL_ORIGIN_ORDER.map((no) => (
                      <option key={no} value={no}>
                        {tExplore(
                          `suggestNaturalOrigin_${no}` as Parameters<
                            typeof tExplore
                          >[0]
                        )}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={lbl}>
                    {getSuggestFormFieldLabel('chemicalNature')}
                  </label>
                  <select
                    className={nnSelect}
                    value={nv('chemicalNature')}
                    onChange={(e) =>
                      patchNode({ chemicalNature: e.target.value })
                    }
                  >
                    <option value="">{emptyDash}</option>
                    {CHEMICAL_NATURE_ORDER.map((cn) => (
                      <option key={cn} value={cn}>
                        {tExplore(
                          `suggestChemicalNature_${cn}` as Parameters<
                            typeof tExplore
                          >[0]
                        )}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className={lblSection}>
                {getSuggestFormFieldLabel('tags')}
              </label>
              <SuggestionTagsField
                tagsCsv={tagsCsv}
                onTagsCsvChange={setTagsFromCsv}
                dirty={false}
                suggested={suggestedFieldHighlight}
                comfortableText={comfortableText}
              />
            </div>

            <div>
              <label className={lbl}>{getSuggestFormFieldLabel('era')}</label>
              <p
                className={`mb-1.5 ${
                  comfortableText ? 'text-[12px]' : 'text-[10px]'
                } text-muted-foreground`}
              >
                {tExplore('suggestEraHint')}
              </p>
              <select
                className={nnSelect}
                value={
                  (() => {
                    const v = nv('era') || ERA_ORDER[0];
                    return ERA_ORDER.includes(v as (typeof ERA_ORDER)[number])
                      ? v
                      : ERA_ORDER[0];
                  })()
                }
                onChange={(e) => patchNode({ era: e.target.value })}
              >
                {ERA_ORDER.map((er) => (
                  <option key={er} value={er}>
                    {eraLabelFromMessages(locale, er)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={lbl}>
                {getSuggestFormFieldLabel('origin')}
              </label>
              <input
                type="text"
                className={nnInput}
                value={nv('origin')}
                onChange={(e) => patchNode({ origin: e.target.value })}
              />
            </div>

            <div>
              <label className={lbl}>
                {getSuggestFormFieldLabel('description')}
              </label>
              <textarea
                rows={5}
                className={nnInput}
                value={nv('description')}
                onChange={(e) => patchNode({ description: e.target.value })}
              />
            </div>

            <div>
              <label className={lbl}>
                {getSuggestFormFieldLabel('description_en')}
              </label>
              <textarea
                rows={5}
                className={nnInput}
                value={nv('description_en')}
                onChange={(e) => patchNode({ description_en: e.target.value })}
              />
            </div>

            <div>
              <label className={lbl}>
                {getSuggestFormFieldLabel('dimension')}
              </label>
              <select
                className={nnSelect}
                value={nv('dimension')}
                onChange={(e) => patchNode({ dimension: e.target.value })}
              >
                <option value="">{emptyDash}</option>
                {DIMENSION_ORDER.map((dim) => (
                  <option key={dim} value={dim}>
                    {tEditor(EDITOR_DIM_KEY[dim])}
                  </option>
                ))}
              </select>
            </div>

            {matterDim ? (
              <div>
                <label className={lbl}>
                  {getSuggestFormFieldLabel('materialLevel')}
                </label>
                <select
                  className={nnSelect}
                  value={nv('materialLevel')}
                  onChange={(e) =>
                    patchNode({ materialLevel: e.target.value })
                  }
                >
                  <option value="">{emptyDash}</option>
                  {MATERIAL_LEVEL_ORDER.map((lv) => (
                    <option key={lv} value={lv}>
                      {tEditor(EDITOR_LEVEL_KEY[lv])}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label className={lbl}>
                {getSuggestFormFieldLabel('wikipedia_url')}
              </label>
              <input
                type="text"
                className={nnInput}
                value={nv('wikipedia_url')}
                onChange={(e) => patchNode({ wikipedia_url: e.target.value })}
              />
            </div>

            <div>
              <label className={lbl}>{fieldLabel('image_url')}</label>
              <input
                type="text"
                className={nnInput}
                value={nv('image_url')}
                onChange={(e) => patchNode({ image_url: e.target.value })}
              />
            </div>

            <div>
              <label className={lbl}>{fieldLabel('origin_type')}</label>
              <select
                className={nnSelect}
                value={
                  (() => {
                    const opts = ['mineral', 'vegetal', 'animal'] as const;
                    const cur = nv('origin_type');
                    return opts.includes(cur as (typeof opts)[number])
                      ? cur
                      : '';
                  })()
                }
                onChange={(e) => patchNode({ origin_type: e.target.value })}
              >
                <option value="">{ta('field_empty')}</option>
                {(
                  ['mineral', 'vegetal', 'animal'] as const
                ).map((o) => (
                  <option key={o} value={o}>
                    {tExplore(
                      {
                        mineral: 'originTypeMineral',
                        vegetal: 'originTypeVegetal',
                        animal: 'originTypeAnimal',
                      }[o] as Parameters<typeof tExplore>[0]
                    )}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={lbl}>{fieldLabel('nature_type')}</label>
              <select
                className={nnSelect}
                value={
                  (() => {
                    const opts = ['element', 'compose', 'materiau'] as const;
                    const cur = nv('nature_type');
                    return opts.includes(cur as (typeof opts)[number])
                      ? cur
                      : '';
                  })()
                }
                onChange={(e) => patchNode({ nature_type: e.target.value })}
              >
                <option value="">{ta('field_empty')}</option>
                {(
                  ['element', 'compose', 'materiau'] as const
                ).map((o) => (
                  <option key={o} value={o}>
                    {tExplore(
                      {
                        element: 'natureTypeElement',
                        compose: 'natureTypeCompose',
                        materiau: 'natureTypeMateriau',
                      }[o] as Parameters<typeof tExplore>[0]
                    )}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-surface/40 p-4 sm:p-5">
            <p
              className={`${
                comfortableText ? 'text-[12px]' : 'text-[10px]'
              } font-semibold uppercase tracking-wide text-muted-foreground`}
            >
              {ta('editNodeLinksSuggestionSection')}
            </p>
            <AdminNewNodeLinkSearches
              placeholderNodeId={
                nv('proposed_id').trim() ||
                String(d.node.proposed_id ?? '').trim()
              }
              draft={draft}
              onEditDraftChange={onEditDraftChange}
              nodeNames={nodeNames}
            />
          </div>
        </div>
      );
    }

    const newName = d.node.name;
    const ph = (d.node.proposed_id ?? '').trim();
    const linkRow = (link: (typeof linksList)[0]) => {
      const srcName =
        nodeNames[link.source_id] ??
        (ph && link.source_id === ph ? newName : link.source_id);
      const tgtName =
        nodeNames[link.target_id] ??
        (ph && link.target_id === ph ? newName : link.target_id);
      return { srcName, tgtName, rel: link.relation_type };
    };

    const desc =
      typeof d.node.description === 'string' ? d.node.description.trim() : '';
    const origin =
      typeof d.node.origin === 'string' ? d.node.origin.trim() : '';

    if (moderationUi && (!isEditing || readOnly)) {
      return (
        <div className="space-y-2">
          <div
            className="space-y-1 rounded-[6px] px-[10px] py-2 text-[12px]"
            style={{ color: '#22C55E' }}
          >
            <p>
              <span className="text-muted-foreground">Nom : </span>
              {d.node.name}
            </p>
            <p>
              <span className="text-muted-foreground">Catégorie : </span>
              {getCategoryLabelFr(d.node.category as unknown as NodeCategory)}
            </p>
            <p>
              <span className="text-muted-foreground">
                {fieldLabel('dimension')} :{' '}
              </span>
              {typeof d.node.dimension === 'string' &&
              DIMENSION_ORDER.includes(
                d.node.dimension as (typeof DIMENSION_ORDER)[number]
              )
                ? tEditor(
                    EDITOR_DIM_KEY[
                      d.node.dimension as keyof typeof EDITOR_DIM_KEY
                    ]
                  )
                : d.node.dimension
                  ? String(d.node.dimension)
                  : '—'}
            </p>
            <p>
              <span className="text-muted-foreground">
                {fieldLabel('materialLevel')} :{' '}
              </span>
              {typeof d.node.materialLevel === 'string' &&
              MATERIAL_LEVEL_ORDER.includes(
                d.node.materialLevel as (typeof MATERIAL_LEVEL_ORDER)[number]
              )
                ? tEditor(
                    EDITOR_LEVEL_KEY[
                      d.node.materialLevel as keyof typeof EDITOR_LEVEL_KEY
                    ]
                  )
                : d.node.materialLevel
                  ? String(d.node.materialLevel)
                  : '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Époque : </span>
              {d.node.era}
            </p>
            <p>
              <span className="text-muted-foreground">Année : </span>
              {d.node.year_approx ?? '—'}
            </p>
            {desc ? (
              <p>
                <span className="text-muted-foreground">Description : </span>
                <span className="whitespace-pre-wrap">{desc}</span>
              </p>
            ) : null}
            {origin ? (
              <p>
                <span className="text-muted-foreground">Origine : </span>
                {origin}
              </p>
            ) : null}
          </div>
          {linksList.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Aucun lien proposé</p>
          ) : (
            linksList.map((lnk, i) => {
              const { srcName, tgtName, rel } = linkRow(lnk);
              return (
                <div
                  key={`${lnk.source_id}-${lnk.target_id}-${i}`}
                  className="rounded-[6px] px-3 py-2 text-[12px]"
                  style={{ color: '#22C55E' }}
                >
                  <span className="font-medium">{srcName}</span>
                  <span className="mx-1 text-muted-foreground">→</span>
                  <span className="font-medium">{tgtName}</span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    ({relLabel(rel)})
                  </span>
                </div>
              );
            })
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="rounded-[6px] bg-surface px-3 py-2.5 text-[12px] text-emerald-600 space-y-1">
          <p>
            <span className="text-muted-foreground">Nom : </span>
            {d.node.name}
          </p>
          <p>
            <span className="text-muted-foreground">Catégorie : </span>
            {getCategoryLabelFr(d.node.category as unknown as NodeCategory)}
          </p>
          <p>
            <span className="text-muted-foreground">
              {fieldLabel('dimension')} :{' '}
            </span>
            {typeof d.node.dimension === 'string' &&
            DIMENSION_ORDER.includes(
              d.node.dimension as (typeof DIMENSION_ORDER)[number]
            )
              ? tEditor(
                  EDITOR_DIM_KEY[
                    d.node.dimension as keyof typeof EDITOR_DIM_KEY
                  ]
                )
              : d.node.dimension
                ? String(d.node.dimension)
                : '—'}
          </p>
          <p>
            <span className="text-muted-foreground">
              {fieldLabel('materialLevel')} :{' '}
            </span>
            {typeof d.node.materialLevel === 'string' &&
            MATERIAL_LEVEL_ORDER.includes(
              d.node.materialLevel as (typeof MATERIAL_LEVEL_ORDER)[number]
            )
              ? tEditor(
                  EDITOR_LEVEL_KEY[
                    d.node.materialLevel as keyof typeof EDITOR_LEVEL_KEY
                  ]
                )
              : d.node.materialLevel
                ? String(d.node.materialLevel)
                : '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Époque : </span>
            {d.node.era}
          </p>
          <p>
            <span className="text-muted-foreground">Année : </span>
            {d.node.year_approx ?? '—'}
          </p>
          {desc ? (
            <p className="text-foreground">
              <span className="text-muted-foreground">Description : </span>
              <span className="whitespace-pre-wrap">{desc}</span>
            </p>
          ) : null}
          {origin ? (
            <p>
              <span className="text-muted-foreground">Origine : </span>
              {origin}
            </p>
          ) : null}
        </div>
        {linksList.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Aucun lien proposé</p>
        ) : (
          linksList.map((lnk, i) => {
            const { srcName, tgtName, rel } = linkRow(lnk);
            return (
              <div
                key={`${lnk.source_id}-${lnk.target_id}-${i}`}
                className="rounded-[6px] bg-surface px-3 py-2.5 text-[12px] text-muted-foreground"
              >
                <span className="font-medium text-foreground">{srcName}</span>
                <span className="mx-1 text-muted-foreground">→</span>
                <span className="font-medium text-foreground">{tgtName}</span>
                <span className="ml-2 text-[10px] text-muted-foreground">
                  ({relLabel(rel)})
                </span>
              </div>
            );
          })
        )}
      </div>
    );
  }

  if (row.suggestion_type === 'delete_link') {
    const d = data as {
      link_id?: string;
      source_id?: string;
      target_id?: string;
    };
    const srcName = nodeNames[d.source_id ?? ''] ?? d.source_id ?? '—';
    const tgtName = nodeNames[d.target_id ?? ''] ?? d.target_id ?? '—';
    if (moderationUi) {
      return (
        <div className="space-y-2">
          <p
            className={`${
              comfortableText ? 'text-[13px]' : 'text-[11px]'
            } font-semibold uppercase tracking-wide ${
              suggestedFieldHighlight ? 'text-orange-400' : ''
            }`}
            style={suggestedFieldHighlight ? undefined : { color: '#5A6175' }}
          >
            Lien à supprimer
          </p>
          <p
            className={`${
              comfortableText ? 'text-[14px]' : 'text-[12px]'
            } line-through ${
              suggestedFieldHighlight ? 'text-orange-400' : ''
            }`}
            style={suggestedFieldHighlight ? undefined : { color: '#EF4444' }}
          >
            <span className="font-medium">{srcName}</span>
            <span className="mx-1">→</span>
            <span className="font-medium">{tgtName}</span>
          </p>
          {d.link_id ? (
            <p
              className={`${
                comfortableText ? 'text-[12px]' : 'text-[10px]'
              } font-mono ${
                suggestedFieldHighlight ? 'text-orange-300/80' : 'text-muted-foreground'
              }`}
            >
              {d.link_id}
            </p>
          ) : null}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p
          className={`${
            comfortableText ? 'text-[13px]' : 'text-[11px]'
          } font-semibold uppercase tracking-wide text-muted-foreground`}
        >
          Lien à supprimer
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-[6px] bg-surface px-3 py-2.5">
          <span className="rounded px-2.5 py-1 text-[12px] font-bold text-foreground bg-surface-elevated">
            {srcName}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="rounded px-2.5 py-1 text-[12px] font-bold text-foreground bg-surface-elevated">
            {tgtName}
          </span>
        </div>
        {d.link_id ? (
          <p className="text-[10px] font-mono text-muted-foreground">
            {d.link_id}
          </p>
        ) : null}
      </div>
    );
  }

  if (row.suggestion_type === 'anonymous_feedback') {
    const d = data as {
      message?: string;
      email?: string | null;
      node_id?: string;
    };
    const nid = d.node_id ?? row.node_id ?? '';
    const nName = (nodeNames[nid] ?? nid) || '—';
    if (moderationUi) {
      return (
        <div className="space-y-2">
          <p
            className={`${
              comfortableText ? 'text-[14px]' : 'text-[12px]'
            } text-muted-foreground`}
          >
            Invention :{' '}
            <span
              className={`font-medium ${
                suggestedFieldHighlight ? 'text-orange-200' : 'text-foreground'
              }`}
            >
              {nName}
            </span>
          </p>
          <div
            className={`whitespace-pre-wrap rounded-[6px] px-[10px] py-2 italic ${
              comfortableText ? 'text-[15px]' : 'text-[13px]'
            } ${
              suggestedFieldHighlight
                ? 'border border-orange-500/40 bg-orange-950/30 text-orange-200'
                : ''
            }`}
            style={
              suggestedFieldHighlight
                ? undefined
                : { background: '#0A0E17', color: '#C8CDD8' }
            }
          >
            {d.message ?? ''}
          </div>
          {d.email ? (
            <p
              className={`${
                comfortableText ? 'text-[13px]' : 'text-[11px]'
              } ${
                suggestedFieldHighlight ? 'text-orange-300' : 'text-muted-foreground'
              }`}
            >
              Email : {d.email}
            </p>
          ) : null}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-[12px] text-muted-foreground">
          Invention :{' '}
          <span className="font-medium text-foreground">{nName}</span>
        </p>
        <div className="whitespace-pre-wrap rounded-[6px] bg-surface px-3 py-2.5 text-[12px] text-foreground">
          {d.message ?? ''}
        </div>
        {d.email ? (
          <p className="text-[11px] text-muted-foreground">
            Email : {d.email}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <pre className="text-xs text-muted-foreground">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

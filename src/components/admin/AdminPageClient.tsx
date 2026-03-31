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
import { AppContentShell } from '@/components/layout/AppContentShell';
import { BackToExploreLink } from '@/components/layout/BackToExploreLink';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { computeDiff } from '@/lib/suggestion-diff';
import { getCategoryLabelFr } from '@/lib/category-labels';
import { NodeCategory } from '@/lib/types';
import { RelationType } from '@/lib/types';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';

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

const RELIABILITY = {
  trusted: { color: '#22C55E', label: 'Fiable' },
  new: { color: '#F59E0B', label: 'Nouveau' },
  anonymous: { color: '#5A6175', label: 'Anonyme' },
} as const;

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

function getExploreNodeId(row: SuggestionRow): string | null {
  const top = row.node_id?.trim();
  if (top) return top;
  if (row.suggestion_type === 'anonymous_feedback') {
    const d = row.data as { node_id?: string };
    if (typeof d.node_id === 'string' && d.node_id.trim()) return d.node_id.trim();
  }
  return null;
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
  const rest = { ...o };
  delete rest.linkEdits;
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
        link?: Record<string, unknown>;
        links?: unknown[];
      };
      const links = Array.isArray(d.links)
        ? d.links.map((x) =>
            x && typeof x === 'object' ? { ...(x as Record<string, unknown>) } : {}
          )
        : d.link
          ? [d.link]
          : [];
      setEditDraft({
        node: { ...d.node },
        link: d.link ? { ...d.link } : {},
        links,
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

  useEffect(() => {
    if (tab !== 'pending' || !shortcutTargetId) return;
    const onKey = (e: KeyboardEvent) => {
      if (editingId || rejectingId || bulkProcessing) return;
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
        if (editingId === shortcutTargetId && editDraft) {
          submitEditApprove(row);
        } else {
          void approve(shortcutTargetId);
        }
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
    editingId,
    rejectingId,
    bulkProcessing,
    suggestions,
    editDraft,
    approve,
    reject,
  ]);

  if (isLoading || !isAdmin) {
    return (
      <AppContentShell className="flex min-h-[50vh] w-full flex-1 flex-col items-center justify-center text-center text-muted-foreground">
        …
      </AppContentShell>
    );
  }

  const pendingBadge = stats?.pending ?? 0;

  return (
    <AppContentShell className="flex w-full flex-1 flex-col text-foreground">
      <div className="pb-3">
        <BackToExploreLink />
        <h1
          className="text-lg font-semibold tracking-tight text-foreground md:text-xl"
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
            className={`relative pb-2 text-sm font-medium ${
              tab === 'pending' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {t('tabPending')}
            {pendingBadge > 0 ? (
              <span
                className="ml-2 inline-block rounded-[8px] bg-red-500 px-[5px] py-[1px] text-[9px] font-semibold leading-tight text-white"
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
            className={`relative pb-2 text-sm font-medium ${
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
            className={`relative pb-2 text-sm font-medium ${
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
            className={`relative pb-2 text-sm font-medium ${
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
                className={`rounded-[6px] border px-3 py-[5px] text-[11px] ${
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
          <label className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
            <span>Trier par</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-[6px] border border-border bg-surface px-2 py-1.5 text-[11px] text-foreground"
              style={{ borderWidth: '0.5px' }}
            >
              <option value="recent">Plus récentes</option>
              <option value="reliability">Fiabilité</option>
              <option value="type">Type</option>
            </select>
          </label>
        </div>
      ) : null}

      <main className="min-w-0 flex-1 overflow-x-auto py-4">
        {loading ? (
          <p className="text-muted-foreground">…</p>
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
          <div className="relative min-w-0 pb-10">
            {tab === 'pending' && selectedIds.size > 0 ? (
              <div
                className="mb-3 flex flex-wrap items-center gap-3 px-[14px] py-2"
                style={{
                  background: '#111827',
                  border: '0.5px solid rgba(59, 130, 246, 0.13)',
                  borderRadius: 8,
                }}
              >
                <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#8B95A8]">
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
                <span className="text-[11px] text-[#8B95A8]">
                  {selectedIds.size} sélectionnées
                </span>
                <button
                  type="button"
                  disabled={bulkProcessing}
                  onClick={() => void bulkApprove()}
                  className="rounded px-2 py-1 text-[10px] font-medium text-white disabled:opacity-50"
                  style={{ background: '#22C55E' }}
                >
                  Tout approuver
                </button>
                <button
                  type="button"
                  disabled={bulkProcessing}
                  onClick={() => void bulkReject()}
                  className="rounded border px-2 py-1 text-[10px] font-medium text-[#EF4444] disabled:opacity-50"
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
                  onRejectDirect={
                    s.suggestion_type === 'anonymous_feedback'
                      ? () => void reject(s.id, null)
                      : undefined
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
                  isPendingTab={tab === 'pending'}
                  moderationUi={tab === 'pending' || tab === 'history'}
                  selected={selectedIds.has(s.id)}
                  onToggleSelect={() => {
                    setSelectedIds((prev) => {
                      const n = new Set(prev);
                      if (n.has(s.id)) n.delete(s.id);
                      else n.add(s.id);
                      return n;
                    });
                  }}
                  exploreNodeId={getExploreNodeId(s)}
                />
              ))}
            </ul>
            {tab === 'pending' && shortcutTargetId ? (
              <p
                className="pointer-events-none fixed bottom-4 right-4 z-10 text-[10px]"
                style={{ color: '#3D4555' }}
              >
                A approuver · R rejeter · V voir
              </p>
            ) : null}
          </div>
        )}
      </main>
    </AppContentShell>
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
      <p className="text-[20px] font-medium" style={{ color }}>
        {value}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ModerationTypeBadge({ type }: { type: string }) {
  const cfg: Record<string, { bg: string; fg: string; label: string }> = {
    edit_node: { bg: 'rgba(245, 158, 11, 0.15)', fg: '#F59E0B', label: 'Correction' },
    add_link: { bg: 'rgba(20, 184, 166, 0.15)', fg: '#14B8A6', label: 'Lien' },
    new_node: { bg: 'rgba(168, 85, 247, 0.15)', fg: '#A855F7', label: 'Invention' },
    delete_link: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#EF4444', label: 'Suppression' },
    anonymous_feedback: {
      bg: 'rgba(90, 97, 117, 0.25)',
      fg: '#5A6175',
      label: 'Anonyme',
    },
  };
  const c = cfg[type] ?? {
    bg: 'rgba(168, 85, 247, 0.15)',
    fg: '#A855F7',
    label: type,
  };
  return (
    <span
      className="inline-block rounded px-2 py-[2px] text-[9px] font-semibold"
      style={{ background: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
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
  onRejectDirect,
  onRejectCancel,
  t,
  tAuth,
  dateIso,
  isPendingTab,
  moderationUi,
  selected,
  onToggleSelect,
  exploreNodeId,
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
  onRejectDirect?: () => void;
  onRejectCancel: () => void;
  t: (k: string) => string;
  tAuth: (k: string) => string;
  dateIso: string;
  isPendingTab: boolean;
  moderationUi: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  exploreNodeId: string | null;
}) {
  const canEditApprove =
    row.suggestion_type !== 'delete_link' &&
    row.suggestion_type !== 'anonymous_feedback';
  const p = row.user_id ? profiles[row.user_id] : undefined;
  const uid = row.user_id ?? '';
  const tier = getReliabilityTier(row, p);
  const rel = RELIABILITY[tier];
  const cardTitle = getSuggestionCardTitle(row, nodeNames);

  const metaLine =
    row.user_id == null
      ? `Anonyme · ${formatRelativeFr(dateIso)}`
      : `${compactDisplayName(p?.display_name ?? p?.email)} · ${p?.contributions_count ?? 0} contributions · ${formatRelativeFr(dateIso)}`;

  const showCheckbox = isPendingTab && row.status === 'pending';
  const isAnonFeedback = row.suggestion_type === 'anonymous_feedback';

  return (
    <li
      className={`flex overflow-hidden rounded-[8px] border border-border bg-surface transition-[max-height,opacity,margin,padding,border-width] duration-300 ease-out ${
        exiting
          ? 'pointer-events-none my-0 max-h-0 border-0 py-0 opacity-0'
          : 'my-[10px] max-h-[8000px] opacity-100'
      }`}
      style={{ borderWidth: exiting ? 0 : 0.5 }}
    >
      <div className="flex min-w-0 flex-1 items-stretch">
        {showCheckbox ? (
          <div className="flex shrink-0 items-start pt-4 pl-2 pr-1">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="h-[14px] w-[14px] cursor-pointer rounded-[3px] border border-[#2A3042] bg-transparent accent-[#22C55E]"
              aria-label="Sélectionner"
            />
          </div>
        ) : null}
        <div
          className="w-1 shrink-0 self-stretch"
          style={{ width: 4, background: rel.color }}
          aria-hidden
        />
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {moderationUi ? (
                <ModerationTypeBadge type={row.suggestion_type} />
              ) : (
                <TypeBadge type={row.suggestion_type} t={t} />
              )}
              <h3 className="min-w-0 text-[13px] font-semibold leading-snug text-foreground">
                {cardTitle}
              </h3>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1 rounded px-2 py-[2px] text-[9px] font-semibold"
                style={{
                  background: `${rel.color}22`,
                  color: rel.color,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: rel.color }}
                />
                {rel.label}
              </span>
            </div>
          </div>

          <p className="mb-3 text-[10px]" style={{ color: '#5A6175' }}>
            {metaLine}
          </p>

          {moderationUi ? null : row.user_id ? (
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
                <p className="text-[12px] text-muted-foreground">
                  {p?.display_name ?? p?.email ?? uid}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {suggestionCountByUser[row.user_id] ?? 0} {t('contributions')}
                </p>
              </div>
            </div>
          ) : row.suggestion_type === 'anonymous_feedback' ? (
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex rounded-full bg-slate-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t('anonymousBadge')}
              </span>
            </div>
          ) : row.contributor_ip ? (
            <div className="mb-3 flex items-start gap-2">
              <div
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-[10px] font-bold text-muted-foreground"
                style={{ width: 24, height: 24 }}
              >
                ?
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-muted-foreground">
                  {t('anonymousContributor')}
                </p>
                <p className="font-mono text-[11px] text-amber-500">
                  {row.contributor_ip}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {suggestionCountByUser[`anon:${row.contributor_ip}`] ?? 0}{' '}
                  {t('contributions')}
                </p>
              </div>
            </div>
          ) : (
            <p className="mb-3 text-[12px] text-muted-foreground">
              {t('contributorUnknown')}
            </p>
          )}

          <ContributorSubmittedExtras
            data={
              row.data && typeof row.data === 'object' && !Array.isArray(row.data)
                ? (row.data as Record<string, unknown>)
                : {}
            }
            suggestionType={row.suggestion_type}
            t={t}
          />

          <SuggestionBody
            row={row}
            nodeNames={nodeNames}
            isEditing={isEditing}
            editDraft={editDraft}
            onEditDraftChange={onEditDraftChange}
            moderationUi={moderationUi}
          />

          {row.status === 'pending' && !isEditing && !rejecting ? (
            <div className="mt-4 flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onApprove}
                  className="rounded-[6px] bg-emerald-600 px-4 py-[7px] text-[12px] font-medium text-white"
                  style={isAnonFeedback ? { background: '#22C55E' } : undefined}
                >
                  {isAnonFeedback ? 'Appliquer' : t('approve')}
                </button>
                {canEditApprove ? (
                  <button
                    type="button"
                    onClick={onStartEdit}
                    className="rounded-[6px] border border-accent bg-transparent px-4 py-[7px] text-[12px] font-medium text-accent"
                  >
                    {t('editApprove')}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={
                    isAnonFeedback && onRejectDirect
                      ? onRejectDirect
                      : onRejectOpen
                  }
                  className="rounded-[6px] border border-red-600 bg-transparent px-4 py-[7px] text-[12px] font-medium text-red-600"
                  style={
                    isAnonFeedback
                      ? { borderColor: '#EF4444', color: '#EF4444' }
                      : undefined
                  }
                >
                  {isAnonFeedback ? 'Ignorer' : t('reject')}
                </button>
              </div>
              {exploreNodeId ? (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      treeInventionPath(exploreNodeId),
                      '_blank',
                      'noopener,noreferrer'
                    )
                  }
                  className="shrink-0 rounded-[6px] border bg-transparent px-3 py-[7px] text-[11px]"
                  style={{
                    borderColor: '#2A3042',
                    color: '#8B95A8',
                  }}
                >
                  Voir dans le Tree
                </button>
              ) : null}
            </div>
          ) : null}

          {row.status === 'pending' && isEditing ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onApproveEdit}
                className="rounded-[6px] bg-accent px-4 py-[7px] text-[12px] font-medium text-white"
              >
                Valider les modifications
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="text-[12px] text-muted-foreground hover:text-foreground"
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
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onRejectConfirm}
                  className="rounded-[6px] border border-red-600 bg-transparent px-3 py-1.5 text-[12px] text-red-600"
                >
                  Confirmer le rejet
                </button>
                <button
                  type="button"
                  onClick={onRejectCancel}
                  className="text-[12px] text-muted-foreground"
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
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : 'bg-red-500/15 text-red-600'
                }`}
              >
                {row.status === 'approved' ? t('approved') : t('rejected')}
              </span>
              {row.status === 'rejected' && row.admin_comment ? (
                <p className="text-[12px] italic text-muted-foreground">
                  {row.admin_comment}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Champs libres envoyés avec la suggestion (ex. message / email pour corrections anonymes). */
function ContributorSubmittedExtras({
  data,
  suggestionType,
  t,
}: {
  data: Record<string, unknown>;
  suggestionType: string;
  t: (k: string) => string;
}) {
  if (suggestionType === 'anonymous_feedback') {
    return null;
  }

  const msg =
    typeof data.contributorMessage === 'string'
      ? data.contributorMessage.trim()
      : '';
  const contact =
    typeof data.contactEmail === 'string' ? data.contactEmail.trim() : '';
  const altEmail =
    !contact &&
    typeof data.email === 'string' &&
    data.email.includes('@')
      ? data.email.trim()
      : '';
  const email = contact || altEmail;

  if (!msg && !email) return null;

  return (
    <div className="mb-3 space-y-2 rounded-[6px] border border-border/70 bg-muted/25 px-3 py-2.5">
      {msg ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('contributorMessageLabel')}
          </p>
          <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">
            {msg}
          </p>
        </div>
      ) : null}
      {email ? (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">
            {t('contributorContactEmailLabel')}{' '}
          </span>
          <a href={`mailto:${email}`} className="text-accent underline">
            {email}
          </a>
        </p>
      ) : null}
    </div>
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
          : type === 'delete_link'
            ? t('typeDeleteLink')
            : type === 'anonymous_feedback'
              ? t('typeAnonymousFeedback')
              : type;
  const cls =
    type === 'edit_node'
      ? 'bg-amber-500/15 text-amber-700'
      : type === 'add_link'
        ? 'bg-emerald-500/15 text-emerald-600'
        : type === 'new_node'
          ? 'bg-violet-500/15 text-violet-600'
          : type === 'delete_link'
            ? 'bg-rose-500/15 text-rose-600'
            : type === 'anonymous_feedback'
              ? 'bg-slate-500/15 text-slate-600'
              : 'bg-violet-500/15 text-violet-600';
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
  moderationUi = false,
}: {
  row: SuggestionRow;
  nodeNames: Record<string, string>;
  isEditing: boolean;
  editDraft: Record<string, unknown> | null;
  onEditDraftChange: (d: Record<string, unknown>) => void;
  moderationUi?: boolean;
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
          <p className="text-[13px] font-bold text-foreground">
            {nodeName} — correction
          </p>
          <div className="space-y-2 rounded-[6px] bg-surface px-3 py-2.5">
            {Object.keys(nodeDiff).map((key) => (
              <label key={key} className="block text-[11px] text-muted-foreground">
                {FIELD_LABELS[key] ?? key}
                <input
                  className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-[12px] text-foreground"
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

    if (moderationUi && !isEditing) {
      return (
        <div className="space-y-2">
          <div
            className="rounded-[6px] px-[10px] py-2"
            style={{ background: '#0A0E17' }}
          >
            {Object.entries(nodeDiff).map(([key, ch]) => (
              <div
                key={key}
                className="mb-2 flex flex-wrap items-baseline gap-1 text-[12px] last:mb-0"
              >
                <span
                  className="inline-block w-[60px] shrink-0 text-[11px]"
                  style={{ color: '#5A6175' }}
                >
                  {FIELD_LABELS[key] ?? key}
                </span>
                <span className="line-through" style={{ color: '#EF4444' }}>
                  {String((ch as { from: unknown }).from ?? '')}
                </span>
                <span className="text-muted-foreground">→</span>
                <span style={{ color: '#22C55E' }}>
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
                        {formatLinkSnapLine(ch.from)}
                      </p>
                      <p className="text-muted-foreground">→</p>
                      <p style={{ color: '#22C55E' }}>{formatLinkSnapLine(ch.to)}</p>
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
                  const relLabel =
                    RELATION_LABELS_FR[add.relation_type] ?? add.relation_type;
                  return (
                    <li key={`${add.source_id}-${add.target_id}-${i}`} className="text-[12px]">
                      <p className="mb-1 text-[11px]" style={{ color: '#5A6175' }}>
                        {sectionLabel}
                      </p>
                      <p style={{ color: '#22C55E' }}>
                        <span className="font-medium">{srcName}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span className="font-medium">{tgtName}</span>
                        <span className="text-muted-foreground"> · </span>
                        <span>{relLabel}</span>
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
                          {formatLinkSnapLine(snap)}
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
                {FIELD_LABELS[key] ?? key}
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
                      {formatLinkSnapLine(ch.from)}
                    </p>
                    <p className="text-muted-foreground">→</p>
                    <p className="text-emerald-600">{formatLinkSnapLine(ch.to)}</p>
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
                const relLabel =
                  RELATION_LABELS_FR[add.relation_type] ?? add.relation_type;
                return (
                  <li key={`${add.source_id}-${add.target_id}-${i}`} className="text-[12px]">
                    <p className="mb-1 text-[11px] text-muted-foreground">{sectionLabel}</p>
                    <p className="text-emerald-600">
                      <span className="font-medium">{srcName}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium">{tgtName}</span>
                      <span className="text-muted-foreground"> · </span>
                      <span>{relLabel}</span>
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
                        {formatLinkSnapLine(snap)}
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
    };
    const srcName = nodeNames[d.source_id] ?? d.source_id;
    const tgtName = nodeNames[d.target_id] ?? d.target_id;
    const relLabel =
      RELATION_LABELS_FR[d.relation_type] ?? d.relation_type;

    if (isEditing && editDraft) {
      const draft = editDraft as { relation_type?: string };
      return (
        <div className="rounded-[6px] bg-surface px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded px-2.5 py-1 text-[12px] font-bold text-foreground bg-surface-elevated">
              {srcName}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="rounded px-2.5 py-1 text-[12px] font-bold text-foreground bg-surface-elevated">
              {tgtName}
            </span>
          </div>
          <select
            className="mt-2 w-full rounded border border-border bg-surface px-2 py-1 text-[12px] text-foreground"
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

    if (moderationUi && !isEditing) {
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
            {relLabel}
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
          <span className="text-[10px] text-muted-foreground">{relLabel}</span>
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
        description?: string;
        origin?: string | null;
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

    if (isEditing && editDraft) {
      const draft = editDraft as {
        node: Record<string, unknown>;
        link?: Record<string, unknown>;
        links?: unknown[];
      };
      const n = draft.node ?? {};
      const l = draft.link ?? {};
      const firstLink = linksList[0];
      return (
        <div className="space-y-2">
          <div className="rounded-[6px] bg-surface px-3 py-2.5 space-y-2">
            {(
              [
                ['name', 'Nom'],
                ['category', 'Catégorie'],
                ['type', 'Type'],
                ['era', 'Époque'],
                ['year_approx', 'Année'],
              ] as const
            ).map(([k, lab]) => (
              <label key={k} className="block text-[11px] text-muted-foreground">
                {lab}
                <input
                  className="mt-0.5 w-full rounded border border-border bg-surface px-2 py-1 text-[12px] text-foreground"
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
                      links: draft.links,
                    });
                  }}
                />
              </label>
            ))}
          </div>
          {firstLink ? (
            <div className="rounded-[6px] bg-surface px-3 py-2.5">
              <p className="mb-1 text-[10px] text-muted-foreground">
                Lien (premier — {linksList.length > 1 ? `${linksList.length} au total` : '1'})
              </p>
              <select
                className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px] text-foreground"
                value={String(l.relation_type ?? firstLink.relation_type)}
                onChange={(e) =>
                  onEditDraftChange({
                    ...draft,
                    node: { ...n },
                    link: {
                      ...l,
                      relation_type: e.target.value,
                    },
                    links: draft.links,
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
          ) : null}
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

    if (moderationUi && !isEditing) {
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
              <span className="text-muted-foreground">Type : </span>
              {d.node.type}
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
                    ({RELATION_LABELS_FR[rel as RelationType] ?? rel})
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
            <span className="text-muted-foreground">Type : </span>
            {d.node.type}
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
                  ({RELATION_LABELS_FR[rel as RelationType] ?? rel})
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
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: '#5A6175' }}
          >
            Lien à supprimer
          </p>
          <p className="text-[12px] line-through" style={{ color: '#EF4444' }}>
            <span className="font-medium">{srcName}</span>
            <span className="mx-1">→</span>
            <span className="font-medium">{tgtName}</span>
          </p>
          {d.link_id ? (
            <p className="text-[10px] font-mono text-muted-foreground">
              {d.link_id}
            </p>
          ) : null}
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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
          <p className="text-[12px] text-muted-foreground">
            Invention :{' '}
            <span className="font-medium text-foreground">{nName}</span>
          </p>
          <div
            className="whitespace-pre-wrap rounded-[6px] px-[10px] py-2 text-[13px] italic"
            style={{ background: '#0A0E17', color: '#C8CDD8' }}
          >
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

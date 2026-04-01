'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AppContentShell } from '@/components/layout/AppContentShell';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import {
  ADMIN_DRAFT_PROPOSED_ADD,
  ADMIN_DRAFT_REMOVED_IDS,
  type AdminEditNodeLinkListsOverride,
  type SuggestionRow,
  getContributorContactHintFromSuggestion,
  getContributorFacingMessageFromSuggestion,
  getExploreNodeId,
  initSuggestionEditDraft,
  sanitizeAdminProposedAddLinks,
} from '@/lib/admin-suggestion-shared';
import { AdminSuggestionFormBody } from '@/components/admin/AdminPageClient';
import { useAdminSuggestionCardImageUrl } from '@/components/admin/use-admin-suggestion-card-image';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';

export function AdminSuggestionDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const t = useTranslations('admin');
  const tCommon = useTranslations('common');
  const pushToast = useToastStore((s) => s.pushToast);
  const { isAdmin, isLoading } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<SuggestionRow | null>(null);
  const [nodeNames, setNodeNames] = useState<Record<string, string>>({});
  const [editDraft, setEditDraft] = useState<Record<string, unknown> | null>(
    null
  );
  const [adminComment, setAdminComment] = useState('');
  const [busy, setBusy] = useState(false);
  const cardPreviewUrl = useAdminSuggestionCardImageUrl(row);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/suggestions/${encodeURIComponent(id)}`);
      if (res.status === 404) {
        setRow(null);
        return;
      }
      if (!res.ok) {
        pushToast(t('detailLoadError'), 'error');
        return;
      }
      const j = (await res.json()) as {
        suggestion: SuggestionRow;
        nodeNames: Record<string, string>;
      };
      setRow(j.suggestion);
      setNodeNames(j.nodeNames ?? {});
      setEditDraft(initSuggestionEditDraft(j.suggestion));
    } finally {
      setLoading(false);
    }
  }, [id, pushToast, t]);

  useEffect(() => {
    if (isLoading) return;
    if (!isAdmin) {
      router.replace(treeInventionPath(getDefaultTreeNodeId()));
      return;
    }
    void load();
  }, [isAdmin, isLoading, load, router]);

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
      router.push('/admin');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [adminComment, editDraft, pushToast, row, router, t]);

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
      router.push('/admin');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [adminComment, pushToast, row, router, t]);

  if (isLoading || loading) {
    return (
      <AppContentShell className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        {tCommon('loading')}
      </AppContentShell>
    );
  }

  if (!isAdmin || !row) {
    return (
      <AppContentShell className="flex min-h-[40vh] flex-col items-center justify-center gap-2">
        <p className="text-muted-foreground">{t('detailNotFound')}</p>
        <Link href="/admin" className="text-accent underline">
          {t('backToAdmin')}
        </Link>
      </AppContentShell>
    );
  }

  const readOnly = row.status !== 'pending';
  const exploreId = getExploreNodeId(row);
  const isAnonFeedback = row.suggestion_type === 'anonymous_feedback';
  const contributorNote = getContributorFacingMessageFromSuggestion(row);
  const contributorContactHint = getContributorContactHintFromSuggestion(row);

  return (
    <AppContentShell className="flex w-full flex-1 flex-col gap-4 pb-12 text-foreground">
      {contributorNote ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-950/25 p-4 ring-1 ring-amber-500/20">
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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="text-[13px] text-accent underline-offset-2 hover:underline"
            >
              {t('backToAdmin')}
            </Link>
            {exploreId ? (
              <a
                href={treeInventionPath(exploreId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-muted-foreground underline-offset-2 hover:underline"
              >
                {t('openInTree')}
              </a>
            ) : null}
          </div>

          <h1
            className="text-lg font-semibold md:text-xl"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            }}
          >
            {t('detailTitle')}
          </h1>

          <p className="text-[12px] text-muted-foreground">
            {row.suggestion_type} ·{' '}
            {new Date(row.created_at).toLocaleString()}
          </p>
        </div>
        {cardPreviewUrl ? (
          <div className="w-[min(160px,40vw)] shrink-0 overflow-hidden rounded-lg border border-border bg-page">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL dynamique graphe / stockage */}
            <img
              src={cardPreviewUrl}
              alt=""
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
        ) : null}
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
      />

      {!readOnly ? (
        <div className="space-y-3 border-t border-border pt-4">
          <label className="block text-[12px] text-muted-foreground">
            {t('adminCommentLabel')}
            <textarea
              value={adminComment}
              onChange={(e) => setAdminComment(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-foreground"
              placeholder={t('adminCommentPlaceholder')}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runApprove()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {isAnonFeedback ? t('archiveAnonymous') : t('approve')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runReject()}
              className="rounded-md border border-red-600 px-4 py-2 text-[13px] font-medium text-red-600 disabled:opacity-50"
            >
              {isAnonFeedback ? t('ignoreAnonymous') : t('reject')}
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-border pt-4 text-[12px] text-muted-foreground">
          {row.status === 'approved' ? t('approved') : t('rejected')}
          {row.admin_comment ? (
            <p className="mt-2 italic">{row.admin_comment}</p>
          ) : null}
        </div>
      )}
    </AppContentShell>
  );
}

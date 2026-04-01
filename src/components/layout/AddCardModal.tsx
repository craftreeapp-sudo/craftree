'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth-store';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useToastStore } from '@/stores/toast-store';
import { buildPeerSearchBlobMap } from '@/lib/suggest-peer-search';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { normalizeInventionName, slugify } from '@/lib/utils';
import { findSimilarNodeNames } from '@/lib/suggest-similar-names';
import {
  SuggestionNodeForm,
  createEmptySuggestNodeFormState,
  type SuggestNodeFormState,
} from '@/components/ui/SuggestionNodeForm';

type SuggestFieldErrors = Partial<
  Record<keyof SuggestNodeFormState, string>
>;

function validateSuggestForm(
  form: SuggestNodeFormState,
  te: (key: string) => string
): SuggestFieldErrors {
  const err: SuggestFieldErrors = {};
  if (!form.name.trim()) err.name = te('fieldErrorNameRequired');
  if (!form.description.trim()) {
    err.description = te('fieldErrorDescriptionRequired');
  }
  const y = form.year_approx.trim();
  if (y !== '') {
    const n = Number(y);
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      err.year_approx = te('fieldErrorYearInvalid');
    }
  }
  return err;
}

function apiErrorMessage(
  json: unknown,
  fallback: string
): string {
  const j = json as { message?: string; error?: string };
  if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
  if (typeof j.error === 'string' && j.error.trim()) return j.error.trim();
  return fallback;
}
import { SuggestLinkSection } from '@/components/ui/SuggestLinkEditRows';
import type { SuggestLinkSnapshot } from '@/lib/suggestion-link-snapshot';
import {
  RelationType as RT,
  type NodeCategory,
  type RelationType,
} from '@/lib/types';

/** Id fictif pour les sections de liens (aucun nœud réel ne doit utiliser cette valeur). */
const NEW_NODE_PLACEHOLDER_ID = '__craftree_new_node__';

type PendingAddLink = {
  tempId: string;
  peerId: string;
  section: 'ledTo' | 'builtUpon';
  relation_type: RelationType;
};

function tagsCsvToArray(tags: string): string[] {
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function proposedIdFromForm(form: SuggestNodeFormState): string {
  return slugify(form.name.trim()) || 'node';
}

function suggestFormToAdminBody(form: SuggestNodeFormState) {
  const tagsArr = tagsCsvToArray(form.tags);
  return {
    name: form.name.trim(),
    name_en: form.name.trim(),
    description: form.description.trim(),
    category: form.category,
    era: form.era,
    year_approx:
      form.year_approx.trim() === ''
        ? null
        : Number(form.year_approx.trim()),
    origin: form.origin.trim() || undefined,
    tags: tagsArr.length ? tagsArr.join(', ') : '',
    naturalOrigin:
      form.naturalOrigin === '' ? null : form.naturalOrigin,
    chemicalNature:
      form.chemicalNature === '' ? null : form.chemicalNature,
  };
}

function suggestFormToSuggestionNodePayload(form: SuggestNodeFormState) {
  const tags = tagsCsvToArray(form.tags);
  const pid = proposedIdFromForm(form);
  return {
    name: form.name.trim(),
    name_en: form.name.trim(),
    description: form.description.trim(),
    category: form.category,
    era: form.era,
    year_approx:
      form.year_approx.trim() === ''
        ? null
        : Number(form.year_approx.trim()),
    origin: form.origin.trim() || null,
    proposed_id: pid,
    tags,
    naturalOrigin:
      form.naturalOrigin === '' ? null : form.naturalOrigin,
    chemicalNature:
      form.chemicalNature === '' ? null : form.chemicalNature,
    dimension: null as string | null,
    materialLevel: null as string | null,
  };
}

function pendingToApiLinks(
  pending: PendingAddLink[],
  proposedPlaceholder: string
): { source_id: string; target_id: string; relation_type: RelationType }[] {
  return pending.map((p) => ({
    source_id: p.section === 'ledTo' ? proposedPlaceholder : p.peerId,
    target_id: p.section === 'ledTo' ? p.peerId : proposedPlaceholder,
    relation_type: p.relation_type,
  }));
}

export function AddCardModal() {
  const locale = useLocale();
  const tEditor = useTranslations('editor');
  const tAuth = useTranslations('auth');
  const tc = useTranslations('common');
  const tExplore = useTranslations('explore');
  const open = useUIStore((s) => s.addCardModalOpen);
  const setOpen = useUIStore((s) => s.setAddCardModalOpen);
  const { isAdmin } = useAuthStore();
  const refreshData = useGraphStore((s) => s.refreshData);
  const graphNodes = useGraphStore((s) => s.nodes);
  const getNodeById = useGraphStore((s) => s.getNodeById);
  const pushToast = useToastStore((s) => s.pushToast);
  const detailsById = useNodeDetailsStore((s) => s.byId);

  const [form, setForm] = useState<SuggestNodeFormState>(() =>
    createEmptySuggestNodeFormState()
  );
  const [fieldErrors, setFieldErrors] = useState<SuggestFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingAddLinks, setPendingAddLinks] = useState<PendingAddLink[]>(
    []
  );
  const [ledToOpen, setLedToOpen] = useState(true);
  const [builtUponOpen, setBuiltUponOpen] = useState(true);

  const setFormAndClearErrors = useCallback(
    (u: React.SetStateAction<SuggestNodeFormState>) => {
      setFieldErrors({});
      setForm(u);
    },
    []
  );

  useEffect(() => {
    if (open) {
      setForm(createEmptySuggestNodeFormState());
      setFieldErrors({});
      setSubmitting(false);
      setPendingAddLinks([]);
      setLedToOpen(true);
      setBuiltUponOpen(true);
      if (useGraphStore.getState().nodes.length === 0) {
        void refreshData();
      }
    }
  }, [open, refreshData]);

  const peerSearchBlobMap = useMemo(
    () => buildPeerSearchBlobMap(graphNodes, detailsById),
    [graphNodes, detailsById]
  );

  const similarNameMatches = useMemo(
    () => findSimilarNodeNames(form.name, graphNodes, locale, 8),
    [form.name, graphNodes, locale]
  );

  const addPendingPeer = useCallback(
    (section: 'ledTo' | 'builtUpon', peerId: string) => {
      setPendingAddLinks((prev) => {
        if (prev.some((p) => p.section === section && p.peerId === peerId)) {
          return prev;
        }
        return [
          ...prev,
          {
            tempId: `pending-${crypto.randomUUID()}`,
            peerId,
            section,
            relation_type: RT.MATERIAL,
          },
        ];
      });
    },
    []
  );

  const onRemovePendingLink = useCallback((linkId: string) => {
    setPendingAddLinks((prev) => prev.filter((p) => p.tempId !== linkId));
  }, []);

  const suggestLedToRows = useMemo(() => {
    return pendingAddLinks
      .filter((p) => p.section === 'ledTo')
      .map((p) => {
        const peer = getNodeById(p.peerId);
        if (!peer) return null;
        const value: SuggestLinkSnapshot = {
          id: p.tempId,
          relation_type: p.relation_type,
          notes: '',
          is_optional: false,
        };
        return {
          linkId: p.tempId,
          peerId: p.peerId,
          peerLabel: pickNodeDisplayName(
            locale,
            peer.name,
            detailsById[peer.id]?.name_en ?? peer.name_en
          ),
          peerCategory: peer.category as NodeCategory,
          value,
          variant: 'pendingAdd' as const,
        };
      })
      .filter(
        (
          x
        ): x is {
          linkId: string;
          peerId: string;
          peerLabel: string;
          peerCategory: NodeCategory;
          value: SuggestLinkSnapshot;
          variant: 'pendingAdd';
        } => x !== null
      );
  }, [pendingAddLinks, getNodeById, locale, detailsById]);

  const suggestRecipeRows = useMemo(() => {
    return pendingAddLinks
      .filter((p) => p.section === 'builtUpon')
      .map((p) => {
        const peer = getNodeById(p.peerId);
        if (!peer) return null;
        const value: SuggestLinkSnapshot = {
          id: p.tempId,
          relation_type: p.relation_type,
          notes: '',
          is_optional: false,
        };
        return {
          linkId: p.tempId,
          peerId: p.peerId,
          peerLabel: pickNodeDisplayName(
            locale,
            peer.name,
            detailsById[peer.id]?.name_en ?? peer.name_en
          ),
          peerCategory: peer.category as NodeCategory,
          value,
          variant: 'pendingAdd' as const,
        };
      })
      .filter(
        (
          x
        ): x is {
          linkId: string;
          peerId: string;
          peerLabel: string;
          peerCategory: NodeCategory;
          value: SuggestLinkSnapshot;
          variant: 'pendingAdd';
        } => x !== null
      );
  }, [pendingAddLinks, getNodeById, locale, detailsById]);

  const onClose = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const onSave = useCallback(async () => {
    const validation = validateSuggestForm(form, tEditor);
    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      pushToast(tEditor('toastFixFormFields'), 'error');
      return;
    }
    setFieldErrors({});

    const body = suggestFormToAdminBody(form);
    const proposedPlaceholder = proposedIdFromForm(form);
    let nodesForCheck = graphNodes;
    if (nodesForCheck.length === 0) {
      await refreshData();
      nodesForCheck = useGraphStore.getState().nodes;
    }
    const normNew = normalizeInventionName(body.name);
    if (
      nodesForCheck.some(
        (n) => normalizeInventionName(n.name) === normNew
      )
    ) {
      setFieldErrors({ name: tEditor('toastNameAlreadyExists') });
      pushToast(tEditor('toastNameAlreadyExists'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (isAdmin) {
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          if (
            res.status === 409 &&
            (e as { error?: string }).error === 'name_exists'
          ) {
            setFieldErrors({ name: tEditor('toastNameAlreadyExists') });
          }
          pushToast(apiErrorMessage(e, tEditor('toastError')), 'error');
          return;
        }
        const created = (await res.json().catch(() => ({}))) as {
          node?: { id?: string };
        };
        const newId = created.node?.id;
        if (newId && pendingAddLinks.length > 0) {
          for (const p of pendingAddLinks) {
            const source_id =
              p.section === 'ledTo' ? newId : p.peerId;
            const target_id =
              p.section === 'ledTo' ? p.peerId : newId;
            const lr = await fetch('/api/links', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                source_id,
                target_id,
                relation_type: p.relation_type,
              }),
            });
            if (!lr.ok) {
              const e = await lr.json().catch(() => ({}));
              pushToast(apiErrorMessage(e, tEditor('toastError')), 'error');
              break;
            }
          }
        }
        pushToast(tEditor('toastNodeCreated'), 'success');
        setOpen(false);
        await refreshData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('craftree:editor-refresh'));
        }
        return;
      }

      const nodePayload = suggestFormToSuggestionNodePayload(form);
      const links = pendingToApiLinks(
        pendingAddLinks,
        proposedPlaceholder
      );

      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_type: 'new_node',
          node_id: null,
          data: {
            node: nodePayload,
            links,
          },
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        pushToast(apiErrorMessage(e, tEditor('toastError')), 'error');
        return;
      }
      pushToast(tAuth('suggestionSent'), 'success');
      setOpen(false);
    } catch {
      pushToast(tEditor('toastNetworkError'), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [
    form,
    graphNodes,
    isAdmin,
    pendingAddLinks,
    pushToast,
    refreshData,
    setOpen,
    tAuth,
    tEditor,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-card-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={tc('close')}
        onClick={onClose}
      />
      <div
        className="relative z-[1] flex max-h-[min(90dvh,800px)] w-full max-w-md flex-col overflow-hidden rounded-xl glass-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 id="add-card-modal-title" className="text-lg font-semibold">
            {tEditor('panelNewInvention')}
          </h2>
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-2xl leading-none text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
            onClick={onClose}
            aria-label={tc('close')}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <SuggestionNodeForm
            form={form}
            setForm={setFormAndClearErrors}
            baselineForm={null}
            similarNameMatches={similarNameMatches}
            showFieldHints
            fieldErrors={fieldErrors}
          />
          <p className="mt-6 text-[10px] leading-snug text-muted-foreground">
            {tEditor('addCardHintLinks')}
          </p>
          <SuggestLinkSection
            className="!mt-3"
            sectionTitle={tExplore('ledTo')}
            count={suggestLedToRows.length}
            open={ledToOpen}
            onToggleOpen={() => setLedToOpen((v) => !v)}
            emptyLabel={tExplore('noDownstream')}
            currentNodeId={NEW_NODE_PLACEHOLDER_ID}
            locale={locale}
            graphNodes={graphNodes}
            peerSearchBlobMap={peerSearchBlobMap}
            detailsById={detailsById}
            existingRows={suggestLedToRows}
            onRemove={onRemovePendingLink}
            onAddPeer={(peerId) => addPendingPeer('ledTo', peerId)}
          />
          <SuggestLinkSection
            className="!mt-4"
            sectionTitle={tExplore('builtUpon')}
            count={suggestRecipeRows.length}
            open={builtUponOpen}
            onToggleOpen={() => setBuiltUponOpen((v) => !v)}
            emptyLabel={tExplore('noUpstream')}
            currentNodeId={NEW_NODE_PLACEHOLDER_ID}
            locale={locale}
            graphNodes={graphNodes}
            peerSearchBlobMap={peerSearchBlobMap}
            detailsById={detailsById}
            existingRows={suggestRecipeRows}
            onRemove={onRemovePendingLink}
            onAddPeer={(peerId) => addPendingPeer('builtUpon', peerId)}
          />
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onSave()}
            className="rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {isAdmin ? tc('save') : tAuth('sendSuggestion')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-500 disabled:opacity-50"
          >
            {tc('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}

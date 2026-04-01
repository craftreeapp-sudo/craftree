'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { useAuthStore } from '@/stores/auth-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useToastStore } from '@/stores/toast-store';
import {
  pickNodeDisplayName,
  pickNodeDescriptionForLocale,
} from '@/lib/node-display-name';
import { buildPeerSearchBlobMap } from '@/lib/suggest-peer-search';
import {
  SuggestionNodeForm,
  createEmptySuggestNodeFormState,
  type SuggestNodeFormState,
} from '@/components/ui/SuggestionNodeForm';
import { computeDiff } from '@/lib/suggestion-diff';
import {
  craftingLinkToSnapshot,
  computeLinkSuggestionDiff,
  computeRemovedLinkIds,
  type SuggestLinkSnapshot,
  type SuggestLinkContextEntry,
} from '@/lib/suggestion-link-snapshot';
import { SuggestLinkSection } from '@/components/ui/SuggestLinkEditRows';
import {
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';
import type {
  NodeCategory,
  SeedNode,
  TechNodeBasic,
  Era,
  TechNodeDetails,
} from '@/lib/types';
import { RelationType } from '@/lib/types';

type PendingAddLink = {
  tempId: string;
  peerId: string;
  section: 'ledTo' | 'builtUpon';
  relation_type: RelationType;
};

const staggerItem = {
  hidden: { opacity: 0, x: 14 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function SuggestNodeCorrectionPanel({
  node,
  onClose,
  variant = 'suggestion',
  onAdminSaved,
}: {
  node: TechNodeBasic;
  onClose: () => void;
  /** `admin` : titre « Modifier », bouton Sauvegarder, écriture directe (API) au lieu d’une suggestion. */
  variant?: 'suggestion' | 'admin';
  onAdminSaved?: () => void | Promise<void>;
}) {
  const locale = useLocale();
  const tExplore = useTranslations('explore');
  const tSidebar = useTranslations('sidebar');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tEditor = useTranslations('editor');

  const getNodeById = useGraphStore((s) => s.getNodeById);
  const graphNodes = useGraphStore((s) => s.nodes);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const getRecipeForNode = useGraphStore((s) => s.getRecipeForNode);
  const getUsagesOfNode = useGraphStore((s) => s.getUsagesOfNode);
  const pushToast = useToastStore((s) => s.pushToast);
  const { user } = useAuthStore();
  const detailsById = useNodeDetailsStore((s) => s.byId);

  const [suggestForm, setSuggestForm] = useState<SuggestNodeFormState>(() =>
    createEmptySuggestNodeFormState()
  );
  const [originalSnapshot, setOriginalSnapshot] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [suggestSubmitting, setSuggestSubmitting] = useState(false);
  const [suggestLinkEdits, setSuggestLinkEdits] = useState<
    Record<string, SuggestLinkSnapshot>
  >({});
  const [pendingAddLinks, setPendingAddLinks] = useState<PendingAddLink[]>([]);
  const [originalLinkEdits, setOriginalLinkEdits] = useState<Record<
    string,
    SuggestLinkSnapshot
  > | null>(null);
  const [suggestLedToOpen, setSuggestLedToOpen] = useState(true);
  const [suggestBuiltUponOpen, setSuggestBuiltUponOpen] = useState(true);
  const [suggestContactEmail, setSuggestContactEmail] = useState('');
  const [suggestContributorMessage, setSuggestContributorMessage] =
    useState('');
  const [baselineForm, setBaselineForm] = useState<SuggestNodeFormState | null>(
    null
  );
  /** Ligne `nodes` complète (API) — champs non présents dans le formulaire suggestion (dimension…). */
  const [seedNode, setSeedNode] = useState<SeedNode | null>(null);
  /** Liens existants marqués pour suppression : affichage orange + restauration. */
  const [stagedLinkRemovals, setStagedLinkRemovals] = useState<
    Record<string, SuggestLinkSnapshot>
  >({});

  const snapshotFromForm = useCallback(
    (f: SuggestNodeFormState, uiLocale: string) => {
      const frenchUi = uiLocale === 'fr' || uiLocale.startsWith('fr-');
      const tagsArr = f.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const naturalOrigin =
        f.naturalOrigin === '' ? null : f.naturalOrigin;
      const chemicalNature =
        f.chemicalNature === '' ? null : f.chemicalNature;
      const base = {
        name: f.name.trim(),
        category: f.category,
        era: f.era,
        year_approx:
          f.year_approx.trim() === '' ? null : Number(f.year_approx.trim()),
        origin: f.origin.trim(),
        tags: tagsArr,
        naturalOrigin,
        chemicalNature,
      };
      if (frenchUi) {
        return { ...base, description: f.description.trim() } as Record<
          string,
          unknown
        >;
      }
      return { ...base, description_en: f.description.trim() } as Record<
        string,
        unknown
      >;
    },
    []
  );

  const loadSuggestData = useCallback(async () => {
    setBaselineForm(null);
    setStagedLinkRemovals({});
    const res = await fetch(`/api/nodes/${encodeURIComponent(node.id)}`);
    if (!res.ok) return;
    const json = (await res.json()) as {
      node: SeedNode;
      details?: {
        description?: string;
        description_en?: string;
        tags?: string[];
      };
    };
    const seed = json.node;
    const details = json.details;
    const descriptionText = pickNodeDescriptionForLocale(
      locale,
      seed.description,
      details?.description_en ?? seed.description_en
    );
    const tagList = [
      ...(seed.tags ?? []),
      ...(details?.tags ?? []),
    ];
    const seenTag = new Set<string>();
    const mergedTags: string[] = [];
    for (const t of tagList) {
      const s = String(t).trim();
      if (!s || seenTag.has(s)) continue;
      seenTag.add(s);
      mergedTags.push(s);
    }
    const formSeed: SuggestNodeFormState = {
      name: seed.name,
      description: descriptionText,
      category: seed.category as NodeCategory,
      era: seed.era as Era,
      year_approx:
        seed.year_approx === undefined || seed.year_approx === null
          ? ''
          : String(seed.year_approx),
      origin: seed.origin ?? '',
      tags: mergedTags.join(', '),
      naturalOrigin: parseNaturalOrigin(seed.naturalOrigin ?? undefined),
      chemicalNature: parseChemicalNature(seed.chemicalNature ?? undefined),
    };
    setSuggestForm(formSeed);
    setBaselineForm(structuredClone(formSeed));
    setSeedNode(seed);
    const snap = snapshotFromForm(formSeed, locale);
    setOriginalSnapshot(snap);

    const ledTo = getUsagesOfNode(node.id);
    const recipe = getRecipeForNode(node.id);
    const linkMap: Record<string, SuggestLinkSnapshot> = {};
    for (const { link } of ledTo) {
      linkMap[link.id] = craftingLinkToSnapshot(link);
    }
    for (const link of recipe) {
      linkMap[link.id] = craftingLinkToSnapshot(link);
    }
    const linkCopy = JSON.parse(
      JSON.stringify(linkMap)
    ) as Record<string, SuggestLinkSnapshot>;
    setOriginalLinkEdits(linkCopy);
    setSuggestLinkEdits(
      JSON.parse(JSON.stringify(linkMap)) as Record<string, SuggestLinkSnapshot>
    );
    setSuggestLedToOpen(true);
    setSuggestBuiltUponOpen(true);
    setPendingAddLinks([]);
    setSuggestContactEmail('');
    setSuggestContributorMessage('');
  }, [
    node.id,
    getUsagesOfNode,
    getRecipeForNode,
    locale,
    snapshotFromForm,
  ]);

  useEffect(() => {
    void loadSuggestData();
  }, [loadSuggestData]);

  useEffect(() => {
    setSuggestContactEmail('');
    setSuggestContributorMessage('');
  }, [node.id]);

  const addPendingPeer = useCallback(
    (section: 'ledTo' | 'builtUpon', peerId: string) => {
      setPendingAddLinks((prev) => {
        if (prev.some((p) => p.section === section && p.peerId === peerId)) {
          return prev;
        }
        if (section === 'ledTo') {
          const already = getUsagesOfNode(node.id).some(
            ({ product }) => product.id === peerId
          );
          if (already) return prev;
        } else {
          const already = getRecipeForNode(node.id).some(
            (l) => l.source_id === peerId
          );
          if (already) return prev;
        }
        return [
          ...prev,
          {
            tempId: `pending-${crypto.randomUUID()}`,
            peerId,
            section,
            relation_type: RelationType.MATERIAL,
          },
        ];
      });
    },
    [node.id, getUsagesOfNode, getRecipeForNode]
  );

  const onSuggestLinkRemove = useCallback((linkId: string) => {
    if (linkId.startsWith('pending-')) {
      setPendingAddLinks((prev) => prev.filter((p) => p.tempId !== linkId));
      return;
    }
    setSuggestLinkEdits((prev) => {
      const snap = prev[linkId];
      if (!snap) return prev;
      setStagedLinkRemovals((sr) => ({ ...sr, [linkId]: snap }));
      const next = { ...prev };
      delete next[linkId];
      return next;
    });
  }, []);

  const onRestoreLink = useCallback((linkId: string) => {
    setStagedLinkRemovals((prev) => {
      const snap = prev[linkId];
      if (!snap) return prev;
      setSuggestLinkEdits((edits) => ({ ...edits, [linkId]: snap }));
      const next = { ...prev };
      delete next[linkId];
      return next;
    });
  }, []);

  const submitSuggestion = useCallback(async () => {
    if (!originalSnapshot || !originalLinkEdits) return;
    setSuggestSubmitting(true);
    try {
      const proposedNode = snapshotFromForm(suggestForm, locale);
      const diff = computeDiff(originalSnapshot, proposedNode);
      const linkDiff = computeLinkSuggestionDiff(
        originalLinkEdits,
        suggestLinkEdits
      );
      const removedLinkIds = computeRemovedLinkIds(
        originalLinkEdits,
        suggestLinkEdits
      );

      const proposedAddLinks = pendingAddLinks.map((p) => ({
        source_id: p.section === 'ledTo' ? node.id : p.peerId,
        target_id: p.section === 'ledTo' ? p.peerId : node.id,
        relation_type: p.relation_type,
        section: p.section,
      }));

      const hasNodeChange = Object.keys(diff).length > 0;
      const hasLinkChange =
        Object.keys(linkDiff).length > 0 ||
        removedLinkIds.length > 0 ||
        proposedAddLinks.length > 0;
      const contributorNote = suggestContributorMessage.trim();
      const hasContributorMessage = contributorNote.length > 0;
      if (!hasNodeChange && !hasLinkChange && !hasContributorMessage) {
        pushToast(tAuth('suggestionNothingToSubmit'), 'error');
        return;
      }

      const contactEmail =
        !user && suggestContactEmail.trim()
          ? suggestContactEmail.trim().slice(0, 320)
          : null;

      const linkContext: Record<string, SuggestLinkContextEntry> = {};
      for (const { link, product } of getUsagesOfNode(node.id)) {
        linkContext[link.id] = {
          peerId: product.id,
          peerName: pickNodeDisplayName(
            locale,
            product.name,
            detailsById[product.id]?.name_en
          ),
          section: 'ledTo',
        };
      }
      for (const link of getRecipeForNode(node.id)) {
        const input = getNodeById(link.source_id);
        if (!input) continue;
        linkContext[link.id] = {
          peerId: input.id,
          peerName: pickNodeDisplayName(
            locale,
            input.name,
            detailsById[input.id]?.name_en
          ),
          section: 'builtUpon',
        };
      }

      const proposed = {
        ...proposedNode,
        linkEdits: suggestLinkEdits,
      };
      const originalPayload = {
        ...originalSnapshot,
        linkEdits: originalLinkEdits,
      };

      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_type: 'edit_node',
          node_id: node.id,
          data: {
            original: originalPayload,
            proposed,
            diff,
            linkDiff,
            linkContext,
            removedLinkIds,
            proposedAddLinks,
            ...(contactEmail != null ? { contactEmail } : {}),
            ...(hasContributorMessage
              ? { contributorMessage: contributorNote.slice(0, 4000) }
              : {}),
          },
        }),
      });
      if (!res.ok) {
        pushToast(
          (await res.json().catch(() => ({})))?.error ?? 'Erreur',
          'error'
        );
        return;
      }
      pushToast(
        user ? tAuth('suggestionSentReview') : tAuth('suggestionSentAnonymous'),
        'success'
      );
      onClose();
    } finally {
      setSuggestSubmitting(false);
    }
  }, [
    node,
    originalSnapshot,
    originalLinkEdits,
    suggestForm,
    suggestLinkEdits,
    snapshotFromForm,
    pushToast,
    tAuth,
    getUsagesOfNode,
    getRecipeForNode,
    getNodeById,
    locale,
    detailsById,
    pendingAddLinks,
    user,
    suggestContactEmail,
    suggestContributorMessage,
    onClose,
  ]);

  const submitAdminSave = useCallback(async () => {
    if (variant !== 'admin' || !originalSnapshot || !originalLinkEdits || !seedNode) {
      return;
    }
    setSuggestSubmitting(true);
    try {
      const proposedNode = snapshotFromForm(suggestForm, locale);
      const diff = computeDiff(originalSnapshot, proposedNode);
      const linkDiff = computeLinkSuggestionDiff(
        originalLinkEdits,
        suggestLinkEdits
      );
      const removedLinkIds = computeRemovedLinkIds(
        originalLinkEdits,
        suggestLinkEdits
      );
      const proposedAddLinks = pendingAddLinks.map((p) => ({
        source_id: p.section === 'ledTo' ? node.id : p.peerId,
        target_id: p.section === 'ledTo' ? p.peerId : node.id,
        relation_type: p.relation_type,
        section: p.section,
      }));

      const hasNodeChange = Object.keys(diff).length > 0;
      const hasLinkChange =
        Object.keys(linkDiff).length > 0 ||
        removedLinkIds.length > 0 ||
        proposedAddLinks.length > 0;
      if (!hasNodeChange && !hasLinkChange) {
        pushToast(tAuth('suggestionNothingToSubmit'), 'error');
        return;
      }

      const tagsArr = suggestForm.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const frenchUi = locale === 'fr' || locale.startsWith('fr-');

      if (hasNodeChange) {
        const putBody: Record<string, unknown> = {
          name: suggestForm.name.trim(),
          name_en: (seedNode.name_en ?? '').trim() || suggestForm.name.trim(),
          category: suggestForm.category,
          era: suggestForm.era,
          year_approx:
            suggestForm.year_approx.trim() === ''
              ? null
              : Number(suggestForm.year_approx.trim()),
          origin: suggestForm.origin.trim() || undefined,
          tags: tagsArr,
          wikipedia_url: seedNode.wikipedia_url ?? undefined,
          dimension: seedNode.dimension ?? null,
          materialLevel: seedNode.materialLevel ?? null,
          naturalOrigin:
            suggestForm.naturalOrigin === ''
              ? null
              : String(suggestForm.naturalOrigin),
          chemicalNature:
            suggestForm.chemicalNature === ''
              ? null
              : String(suggestForm.chemicalNature),
        };
        if (frenchUi) {
          putBody.description = suggestForm.description.trim();
          putBody.description_en = seedNode.description_en;
        } else {
          putBody.description = seedNode.description ?? '';
          putBody.description_en = suggestForm.description.trim();
        }

        const putRes = await fetch(
          `/api/nodes/${encodeURIComponent(node.id)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(putBody),
          }
        );
        if (!putRes.ok) {
          const err = await putRes.json().catch(() => ({}));
          pushToast(
            String((err as { error?: string }).error ?? tEditor('toastError')),
            'error'
          );
          return;
        }
      }

      for (const linkId of removedLinkIds) {
        const delRes = await fetch(
          `/api/links/${encodeURIComponent(linkId)}`,
          { method: 'DELETE' }
        );
        if (!delRes.ok) {
          pushToast(tEditor('toastSaveError'), 'error');
          return;
        }
      }

      for (const [linkId, { to }] of Object.entries(linkDiff)) {
        const putL = await fetch(
          `/api/links/${encodeURIComponent(linkId)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              relation_type: to.relation_type,
              notes: to.notes.trim() || undefined,
              is_optional: to.is_optional,
            }),
          }
        );
        if (!putL.ok) {
          pushToast(tEditor('toastSaveError'), 'error');
          return;
        }
      }

      for (const p of pendingAddLinks) {
        const postRes = await fetch('/api/links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_id: p.section === 'ledTo' ? node.id : p.peerId,
            target_id: p.section === 'ledTo' ? p.peerId : node.id,
            relation_type: p.relation_type,
            is_optional: false,
            notes: '',
          }),
        });
        if (!postRes.ok) {
          const err = await postRes.json().catch(() => ({}));
          pushToast(
            String((err as { error?: string }).error ?? tEditor('toastSaveError')),
            'error'
          );
          return;
        }
      }

      pushToast(tEditor('toastNodeUpdated'), 'success');
      await onAdminSaved?.();
      onClose();
    } finally {
      setSuggestSubmitting(false);
    }
  }, [
    variant,
    originalSnapshot,
    originalLinkEdits,
    seedNode,
    suggestForm,
    suggestLinkEdits,
    pendingAddLinks,
    node.id,
    locale,
    snapshotFromForm,
    pushToast,
    tAuth,
    tEditor,
    onAdminSaved,
    onClose,
  ]);

  const peerSearchBlobMap = useMemo(
    () => buildPeerSearchBlobMap(graphNodes, detailsById),
    [graphNodes, detailsById]
  );

  const detail: TechNodeDetails | undefined = detailsById[node.id];
  const suggestCardImageUrl = useMemo(() => {
    const raw = (detail?.image_url ?? node.image_url)?.trim();
    if (!raw) return null;
    const bust = imageBustByNodeId[node.id] ?? 0;
    return bust > 0
      ? `${raw}${raw.includes('?') ? '&' : '?'}t=${bust}`
      : raw;
  }, [node.id, node.image_url, detail?.image_url, imageBustByNodeId]);

  const suggestLedToRows = useMemo(() => {
    const base = getUsagesOfNode(node.id)
      .map(({ link, product }) => {
        const vActive = suggestLinkEdits[link.id];
        const vStaged = stagedLinkRemovals[link.id];
        if (vActive) {
          const peerId = product.id;
          return {
            linkId: link.id,
            peerId,
            peerLabel: pickNodeDisplayName(
              locale,
              product.name,
              detailsById[product.id]?.name_en
            ),
            peerCategory: product.category as NodeCategory,
            value: vActive,
            variant: 'default' as const,
          };
        }
        if (vStaged) {
          const peerId = product.id;
          return {
            linkId: link.id,
            peerId,
            peerLabel: pickNodeDisplayName(
              locale,
              product.name,
              detailsById[product.id]?.name_en
            ),
            peerCategory: product.category as NodeCategory,
            value: vStaged,
            variant: 'stagedRemoval' as const,
          };
        }
        return null;
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
          variant: 'default' | 'stagedRemoval';
        } => x !== null
      );
    const pendingRows = pendingAddLinks
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
            detailsById[peer.id]?.name_en
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
    return [...base, ...pendingRows];
  }, [
    node.id,
    getNodeById,
    getUsagesOfNode,
    suggestLinkEdits,
    stagedLinkRemovals,
    pendingAddLinks,
    locale,
    detailsById,
  ]);

  const suggestRecipeRows = useMemo(() => {
    const base = getRecipeForNode(node.id)
      .map((link) => {
        const input = getNodeById(link.source_id);
        if (!input) return null;
        const vActive = suggestLinkEdits[link.id];
        const vStaged = stagedLinkRemovals[link.id];
        if (vActive) {
          const peerId = input.id;
          return {
            linkId: link.id,
            peerId,
            peerLabel: pickNodeDisplayName(
              locale,
              input.name,
              detailsById[input.id]?.name_en
            ),
            peerCategory: input.category as NodeCategory,
            value: vActive,
            variant: 'default' as const,
          };
        }
        if (vStaged) {
          const peerId = input.id;
          return {
            linkId: link.id,
            peerId,
            peerLabel: pickNodeDisplayName(
              locale,
              input.name,
              detailsById[input.id]?.name_en
            ),
            peerCategory: input.category as NodeCategory,
            value: vStaged,
            variant: 'stagedRemoval' as const,
          };
        }
        return null;
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
          variant: 'default' | 'stagedRemoval';
        } => x !== null
      );
    const pendingRows = pendingAddLinks
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
            detailsById[peer.id]?.name_en
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
    return [...base, ...pendingRows];
  }, [
    node.id,
    getRecipeForNode,
    getNodeById,
    suggestLinkEdits,
    stagedLinkRemovals,
    pendingAddLinks,
    locale,
    detailsById,
  ]);

  const isDirty = useMemo(() => {
    if (!baselineForm) return false;
    if (JSON.stringify(suggestForm) !== JSON.stringify(baselineForm)) {
      return true;
    }
    if (variant === 'suggestion') {
      if (suggestContributorMessage.trim() !== '') return true;
      if (!user && suggestContactEmail.trim() !== '') return true;
    }
    if (pendingAddLinks.length > 0) return true;
    if (
      originalLinkEdits &&
      JSON.stringify(suggestLinkEdits) !== JSON.stringify(originalLinkEdits)
    ) {
      return true;
    }
    return false;
  }, [
    variant,
    baselineForm,
    suggestForm,
    suggestContributorMessage,
    suggestContactEmail,
    user,
    pendingAddLinks,
    suggestLinkEdits,
    originalLinkEdits,
  ]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      if (!window.confirm(tAuth('suggestLeaveConfirm'))) return;
    }
    onClose();
  }, [isDirty, onClose, tAuth]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div
        variants={staggerItem}
        className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 glass-app-header px-5 py-4"
      >
        <h2 className="text-lg font-semibold text-foreground">
          {variant === 'admin' ? tEditor('panelEditInvention') : tAuth('suggestCorrection')}
        </h2>
        <button
          type="button"
          onClick={requestClose}
          className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:bg-border hover:text-foreground"
          aria-label={tSidebar('backToDetail')}
        >
          <span className="text-xl leading-none">×</span>
        </button>
      </motion.div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4">
        <SuggestionNodeForm
          form={suggestForm}
          setForm={setSuggestForm}
          baselineForm={baselineForm}
          cardImageUrl={suggestCardImageUrl}
        />
        {variant === 'suggestion' ? (
          <>
            <label className="mt-4 block text-[13px] font-medium text-foreground">
              {tAuth('suggestionContributorNoteLabel')}
              <textarea
                value={suggestContributorMessage}
                onChange={(e) => setSuggestContributorMessage(e.target.value)}
                maxLength={4000}
                rows={4}
                className={`mt-2 w-full resize-y rounded-md border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground ${
                  suggestContributorMessage.trim() !== ''
                    ? 'border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30'
                    : 'border-border'
                }`}
                placeholder={tAuth('suggestionContributorNotePlaceholder')}
              />
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {suggestContributorMessage.length}/4000
            </p>
            {!user ? (
              <>
                <label className="mt-4 block text-[13px] font-medium text-foreground">
                  {tAuth('anonymousFeedbackEmail')}
                  <input
                    type="email"
                    value={suggestContactEmail}
                    onChange={(e) => setSuggestContactEmail(e.target.value)}
                    autoComplete="email"
                    className={`mt-2 w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground ${
                      suggestContactEmail.trim() !== ''
                        ? 'border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30'
                        : 'border-border'
                    }`}
                  />
                </label>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {tAuth('anonymousFeedbackHint')}
                </p>
                <p className="mt-3 text-[12px] text-muted-foreground">
                  {tAuth('suggestAnonymousNotice')}
                </p>
              </>
            ) : null}
          </>
        ) : null}
        <div className="mt-6">
          <SuggestLinkSection
            className="!mt-0"
            sectionTitle={tExplore('ledTo')}
            count={suggestLedToRows.length}
            open={suggestLedToOpen}
            onToggleOpen={() => setSuggestLedToOpen((v) => !v)}
            emptyLabel={tExplore('noDownstream')}
            currentNodeId={node.id}
            locale={locale}
            graphNodes={graphNodes}
            peerSearchBlobMap={peerSearchBlobMap}
            detailsById={detailsById}
            existingRows={suggestLedToRows}
            onRemove={onSuggestLinkRemove}
            onRestoreLink={onRestoreLink}
            onAddPeer={(peerId) => addPendingPeer('ledTo', peerId)}
          />
          <SuggestLinkSection
            sectionTitle={tExplore('builtUpon')}
            count={suggestRecipeRows.length}
            open={suggestBuiltUponOpen}
            onToggleOpen={() => setSuggestBuiltUponOpen((v) => !v)}
            emptyLabel={tExplore('noUpstream')}
            currentNodeId={node.id}
            locale={locale}
            graphNodes={graphNodes}
            peerSearchBlobMap={peerSearchBlobMap}
            detailsById={detailsById}
            existingRows={suggestRecipeRows}
            onRemove={onSuggestLinkRemove}
            onRestoreLink={onRestoreLink}
            onAddPeer={(peerId) => addPendingPeer('builtUpon', peerId)}
          />
        </div>
        </div>
        <div className="shrink-0 glass-footer px-5 pb-4 pt-3">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={suggestSubmitting}
              onClick={() =>
                void (variant === 'admin' ? submitAdminSave() : submitSuggestion())
              }
              className="rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-amber-500 disabled:opacity-50"
            >
              {variant === 'admin' ? tCommon('save') : tAuth('sendSuggestion')}
            </button>
            <button
              type="button"
              onClick={requestClose}
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-500"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { useAuthStore } from '@/stores/auth-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { useToastStore } from '@/stores/toast-store';
import { pickNodeDisplayName } from '@/lib/node-display-name';
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
import {
  SuggestLinkEditCard,
  SuggestLinkSection,
  type SuggestLinkCardVariant,
} from '@/components/ui/SuggestLinkEditRows';
import { ExploreExtendedPeerRow } from '@/components/explore/ExploreDetailLinkRows';
import {
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';
import type {
  CraftingLink,
  NodeCategory,
  SeedNode,
  TechNodeBasic,
  Era,
  TechNodeDetails,
} from '@/lib/types';
import { RelationType } from '@/lib/types';
import {
  type InventionKindKey,
  inventionKindToNodeFields,
  relationTypeFromInventionKind,
} from '@/lib/invention-classification';
import { mergeDimensionMaterialLevel } from '@/lib/node-dimension';
import { rowIsDraft } from '@/lib/draft-flag';
import { getCategoryColor } from '@/lib/colors';
import { BuiltUponBadgePopover } from '@/components/explore/BuiltUponBadgePopover';
import { seedNodeIsLocked } from '@/lib/node-lock';
import {
  buildExtendedDownstreamPeerInfos,
  buildExtendedUpstreamPeerInfos,
  findLinkByEndpoints,
} from '@/lib/built-upon-utils';
import {
  useUIStore,
  hydrateLinkNeighborhoodModeFromStorage,
  type LinkNeighborhoodMode,
} from '@/stores/ui-store';
import { treeInventionPath } from '@/lib/tree-routes';
import { VALID_RELATIONS } from '@/lib/admin-suggestion-shared';

type PendingAddLink = {
  tempId: string;
  peerId: string;
  section: 'ledTo' | 'builtUpon';
  relation_type: RelationType;
  is_optional?: boolean;
  /** Lien graphe retiré pour ce déplacement (ne pas afficher la carte « suppression »). */
  movedFromLinkId?: string;
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
  adminStayOpenAfterSave = false,
  /** Remplit la hauteur du parent (comparaison doublons) pour que overflow-y-auto du formulaire fonctionne. */
  fillContainerHeight = false,
  /** Comparaison doublons : suppression de cette fiche (confirm + API côté parent). */
  onAdminDeleteCard,
  /** Admin : nombre de cartes en amont direct (badge comme dans le tableau). */
  compareUpstreamCount,
}: {
  node: TechNodeBasic;
  onClose: () => void;
  /** `admin` : titre « Modifier », bouton Sauvegarder, écriture directe (API) au lieu d’une suggestion. */
  variant?: 'suggestion' | 'admin';
  onAdminSaved?: () => void | Promise<void>;
  /** Admin : après sauvegarde réussie, ne pas fermer le panneau (comparaison de doublons). */
  adminStayOpenAfterSave?: boolean;
  fillContainerHeight?: boolean;
  onAdminDeleteCard?: () => void | Promise<void>;
  compareUpstreamCount?: number;
}) {
  const locale = useLocale();
  const tExplore = useTranslations('explore');
  const tSidebar = useTranslations('sidebar');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tEditor = useTranslations('editor');

  const getNodeById = useGraphStore((s) => s.getNodeById);
  const updateNode = useGraphStore((s) => s.updateNode);
  const graphNodes = useGraphStore((s) => s.nodes);
  const graphEdges = useGraphStore((s) => s.edges);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const router = useRouter();
  const linkNeighborhoodMode = useUIStore((s) => s.linkNeighborhoodMode);
  const showExtended = linkNeighborhoodMode === 'direct_and_extended';

  useLayoutEffect(() => {
    hydrateLinkNeighborhoodModeFromStorage();
  }, []);
  const getRecipeForNode = useGraphStore((s) => s.getRecipeForNode);
  const getUsagesOfNode = useGraphStore((s) => s.getUsagesOfNode);
  const pushToast = useToastStore((s) => s.pushToast);
  const { user } = useAuthStore();
  const detailsById = useNodeDetailsStore((s) => s.byId);
  const patchDetail = useNodeDetailsStore((s) => s.patchDetail);

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageActionBusy, setImageActionBusy] = useState<
    'upload' | 'wikimedia' | null
  >(null);

  const snapshotFromForm = useCallback(
    (f: SuggestNodeFormState, _uiLocale: string) => {
      const tagsArr = f.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const naturalOrigin =
        f.naturalOrigin === '' ? null : f.naturalOrigin;
      const chemicalNature =
        f.chemicalNature === '' ? null : f.chemicalNature;
      const dm = mergeDimensionMaterialLevel(
        { dimension: null, materialLevel: null },
        {
          dimension: f.dimension.trim() === '' ? null : f.dimension,
          materialLevel:
            f.materialLevel.trim() === '' ? null : f.materialLevel,
        }
      );
      const wiki = f.wikipedia_url.trim();
      return {
        name: f.name.trim(),
        name_en: f.name_en.trim(),
        category: f.category,
        era: f.era,
        year_approx:
          f.year_approx.trim() === '' ? null : Number(f.year_approx.trim()),
        origin: f.origin.trim(),
        tags: tagsArr,
        naturalOrigin,
        chemicalNature,
        description: f.description.trim(),
        description_en: f.description_en.trim(),
        dimension: dm.dimension,
        materialLevel: dm.materialLevel,
        wikipedia_url: wiki === '' ? null : wiki,
      } as Record<string, unknown>;
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
        name_en?: string;
        description?: string;
        description_en?: string;
        tags?: string[];
      };
    };
    const seed = json.node;
    const details = json.details;
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
    const descFr = seed.description ?? '';
    const descEn = (details?.description_en ?? seed.description_en ?? '').trim();
    const formSeed: SuggestNodeFormState = {
      name: seed.name,
      name_en: (seed.name_en ?? details?.name_en ?? '').trim(),
      description: descFr,
      description_en: descEn,
      category: seed.category as NodeCategory,
      era: seed.era as Era,
      year_approx:
        seed.year_approx === undefined || seed.year_approx === null
          ? ''
          : String(seed.year_approx),
      origin: seed.origin ?? '',
      tags: mergedTags.join(', '),
      naturalOrigin: parseNaturalOrigin(seed.naturalOrigin as string | undefined),
      chemicalNature: parseChemicalNature(seed.chemicalNature ?? undefined),
      dimension: seed.dimension ?? '',
      materialLevel: seed.materialLevel ?? '',
      wikipedia_url: (seed.wikipedia_url ?? '').trim(),
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

  const isDraftCard = useMemo(() => {
    if (seedNode) {
      return rowIsDraft(seedNode as unknown as Record<string, unknown>);
    }
    return node.is_draft === true;
  }, [seedNode, node.is_draft]);

  const adminPanelLocked = useMemo(
    () => variant === 'admin' && seedNode != null && seedNodeIsLocked(seedNode),
    [variant, seedNode]
  );

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
      setPendingAddLinks((prev) => {
        const item = prev.find((p) => p.tempId === linkId);
        const movedFrom = item?.movedFromLinkId?.trim();
        if (movedFrom) {
          setStagedLinkRemovals((sr) => {
            const snap = sr[movedFrom];
            if (snap) {
              setSuggestLinkEdits((edits) => ({ ...edits, [movedFrom]: snap }));
            }
            const next = { ...sr };
            delete next[movedFrom];
            return next;
          });
        }
        return prev.filter((p) => p.tempId !== linkId);
      });
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

  const onChangeLinkInventionKind = useCallback(
    (linkId: string, peerId: string, kind: InventionKindKey) => {
      const relationType = relationTypeFromInventionKind(kind);
      const { dimension, materialLevel } = inventionKindToNodeFields(kind);
      updateNode(peerId, { dimension, materialLevel });
      if (linkId.startsWith('pending-')) {
        setPendingAddLinks((prev) =>
          prev.map((p) =>
            p.tempId === linkId ? { ...p, relation_type: relationType } : p
          )
        );
        return;
      }
      setStagedLinkRemovals((staged) => {
        const st = staged[linkId];
        if (!st) return staged;
        return { ...staged, [linkId]: { ...st, relation_type: relationType } };
      });
      setSuggestLinkEdits((prev) => {
        const snap = prev[linkId];
        if (!snap) return prev;
        return {
          ...prev,
          [linkId]: { ...snap, relation_type: relationType },
        };
      });
    },
    [updateNode]
  );

  const onChangeLinkNeighborhood = useCallback(
    (linkId: string, mode: LinkNeighborhoodMode) => {
      const is_optional = mode === 'direct_and_extended';
      if (linkId.startsWith('pending-')) {
        setPendingAddLinks((prev) =>
          prev.map((p) =>
            p.tempId === linkId ? { ...p, is_optional } : p
          )
        );
        return;
      }
      setStagedLinkRemovals((staged) => {
        const st = staged[linkId];
        if (!st) return staged;
        return { ...staged, [linkId]: { ...st, is_optional } };
      });
      setSuggestLinkEdits((prev) => {
        const snap = prev[linkId];
        if (!snap) return prev;
        return {
          ...prev,
          [linkId]: { ...snap, is_optional },
        };
      });
    },
    []
  );

  const movedFromSuppressIds = useMemo(() => {
    const s = new Set<string>();
    for (const p of pendingAddLinks) {
      const m = p.movedFromLinkId?.trim();
      if (m) s.add(m);
    }
    return s;
  }, [pendingAddLinks]);

  const wouldDuplicateEdge = useCallback(
    (
      source_id: string,
      target_id: string,
      opts?: { ignorePendingTempId?: string; ignoreGraphEdgeId?: string }
    ) => {
      if (!source_id || !target_id || source_id === target_id) return true;
      for (const p of pendingAddLinks) {
        if (opts?.ignorePendingTempId && p.tempId === opts.ignorePendingTempId) {
          continue;
        }
        const s = p.section === 'ledTo' ? node.id : p.peerId;
        const t = p.section === 'ledTo' ? p.peerId : node.id;
        if (s === source_id && t === target_id) return true;
      }
      const stagedIds = new Set(Object.keys(stagedLinkRemovals));
      for (const e of graphEdges) {
        if (opts?.ignoreGraphEdgeId && e.id === opts.ignoreGraphEdgeId) continue;
        if (stagedIds.has(e.id)) continue;
        if (e.source_id === source_id && e.target_id === target_id) return true;
      }
      return false;
    },
    [pendingAddLinks, graphEdges, node.id, stagedLinkRemovals]
  );

  const moveLinkToOtherSection = useCallback(
    (linkId: string, from: 'ledTo' | 'builtUpon') => {
      const to: 'ledTo' | 'builtUpon' = from === 'ledTo' ? 'builtUpon' : 'ledTo';

      if (linkId.startsWith('pending-')) {
        setPendingAddLinks((prev) => {
          const idx = prev.findIndex((p) => p.tempId === linkId);
          if (idx < 0) return prev;
          const p = prev[idx];
          if (p.section !== from) return prev;
          const src = to === 'ledTo' ? node.id : p.peerId;
          const tgt = to === 'ledTo' ? p.peerId : node.id;
          if (wouldDuplicateEdge(src, tgt, { ignorePendingTempId: linkId })) {
            return prev;
          }
          return prev.map((x, i) => (i === idx ? { ...x, section: to } : x));
        });
        return;
      }

      const edge = graphEdges.find((e) => e.id === linkId);
      if (!edge) return;
      const isLedTo = edge.source_id === node.id;
      const currentSec: 'ledTo' | 'builtUpon' = isLedTo ? 'ledTo' : 'builtUpon';
      if (currentSec !== from) return;
      const peerId = isLedTo ? edge.target_id : edge.source_id;

      setSuggestLinkEdits((prevEdits) => {
        const snap =
          prevEdits[linkId] ?? craftingLinkToSnapshot(edge);
        const relType = (VALID_RELATIONS.has(String(snap.relation_type))
          ? snap.relation_type
          : RelationType.MATERIAL) as RelationType;
        const is_opt = Boolean(snap.is_optional);

        const src = to === 'ledTo' ? node.id : peerId;
        const tgt = to === 'ledTo' ? peerId : node.id;
        if (wouldDuplicateEdge(src, tgt, { ignoreGraphEdgeId: linkId })) {
          return prevEdits;
        }

        setStagedLinkRemovals((sr) => ({ ...sr, [linkId]: snap }));
        setPendingAddLinks((pl) => [
          ...pl,
          {
            tempId: `pending-${crypto.randomUUID()}`,
            peerId,
            section: to,
            relation_type: relType,
            is_optional: is_opt,
            movedFromLinkId: linkId,
          },
        ]);
        const next = { ...prevEdits };
        delete next[linkId];
        return next;
      });
    },
    [graphEdges, node.id, wouldDuplicateEdge]
  );

  const showRelationPicker = variant === 'admin' || Boolean(user);

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
        is_optional: Boolean(p.is_optional),
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
      // Laisser le toast s’afficher avant de fermer le panneau (sinon l’utilisateur ne voit souvent rien).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onClose();
        });
      });
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

  const persistAdminPanel = useCallback(
    async (mode: 'save' | 'publish') => {
      if (
        variant !== 'admin' ||
        !originalSnapshot ||
        !originalLinkEdits ||
        !seedNode
      ) {
        return;
      }
      if (seedNodeIsLocked(seedNode)) {
        pushToast(tEditor('toastNodeLockedNoEdit'), 'error');
        return;
      }
      const publish = mode === 'publish';
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
          is_optional: Boolean(p.is_optional),
        }));

        const hasNodeChange = Object.keys(diff).length > 0;
        const proposedNatural =
          suggestForm.naturalOrigin === '' ? null : suggestForm.naturalOrigin;
        const proposedChem =
          suggestForm.chemicalNature === '' ? null : suggestForm.chemicalNature;
        const seedNat = seedNode.naturalOrigin ?? null;
        const seedChem = seedNode.chemicalNature ?? null;
        const natureFieldsDirty =
          proposedNatural !== seedNat || proposedChem !== seedChem;
        const hasLinkChange =
          Object.keys(linkDiff).length > 0 ||
          removedLinkIds.length > 0 ||
          proposedAddLinks.length > 0;

        const tagsArr = suggestForm.tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        const buildFullPutBody = (): Record<string, unknown> => {
          const dm = mergeDimensionMaterialLevel(seedNode, {
            dimension:
              suggestForm.dimension.trim() === ''
                ? null
                : suggestForm.dimension,
            materialLevel:
              suggestForm.materialLevel.trim() === ''
                ? null
                : suggestForm.materialLevel,
          });
          return {
            name: suggestForm.name.trim(),
            name_en:
              suggestForm.name_en.trim() ||
              suggestForm.name.trim(),
            category: suggestForm.category,
            era: suggestForm.era,
            year_approx:
              suggestForm.year_approx.trim() === ''
                ? null
                : Number(suggestForm.year_approx.trim()),
            origin: suggestForm.origin.trim() || undefined,
            tags: tagsArr,
            description: suggestForm.description.trim(),
            description_en: suggestForm.description_en.trim(),
            wikipedia_url: suggestForm.wikipedia_url.trim() || null,
            dimension: dm.dimension,
            materialLevel: dm.materialLevel,
            naturalOrigin:
              suggestForm.naturalOrigin === ''
                ? null
                : String(suggestForm.naturalOrigin),
            chemicalNature:
              suggestForm.chemicalNature === ''
                ? null
                : String(suggestForm.chemicalNature),
          };
        };

        let nodePutBody: Record<string, unknown> | null = null;
        if (publish) {
          if (hasNodeChange || natureFieldsDirty) {
            nodePutBody = { ...buildFullPutBody(), is_draft: false };
          } else if (isDraftCard) {
            nodePutBody = { is_draft: false };
          }
        } else if (hasNodeChange) {
          nodePutBody = buildFullPutBody();
        } else if (natureFieldsDirty) {
          nodePutBody = {
            naturalOrigin: proposedNatural,
            chemicalNature: proposedChem,
          };
        }

        if (!nodePutBody && !hasLinkChange) {
          pushToast(tEditor('toastAdminSaveNoChanges'), 'success');
          await onAdminSaved?.();
          onClose();
          return;
        }

        if (nodePutBody) {
          const putRes = await fetch(
            `/api/nodes/${encodeURIComponent(node.id)}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(nodePutBody),
            }
          );
          if (!putRes.ok) {
            const raw = await putRes.text();
            let err: {
              error?: unknown;
              message?: unknown;
              code?: unknown;
            } = {};
            try {
              err = raw ? (JSON.parse(raw) as typeof err) : {};
            } catch {
              err = { error: raw.slice(0, 400) };
            }
            const apiMsg =
              (typeof err.error === 'string' && err.error.trim()) ||
              (typeof err.message === 'string' && err.message.trim()) ||
              '';
            pushToast(apiMsg || tEditor('toastError'), 'error');
            return;
          }
          const putJson = (await putRes.json()) as {
            node?: Record<string, unknown>;
          };
          if (putJson.node) {
            updateNode(node.id, {
              is_draft: rowIsDraft(putJson.node),
            });
          }
        }

        for (const linkId of removedLinkIds) {
          const delRes = await fetch(
            `/api/links/${encodeURIComponent(linkId)}`,
            { method: 'DELETE', credentials: 'same-origin' }
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
              credentials: 'same-origin',
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
            credentials: 'same-origin',
            body: JSON.stringify({
              source_id: p.section === 'ledTo' ? node.id : p.peerId,
              target_id: p.section === 'ledTo' ? p.peerId : node.id,
              relation_type: p.relation_type,
              is_optional: Boolean(p.is_optional),
              notes: '',
            }),
          });
          if (!postRes.ok) {
            const err = await postRes.json().catch(() => ({}));
            pushToast(
              String(
                (err as { error?: string }).error ?? tEditor('toastSaveError')
              ),
              'error'
            );
            return;
          }
        }

        pushToast(tEditor('toastNodeUpdated'), 'success');
        await onAdminSaved?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('craftree:editor-refresh'));
        }
        if (!(variant === 'admin' && adminStayOpenAfterSave)) {
          onClose();
        }
      } catch {
        pushToast(tEditor('toastNetworkError'), 'error');
      } finally {
        setSuggestSubmitting(false);
      }
    },
    [
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
      tEditor,
      onAdminSaved,
      onClose,
      isDraftCard,
      updateNode,
      adminStayOpenAfterSave,
    ]
  );

  const handleAdminCancel = useCallback(() => {
    if (baselineForm && originalLinkEdits) {
      setSuggestForm(structuredClone(baselineForm));
      setSuggestLinkEdits(
        JSON.parse(JSON.stringify(originalLinkEdits)) as Record<
          string,
          SuggestLinkSnapshot
        >
      );
      setPendingAddLinks([]);
      setStagedLinkRemovals({});
    }
    onClose();
  }, [baselineForm, originalLinkEdits, onClose]);

  const applyImageUrlClient = useCallback(
    (url: string) => {
      updateNode(node.id, { image_url: url });
      patchDetail(node.id, { image_url: url });
      setSeedNode((s) => (s ? { ...s, image_url: url } : null));
    },
    [node.id, updateNode, patchDetail]
  );

  const handleAdminImageFile = useCallback(
    async (file: File) => {
      setImageActionBusy('upload');
      try {
        if (seedNode && seedNodeIsLocked(seedNode)) {
          pushToast(tEditor('toastNodeLockedNoEdit'), 'error');
          setImageActionBusy(null);
          return;
        }
        const formData = new FormData();
        formData.append('file', file);
        formData.append('nodeId', node.id);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
        });
        const data = (await res.json()) as {
          success?: boolean;
          image_url?: string;
          error?: string;
        };
        if (!res.ok || !data.success || !data.image_url) {
          pushToast(data.error ?? tEditor('toastError'), 'error');
          return;
        }
        const putRes = await fetch(
          `/api/nodes/${encodeURIComponent(node.id)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ image_url: data.image_url }),
          }
        );
        if (!putRes.ok) {
          const err = await putRes.json().catch(() => ({}));
          pushToast(
            String((err as { error?: string }).error ?? tEditor('toastSaveError')),
            'error'
          );
          return;
        }
        applyImageUrlClient(data.image_url);
        pushToast(tEditor('toastImageApplied'), 'success');
        await onAdminSaved?.();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('craftree:editor-refresh'));
        }
      } catch {
        pushToast(tEditor('toastNetworkError'), 'error');
      } finally {
        setImageActionBusy(null);
      }
    },
    [node.id, applyImageUrlClient, pushToast, tEditor, onAdminSaved, seedNode]
  );

  const handleWikimediaImage = useCallback(async () => {
    setImageActionBusy('wikimedia');
    try {
      if (seedNode && seedNodeIsLocked(seedNode)) {
        pushToast(tEditor('toastNodeLockedNoEdit'), 'error');
        setImageActionBusy(null);
        return;
      }
      const res = await fetch(
        `/api/admin/nodes/${encodeURIComponent(node.id)}/wikimedia-image`,
        {
          method: 'POST',
          credentials: 'same-origin',
        }
      );
      const data = (await res.json()) as {
        image_url?: string;
        error?: string;
      };
      if (res.status === 404 && data.error === 'wikimedia_no_image') {
        pushToast(tEditor('toastWikimediaNoImage'), 'error');
        return;
      }
      if (!res.ok || !data.image_url) {
        pushToast(data.error ?? tEditor('toastError'), 'error');
        return;
      }
      applyImageUrlClient(data.image_url);
      pushToast(tEditor('toastImageApplied'), 'success');
      await onAdminSaved?.();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('craftree:editor-refresh'));
      }
    } catch {
      pushToast(tEditor('toastNetworkError'), 'error');
    } finally {
      setImageActionBusy(null);
    }
  }, [node.id, applyImageUrlClient, pushToast, tEditor, onAdminSaved, seedNode]);

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
          if (movedFromSuppressIds.has(link.id)) return null;
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
          is_optional: Boolean(p.is_optional),
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
    movedFromSuppressIds,
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
          if (movedFromSuppressIds.has(link.id)) return null;
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
          is_optional: Boolean(p.is_optional),
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
    movedFromSuppressIds,
  ]);

  const extendedUpstreamInfos = useMemo(
    () => buildExtendedUpstreamPeerInfos(node.id, graphEdges, graphNodes),
    [node.id, graphEdges, graphNodes]
  );

  const extendedDownstreamInfos = useMemo(
    () => buildExtendedDownstreamPeerInfos(node.id, graphEdges, graphNodes),
    [node.id, graphEdges, graphNodes]
  );

  /** Hops étendus : arête réelle P→B (amont) ou B→S (aval) pour édition type de relation / direct-étendu. */
  const extendedDownstreamHopsForEdit = useMemo(() => {
    const out: {
      key: string;
      peerId: string;
      edge: CraftingLink;
      subtitle: string;
      value: SuggestLinkSnapshot;
      variant: SuggestLinkCardVariant;
    }[] = [];
    for (const info of extendedDownstreamInfos) {
      for (const viaId of info.viaNodeIds) {
        const edge = findLinkByEndpoints(graphEdges, viaId, info.peerId);
        if (!edge) continue;
        const bridge = getNodeById(viaId);
        const names = bridge
          ? pickNodeDisplayName(
              locale,
              bridge.name,
              detailsById[viaId]?.name_en
            )
          : viaId;
        const subtitle = tExplore('linkNeighborhoodVia', { names });
        const linkId = edge.id;
        const vActive = suggestLinkEdits[linkId];
        const vStaged = stagedLinkRemovals[linkId];
        let value: SuggestLinkSnapshot;
        let variant: SuggestLinkCardVariant;
        if (vActive) {
          value = vActive;
          variant = 'default';
        } else if (vStaged) {
          value = vStaged;
          variant = 'stagedRemoval';
        } else {
          value = craftingLinkToSnapshot(edge);
          variant = 'default';
        }
        out.push({
          key: `xd:${info.peerId}:${viaId}`,
          peerId: info.peerId,
          edge,
          subtitle,
          value,
          variant,
        });
      }
    }
    return out;
  }, [
    extendedDownstreamInfos,
    graphEdges,
    getNodeById,
    locale,
    detailsById,
    tExplore,
    suggestLinkEdits,
    stagedLinkRemovals,
  ]);

  const extendedUpstreamHopsForEdit = useMemo(() => {
    const out: {
      key: string;
      peerId: string;
      edge: CraftingLink;
      subtitle: string;
      value: SuggestLinkSnapshot;
      variant: SuggestLinkCardVariant;
    }[] = [];
    for (const info of extendedUpstreamInfos) {
      for (const viaId of info.viaNodeIds) {
        const edge = findLinkByEndpoints(graphEdges, info.peerId, viaId);
        if (!edge) continue;
        const bridge = getNodeById(viaId);
        const names = bridge
          ? pickNodeDisplayName(
              locale,
              bridge.name,
              detailsById[viaId]?.name_en
            )
          : viaId;
        const subtitle = tExplore('linkNeighborhoodVia', { names });
        const linkId = edge.id;
        const vActive = suggestLinkEdits[linkId];
        const vStaged = stagedLinkRemovals[linkId];
        let value: SuggestLinkSnapshot;
        let variant: SuggestLinkCardVariant;
        if (vActive) {
          value = vActive;
          variant = 'default';
        } else if (vStaged) {
          value = vStaged;
          variant = 'stagedRemoval';
        } else {
          value = craftingLinkToSnapshot(edge);
          variant = 'default';
        }
        out.push({
          key: `xu:${info.peerId}:${viaId}`,
          peerId: info.peerId,
          edge,
          subtitle,
          value,
          variant,
        });
      }
    }
    return out;
  }, [
    extendedUpstreamInfos,
    graphEdges,
    getNodeById,
    locale,
    detailsById,
    tExplore,
    suggestLinkEdits,
    stagedLinkRemovals,
  ]);

  const openPeerInTree = useCallback(
    (id: string) => {
      router.push(treeInventionPath(id));
    },
    [router]
  );

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

  /** Sur /tree, `compareUpstreamCount` n’est pas fourni : on calcule le badge comme dans l’éditeur. */
  const adminUpstreamCount = useMemo(() => {
    if (variant !== 'admin') return undefined;
    if (compareUpstreamCount !== undefined) return compareUpstreamCount;
    return graphEdges.filter((e) => e.target_id === node.id).length;
  }, [variant, compareUpstreamCount, graphEdges, node.id]);

  const displayName = pickNodeDisplayName(
    locale,
    node.name,
    detailsById[node.id]?.name_en ?? node.name_en
  );

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col ${fillContainerHeight ? 'h-full min-w-0' : ''}`}
    >
      <motion.div
        variants={staggerItem}
        className={`z-10 flex shrink-0 flex-col gap-3 border-b border-border/70 glass-app-header px-5 py-4 ${fillContainerHeight ? '' : 'sticky top-0'}`}
      >
        <div className="flex items-center justify-between gap-2">
          <h2
            className="text-lg font-semibold text-foreground"
            {...(variant === 'admin'
              ? {}
              : { id: 'explore-detail-title' as const })}
          >
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
        </div>
        {variant === 'admin' ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
            <span
              id="explore-detail-title"
              className="min-w-0 text-base font-semibold leading-snug text-foreground"
            >
              {displayName}
            </span>
            <BuiltUponBadgePopover
              count={adminUpstreamCount ?? 0}
              borderColor={getCategoryColor(node.category as NodeCategory)}
            />
            {rowIsDraft(node as unknown as Record<string, unknown>) ? (
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full bg-orange-500"
                title={tEditor('draftRowIndicator')}
                aria-label={tEditor('draftRowIndicator')}
              />
            ) : null}
          </div>
        ) : null}
      </motion.div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className={`min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4 ${
            fillContainerHeight ? 'editor-scrollbar' : ''
          }`}
        >
        {adminPanelLocked ? (
          <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs leading-snug text-amber-100">
            {tEditor('adminPanelLockedNotice')}
          </div>
        ) : null}
        <div
          className={
            adminPanelLocked ? 'pointer-events-none opacity-[0.68]' : undefined
          }
        >
        <SuggestionNodeForm
          form={suggestForm}
          setForm={setSuggestForm}
          baselineForm={baselineForm}
          cardImageUrl={suggestCardImageUrl}
          cardImageToolbar={
            variant === 'admin' ? (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  aria-hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void handleAdminImageFile(f);
                  }}
                />
                <button
                  type="button"
                  disabled={
                    Boolean(imageActionBusy) ||
                    suggestSubmitting ||
                    !originalSnapshot ||
                    adminPanelLocked
                  }
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md border border-border/70 bg-surface/80 px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-border/40 disabled:opacity-50"
                >
                  {imageActionBusy === 'upload'
                    ? tEditor('adminImageBusy')
                    : tEditor('adminImageManualButton')}
                </button>
                <button
                  type="button"
                  disabled={
                    Boolean(imageActionBusy) ||
                    suggestSubmitting ||
                    !originalSnapshot ||
                    adminPanelLocked
                  }
                  onClick={() => void handleWikimediaImage()}
                  className="rounded-md border border-border/70 bg-surface/80 px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-border/40 disabled:opacity-50"
                >
                  {imageActionBusy === 'wikimedia'
                    ? tEditor('adminImageBusy')
                    : tEditor('adminImageWikimediaButton')}
                </button>
              </>
            ) : undefined
          }
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
        <div className="mt-6 space-y-4">
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
            showRelationPicker={showRelationPicker}
            onChangeInventionKind={onChangeLinkInventionKind}
            linkNeighborhoodInLinkRows
            onChangeLinkNeighborhood={onChangeLinkNeighborhood}
            listSection="ledTo"
            onMoveLinkToOtherSection={(id) =>
              moveLinkToOtherSection(id, 'ledTo')
            }
          />
          {showExtended && extendedDownstreamInfos.length > 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-surface/20 px-3 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tExplore('linkNeighborhoodExtended')}
              </p>
              <ul className="space-y-2">
                {showRelationPicker &&
                extendedDownstreamHopsForEdit.length > 0
                  ? extendedDownstreamHopsForEdit.map((hop) => {
                      const peer = getNodeById(hop.peerId);
                      if (!peer) return null;
                      return (
                        <SuggestLinkEditCard
                          key={hop.key}
                          linkId={hop.edge.id}
                          peerId={hop.peerId}
                          peerLabel={pickNodeDisplayName(
                            locale,
                            peer.name,
                            detailsById[hop.peerId]?.name_en
                          )}
                          peerCategory={peer.category as NodeCategory}
                          detailsById={detailsById}
                          value={hop.value}
                          variant={hop.variant}
                          onRemove={onSuggestLinkRemove}
                          onRestore={onRestoreLink}
                          showRelationPicker={showRelationPicker}
                          onChangeInventionKind={onChangeLinkInventionKind}
                          showInlineLinkNeighborhood
                          onChangeLinkNeighborhood={onChangeLinkNeighborhood}
                          subtitle={hop.subtitle}
                          listItemExtraClassName={
                            hop.variant === 'stagedRemoval'
                              ? undefined
                              : '!border-2 !border-dashed !border-white/70 !bg-surface/25'
                          }
                        />
                      );
                    })
                  : extendedDownstreamInfos.map((info) => (
                      <ExploreExtendedPeerRow
                        key={info.peerId}
                        info={info}
                        getNodeById={getNodeById}
                        locale={locale}
                        detailsById={detailsById}
                        imageBust={imageBustByNodeId[info.peerId] ?? 0}
                        onSelectPeer={openPeerInTree}
                      />
                    ))}
              </ul>
            </div>
          ) : null}
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
            showRelationPicker={showRelationPicker}
            onChangeInventionKind={onChangeLinkInventionKind}
            linkNeighborhoodInLinkRows
            onChangeLinkNeighborhood={onChangeLinkNeighborhood}
            hideSectionHeading
            listSection="builtUpon"
            onMoveLinkToOtherSection={(id) =>
              moveLinkToOtherSection(id, 'builtUpon')
            }
          />
          {showExtended && extendedUpstreamInfos.length > 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-surface/20 px-3 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {tExplore('linkNeighborhoodExtended')}
              </p>
              <ul className="space-y-2">
                {showRelationPicker &&
                extendedUpstreamHopsForEdit.length > 0
                  ? extendedUpstreamHopsForEdit.map((hop) => {
                      const peer = getNodeById(hop.peerId);
                      if (!peer) return null;
                      return (
                        <SuggestLinkEditCard
                          key={hop.key}
                          linkId={hop.edge.id}
                          peerId={hop.peerId}
                          peerLabel={pickNodeDisplayName(
                            locale,
                            peer.name,
                            detailsById[hop.peerId]?.name_en
                          )}
                          peerCategory={peer.category as NodeCategory}
                          detailsById={detailsById}
                          value={hop.value}
                          variant={hop.variant}
                          onRemove={onSuggestLinkRemove}
                          onRestore={onRestoreLink}
                          showRelationPicker={showRelationPicker}
                          onChangeInventionKind={onChangeLinkInventionKind}
                          showInlineLinkNeighborhood
                          onChangeLinkNeighborhood={onChangeLinkNeighborhood}
                          subtitle={hop.subtitle}
                          listItemExtraClassName={
                            hop.variant === 'stagedRemoval'
                              ? undefined
                              : '!border-2 !border-dashed !border-white/70 !bg-surface/25'
                          }
                        />
                      );
                    })
                  : extendedUpstreamInfos.map((info) => (
                      <ExploreExtendedPeerRow
                        key={info.peerId}
                        info={info}
                        getNodeById={getNodeById}
                        locale={locale}
                        detailsById={detailsById}
                        imageBust={imageBustByNodeId[info.peerId] ?? 0}
                        onSelectPeer={openPeerInTree}
                      />
                    ))}
              </ul>
            </div>
          ) : null}
        </div>
        </div>
        </div>
        <div className="shrink-0 glass-footer px-5 pb-4 pt-3">
          <div className="flex flex-col gap-2">
            {variant === 'admin' && isDraftCard ? (
              <button
                type="button"
                disabled={
                  suggestSubmitting || !originalSnapshot || adminPanelLocked
                }
                onClick={() => void persistAdminPanel('publish')}
                className="rounded-lg border border-emerald-500/45 bg-emerald-600/25 px-4 py-3 text-sm font-semibold text-emerald-100 shadow-md transition-colors hover:bg-emerald-600/40 disabled:opacity-50"
              >
                {tEditor('toggleDraftOnline')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={
                suggestSubmitting ||
                (variant === 'admin' && adminPanelLocked)
              }
              onClick={() =>
                void (variant === 'admin'
                  ? persistAdminPanel('save')
                  : submitSuggestion())
              }
              className="rounded-lg bg-amber-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-amber-500 disabled:opacity-50"
            >
              {variant === 'admin' ? tCommon('save') : tAuth('sendSuggestion')}
            </button>
            {variant === 'admin' &&
            fillContainerHeight &&
            onAdminDeleteCard ? (
              <button
                type="button"
                disabled={suggestSubmitting || adminPanelLocked}
                onClick={() => void onAdminDeleteCard()}
                className="rounded-lg border border-red-500/60 bg-red-950/35 px-4 py-2.5 text-sm font-semibold text-red-200 shadow-md transition-colors hover:border-red-400/80 hover:bg-red-950/55 disabled:opacity-50"
              >
                {tEditor('duplicateCompareDeleteCard')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={suggestSubmitting}
              onClick={
                variant === 'admin' ? handleAdminCancel : requestClose
              }
              className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-red-500 disabled:opacity-50"
            >
              {tCommon('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

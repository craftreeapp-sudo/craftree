'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import type { CraftingLink } from '@/lib/types';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { SuggestLinkSection } from '@/components/ui/SuggestLinkEditRows';
import { buildPeerSearchBlobMap } from '@/lib/suggest-peer-search';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import {
  ADMIN_DRAFT_PROPOSED_ADD,
  ADMIN_DRAFT_REMOVED_IDS,
  inferProposedAddSection,
  type LinkSnap,
  VALID_RELATIONS,
} from '@/lib/admin-suggestion-shared';
import type { SuggestLinkSnapshot } from '@/lib/suggestion-link-snapshot';
import { NodeCategory, RelationType, type TechNodeBasic } from '@/lib/types';
import type { LinkNeighborhoodMode } from '@/stores/ui-store';
import {
  type InventionKindKey,
  inventionKindToNodeFields,
  relationTypeFromInventionKind,
} from '@/lib/invention-classification';

type LinkCtx = {
  peerName: string;
  section: 'ledTo' | 'builtUpon';
  peerId?: string;
};

type Props = {
  currentNodeId: string;
  draft: Record<string, unknown>;
  draftAdds: Record<string, unknown>[];
  onEditDraftChange: (d: Record<string, unknown>) => void;
  /** Noms affichables quand le pair n’est pas encore dans le store graphe. */
  nodeNames: Record<string, string>;
  linkContext: Record<string, LinkCtx>;
  origLinkEdits: Record<string, LinkSnap>;
};

function adminAddLinkIndex(linkId: string): number | null {
  const m = /^admin-add-(\d+)$/.exec(linkId);
  if (!m) return null;
  return Number(m[1]);
}

function peerKindHintFromDraftAdd(
  raw: Record<string, unknown>
): Pick<TechNodeBasic, 'dimension' | 'materialLevel'> | undefined {
  if (!('dimension' in raw) && !('materialLevel' in raw)) return undefined;
  return {
    dimension: (raw.dimension as TechNodeBasic['dimension'] | null | undefined) ?? null,
    materialLevel:
      (raw.materialLevel as TechNodeBasic['materialLevel'] | null | undefined) ??
      null,
  };
}

export function AdminEditNodeAddLinkSearches({
  currentNodeId,
  draft,
  draftAdds,
  onEditDraftChange,
  nodeNames,
  linkContext,
  origLinkEdits,
}: Props) {
  const locale = useLocale();
  const tEditor = useTranslations('editor');
  const tExplore = useTranslations('explore');
  const graphNodes = useGraphStore((s) => s.nodes);
  const graphEdges = useGraphStore((s) => s.edges);
  const getNodeById = useGraphStore((s) => s.getNodeById);
  const updateNode = useGraphStore((s) => s.updateNode);
  const refreshData = useGraphStore((s) => s.refreshData);
  const detailsById = useNodeDetailsStore((s) => s.byId);

  /** Même logique que la modal « Ajouter une carte » : sans nœuds, la recherche est vide. */
  useEffect(() => {
    if (useGraphStore.getState().nodes.length === 0) {
      void refreshData();
    }
  }, [refreshData]);
  const peerSearchBlobMap = useMemo(
    () => buildPeerSearchBlobMap(graphNodes, detailsById),
    [graphNodes, detailsById]
  );

  const [ledToOpen, setLedToOpen] = useState(true);
  const [builtUponOpen, setBuiltUponOpen] = useState(true);

  const draftRemoved = useMemo(() => {
    const raw = draft[ADMIN_DRAFT_REMOVED_IDS];
    return Array.isArray(raw) ? raw.map((x) => String(x)) : [];
  }, [draft]);

  /** Ne pas afficher la ligne « suppression » si le lien a été déplacé vers l’autre section. */
  const movedFromSuppressIds = useMemo(() => {
    const s = new Set<string>();
    for (const a of draftAdds) {
      const m = (a as Record<string, unknown>).movedFromLinkId;
      if (typeof m === 'string' && m.trim()) s.add(m.trim());
    }
    return s;
  }, [draftAdds]);

  const removedEdgeSet = useMemo(
    () => new Set(draftRemoved),
    [draftRemoved]
  );

  const wouldDuplicateEdge = useCallback(
    (
      source_id: string,
      target_id: string,
      opts?: { ignoreDraftAddIndex?: number; ignoreGraphEdgeId?: string }
    ) => {
      if (!source_id || !target_id || source_id === target_id) return true;
      for (let i = 0; i < draftAdds.length; i++) {
        if (opts?.ignoreDraftAddIndex === i) continue;
        const a = draftAdds[i] as Record<string, unknown>;
        if (a.unresolved === true) continue;
        const s = String(a.source_id ?? '').trim();
        const t = String(a.target_id ?? '').trim();
        if (s === source_id && t === target_id) return true;
      }
      for (const e of graphEdges as CraftingLink[]) {
        if (opts?.ignoreGraphEdgeId && e.id === opts.ignoreGraphEdgeId) {
          continue;
        }
        if (removedEdgeSet.has(e.id)) continue;
        if (e.source_id === source_id && e.target_id === target_id) return true;
      }
      return false;
    },
    [draftAdds, graphEdges, removedEdgeSet]
  );

  const hasEdge = useCallback(
    (source_id: string, target_id: string) =>
      draftAdds.some(
        (a) =>
          String(a.source_id) === source_id &&
          String(a.target_id) === target_id
      ),
    [draftAdds]
  );

  const appendLink = useCallback(
    (section: 'ledTo' | 'builtUpon', peerId: string) => {
      if (!currentNodeId) return;
      const source_id = section === 'ledTo' ? currentNodeId : peerId;
      const target_id = section === 'ledTo' ? peerId : currentNodeId;
      if (hasEdge(source_id, target_id)) return;
      onEditDraftChange({
        ...draft,
        [ADMIN_DRAFT_PROPOSED_ADD]: [
          ...draftAdds,
          {
            source_id,
            target_id,
            relation_type: RelationType.MATERIAL,
            section,
          },
        ],
      });
    },
    [currentNodeId, draft, draftAdds, hasEdge, onEditDraftChange]
  );

  type Row = {
    linkId: string;
    peerId: string;
    peerLabel: string;
    peerCategory: NodeCategory;
    value: SuggestLinkSnapshot;
    variant: 'pendingAdd' | 'stagedRemoval' | 'unresolvedAdd' | 'existing';
    peerKindHint?: Pick<TechNodeBasic, 'dimension' | 'materialLevel'>;
  };

  const ledToRows = useMemo(() => {
    const draftLinkEdits =
      (draft.linkEdits as Record<string, LinkSnap> | undefined) ?? {};
    const out: Row[] = [];
    const removedSet = new Set(draftRemoved);
    const pendingLedToPeerIds = new Set<string>();
    for (const add of draftAdds) {
      const a = add as Record<string, unknown>;
      if (a.unresolved === true) continue;
      const secRaw = a.section;
      const section =
        secRaw === 'ledTo' || secRaw === 'builtUpon'
          ? secRaw
          : inferProposedAddSection(currentNodeId, add);
      if (section === 'ledTo') {
        const tid = String(a.target_id ?? '').trim();
        if (tid) pendingLedToPeerIds.add(tid);
      }
    }
    for (const edge of graphEdges as CraftingLink[]) {
      if (edge.source_id !== currentNodeId) continue;
      if (removedSet.has(edge.id)) continue;
      if (pendingLedToPeerIds.has(edge.target_id)) continue;
      const peer = getNodeById(edge.target_id);
      const peerLabel = peer
        ? pickNodeDisplayName(
            locale,
            peer.name,
            detailsById[peer.id]?.name_en ?? peer.name_en
          )
        : (nodeNames[edge.target_id]?.trim() || edge.target_id);
      const overlay = draftLinkEdits[edge.id];
      const relRaw = String(
        overlay?.relation_type ?? edge.relation_type ?? RelationType.MATERIAL
      );
      const rel = (VALID_RELATIONS.has(relRaw)
        ? relRaw
        : RelationType.MATERIAL) as RelationType;
      const value: SuggestLinkSnapshot = {
        id: edge.id,
        relation_type: rel,
        notes:
          overlay?.notes ??
          (typeof edge.notes === 'string' ? edge.notes : ''),
        is_optional: overlay?.is_optional ?? Boolean(edge.is_optional),
      };
      out.push({
        linkId: edge.id,
        peerId: edge.target_id,
        peerLabel,
        peerCategory: (peer?.category ?? NodeCategory.ENERGY) as NodeCategory,
        value,
        variant: 'existing',
      });
    }
    out.sort((a, b) =>
      a.peerLabel.localeCompare(b.peerLabel, 'fr', { sensitivity: 'base' })
    );
    for (const linkId of draftRemoved) {
      if (movedFromSuppressIds.has(linkId)) continue;
      const ctx = linkContext[linkId];
      if (!ctx || ctx.section !== 'ledTo') continue;
      let snap = origLinkEdits[linkId];
      if (!snap) {
        snap = {
          id: linkId,
          relation_type: RelationType.MATERIAL,
          notes: '',
          is_optional: false,
        };
      }
      const overlay = draftLinkEdits[linkId];
      const merged = overlay ? { ...snap, ...overlay } : snap;
      const peerId =
        typeof ctx.peerId === 'string' && ctx.peerId.trim()
          ? ctx.peerId.trim()
          : '';
      const peer = peerId ? getNodeById(peerId) : undefined;
      const peerLabel =
        (ctx.peerName && ctx.peerName.trim()) ||
        (peerId ? nodeNames[peerId] : '') ||
        peerId ||
        linkId;
      const rel = (VALID_RELATIONS.has(merged.relation_type)
        ? merged.relation_type
        : RelationType.MATERIAL) as RelationType;
      const value: SuggestLinkSnapshot = {
        id: linkId,
        relation_type: rel,
        notes: merged.notes ?? '',
        is_optional: Boolean(merged.is_optional),
      };
      out.push({
        linkId,
        peerId: peerId || linkId,
        peerLabel,
        peerCategory: (peer?.category ?? NodeCategory.ENERGY) as NodeCategory,
        value,
        variant: 'stagedRemoval',
      });
    }
    for (let i = 0; i < draftAdds.length; i++) {
      const add = draftAdds[i];
      if (add.unresolved === true) {
        if (add.section === 'builtUpon') continue;
        const peerLabel = String(add.suggested_name ?? '').trim() || '—';
        const noteStr =
          typeof add.notes === 'string' && add.notes.trim()
            ? add.notes.trim()
            : '';
        const relU = String(add.relation_type ?? RelationType.MATERIAL);
        const rel = (VALID_RELATIONS.has(relU)
          ? relU
          : RelationType.MATERIAL) as RelationType;
        const value: SuggestLinkSnapshot = {
          id: `admin-add-${i}`,
          relation_type: rel,
          notes: noteStr,
          is_optional: false,
        };
        out.push({
          linkId: `admin-add-${i}`,
          peerId: `__unresolved__${i}`,
          peerLabel,
          peerCategory: NodeCategory.ENERGY,
          value,
          variant: 'unresolvedAdd',
          peerKindHint: peerKindHintFromDraftAdd(add as Record<string, unknown>),
        });
        continue;
      }
      const secRaw = add.section;
      const section =
        secRaw === 'ledTo' || secRaw === 'builtUpon'
          ? secRaw
          : inferProposedAddSection(currentNodeId, add);
      if (section !== 'ledTo') continue;
      const peerId = String(add.target_id ?? '').trim();
      if (!peerId) continue;
      const peer = getNodeById(peerId);
      const peerLabel = peer
        ? pickNodeDisplayName(
            locale,
            peer.name,
            detailsById[peer.id]?.name_en ?? peer.name_en
          )
        : (nodeNames[peerId]?.trim() || peerId);
      const relRaw = String(add.relation_type ?? RelationType.MATERIAL);
      const rel = (VALID_RELATIONS.has(relRaw)
        ? relRaw
        : RelationType.MATERIAL) as RelationType;
      const value: SuggestLinkSnapshot = {
        id: `admin-add-${i}`,
        relation_type: rel,
        notes: typeof add.notes === 'string' ? add.notes : '',
        is_optional: Boolean((add as Record<string, unknown>).is_optional),
      };
      out.push({
        linkId: `admin-add-${i}`,
        peerId,
        peerLabel,
        peerCategory: (peer?.category ?? NodeCategory.ENERGY) as NodeCategory,
        value,
        variant: 'pendingAdd',
        peerKindHint: peerKindHintFromDraftAdd(add as Record<string, unknown>),
      });
    }
    return out;
  }, [
    currentNodeId,
    draft,
    draftRemoved,
    movedFromSuppressIds,
    linkContext,
    origLinkEdits,
    draftAdds,
    graphEdges,
    getNodeById,
    locale,
    detailsById,
    nodeNames,
  ]);

  const builtUponRows = useMemo(() => {
    const draftLinkEdits =
      (draft.linkEdits as Record<string, LinkSnap> | undefined) ?? {};
    const out: Row[] = [];
    const removedSet = new Set(draftRemoved);
    const pendingBuiltUponPeerIds = new Set<string>();
    for (const add of draftAdds) {
      const a = add as Record<string, unknown>;
      if (a.unresolved === true) continue;
      const secRaw = a.section;
      const section =
        secRaw === 'ledTo' || secRaw === 'builtUpon'
          ? secRaw
          : inferProposedAddSection(currentNodeId, add);
      if (section === 'builtUpon') {
        const sid = String(a.source_id ?? '').trim();
        if (sid) pendingBuiltUponPeerIds.add(sid);
      }
    }
    for (const edge of graphEdges as CraftingLink[]) {
      if (edge.target_id !== currentNodeId) continue;
      if (removedSet.has(edge.id)) continue;
      if (pendingBuiltUponPeerIds.has(edge.source_id)) continue;
      const peer = getNodeById(edge.source_id);
      const peerLabel = peer
        ? pickNodeDisplayName(
            locale,
            peer.name,
            detailsById[peer.id]?.name_en ?? peer.name_en
          )
        : (nodeNames[edge.source_id]?.trim() || edge.source_id);
      const overlay = draftLinkEdits[edge.id];
      const relRaw = String(
        overlay?.relation_type ?? edge.relation_type ?? RelationType.MATERIAL
      );
      const rel = (VALID_RELATIONS.has(relRaw)
        ? relRaw
        : RelationType.MATERIAL) as RelationType;
      const value: SuggestLinkSnapshot = {
        id: edge.id,
        relation_type: rel,
        notes:
          overlay?.notes ??
          (typeof edge.notes === 'string' ? edge.notes : ''),
        is_optional: overlay?.is_optional ?? Boolean(edge.is_optional),
      };
      out.push({
        linkId: edge.id,
        peerId: edge.source_id,
        peerLabel,
        peerCategory: (peer?.category ?? NodeCategory.ENERGY) as NodeCategory,
        value,
        variant: 'existing',
      });
    }
    out.sort((a, b) =>
      a.peerLabel.localeCompare(b.peerLabel, 'fr', { sensitivity: 'base' })
    );
    for (const linkId of draftRemoved) {
      if (movedFromSuppressIds.has(linkId)) continue;
      const ctx = linkContext[linkId];
      if (!ctx || ctx.section !== 'builtUpon') continue;
      let snap = origLinkEdits[linkId];
      if (!snap) {
        snap = {
          id: linkId,
          relation_type: RelationType.MATERIAL,
          notes: '',
          is_optional: false,
        };
      }
      const overlay = draftLinkEdits[linkId];
      const merged = overlay ? { ...snap, ...overlay } : snap;
      const peerId =
        typeof ctx.peerId === 'string' && ctx.peerId.trim()
          ? ctx.peerId.trim()
          : '';
      const peer = peerId ? getNodeById(peerId) : undefined;
      const peerLabel =
        (ctx.peerName && ctx.peerName.trim()) ||
        (peerId ? nodeNames[peerId] : '') ||
        peerId ||
        linkId;
      const rel = (VALID_RELATIONS.has(merged.relation_type)
        ? merged.relation_type
        : RelationType.MATERIAL) as RelationType;
      const value: SuggestLinkSnapshot = {
        id: linkId,
        relation_type: rel,
        notes: merged.notes ?? '',
        is_optional: Boolean(merged.is_optional),
      };
      out.push({
        linkId,
        peerId: peerId || linkId,
        peerLabel,
        peerCategory: (peer?.category ?? NodeCategory.ENERGY) as NodeCategory,
        value,
        variant: 'stagedRemoval',
      });
    }
    for (let i = 0; i < draftAdds.length; i++) {
      const add = draftAdds[i];
      if (add.unresolved === true) {
        if (add.section !== 'builtUpon') continue;
        const peerLabel = String(add.suggested_name ?? '').trim() || '—';
        const noteStr =
          typeof add.notes === 'string' && add.notes.trim()
            ? add.notes.trim()
            : '';
        const relU = String(add.relation_type ?? RelationType.MATERIAL);
        const rel = (VALID_RELATIONS.has(relU)
          ? relU
          : RelationType.MATERIAL) as RelationType;
        const value: SuggestLinkSnapshot = {
          id: `admin-add-${i}`,
          relation_type: rel,
          notes: noteStr,
          is_optional: false,
        };
        out.push({
          linkId: `admin-add-${i}`,
          peerId: `__unresolved__${i}`,
          peerLabel,
          peerCategory: NodeCategory.ENERGY,
          value,
          variant: 'unresolvedAdd',
          peerKindHint: peerKindHintFromDraftAdd(add as Record<string, unknown>),
        });
        continue;
      }
      const secRaw = add.section;
      const section =
        secRaw === 'ledTo' || secRaw === 'builtUpon'
          ? secRaw
          : inferProposedAddSection(currentNodeId, add);
      if (section !== 'builtUpon') continue;
      const peerId = String(add.source_id ?? '').trim();
      if (!peerId) continue;
      const peer = getNodeById(peerId);
      const peerLabel = peer
        ? pickNodeDisplayName(
            locale,
            peer.name,
            detailsById[peer.id]?.name_en ?? peer.name_en
          )
        : (nodeNames[peerId]?.trim() || peerId);
      const relRaw = String(add.relation_type ?? RelationType.MATERIAL);
      const rel = (VALID_RELATIONS.has(relRaw)
        ? relRaw
        : RelationType.MATERIAL) as RelationType;
      const value: SuggestLinkSnapshot = {
        id: `admin-add-${i}`,
        relation_type: rel,
        notes: typeof add.notes === 'string' ? add.notes : '',
        is_optional: Boolean((add as Record<string, unknown>).is_optional),
      };
      out.push({
        linkId: `admin-add-${i}`,
        peerId,
        peerLabel,
        peerCategory: (peer?.category ?? NodeCategory.ENERGY) as NodeCategory,
        value,
        variant: 'pendingAdd',
        peerKindHint: peerKindHintFromDraftAdd(add as Record<string, unknown>),
      });
    }
    return out;
  }, [
    currentNodeId,
    draft,
    draftRemoved,
    movedFromSuppressIds,
    linkContext,
    origLinkEdits,
    draftAdds,
    graphEdges,
    getNodeById,
    locale,
    detailsById,
    nodeNames,
  ]);

  const moveLinkToOtherSection = useCallback(
    (linkId: string, from: 'ledTo' | 'builtUpon') => {
      if (!currentNodeId?.trim()) return;
      const to: 'ledTo' | 'builtUpon' = from === 'ledTo' ? 'builtUpon' : 'ledTo';

      const idx = adminAddLinkIndex(linkId);
      if (idx !== null && idx >= 0 && idx < draftAdds.length) {
        const raw = draftAdds[idx] as Record<string, unknown>;
        if (raw.unresolved === true) {
          const sec =
            raw.section === 'ledTo' || raw.section === 'builtUpon'
              ? raw.section
              : inferProposedAddSection(currentNodeId, raw);
          if (sec !== from) return;
          const next = draftAdds.map((a, j) =>
            j === idx ? { ...a, section: to } : a
          );
          onEditDraftChange({
            ...draft,
            [ADMIN_DRAFT_PROPOSED_ADD]: next,
          });
          return;
        }
        const sec =
          raw.section === 'ledTo' || raw.section === 'builtUpon'
            ? raw.section
            : inferProposedAddSection(currentNodeId, raw);
        if (sec !== from) return;
        const peerId =
          from === 'ledTo'
            ? String(raw.target_id ?? '').trim()
            : String(raw.source_id ?? '').trim();
        if (!peerId) return;
        const relU = String(raw.relation_type ?? RelationType.MATERIAL);
        const relType = (VALID_RELATIONS.has(relU)
          ? relU
          : RelationType.MATERIAL) as RelationType;
        const is_opt = Boolean(raw.is_optional);
        const notes = typeof raw.notes === 'string' ? raw.notes : '';
        const hint = peerKindHintFromDraftAdd(raw);
        const nextAdd =
          to === 'ledTo'
            ? {
                source_id: currentNodeId,
                target_id: peerId,
                relation_type: relType,
                section: 'ledTo' as const,
                is_optional: is_opt,
                ...(notes.trim() ? { notes } : {}),
                ...(hint
                  ? {
                      dimension: hint.dimension,
                      materialLevel: hint.materialLevel,
                    }
                  : {}),
              }
            : {
                source_id: peerId,
                target_id: currentNodeId,
                relation_type: relType,
                section: 'builtUpon' as const,
                is_optional: is_opt,
                ...(notes.trim() ? { notes } : {}),
                ...(hint
                  ? {
                      dimension: hint.dimension,
                      materialLevel: hint.materialLevel,
                    }
                  : {}),
              };
        const src = String(nextAdd.source_id);
        const tgt = String(nextAdd.target_id);
        if (
          wouldDuplicateEdge(src, tgt, { ignoreDraftAddIndex: idx })
        ) {
          return;
        }
        const next = draftAdds.map((a, j) => (j === idx ? nextAdd : a));
        onEditDraftChange({
          ...draft,
          [ADMIN_DRAFT_PROPOSED_ADD]: next,
        });
        return;
      }

      const edge = graphEdges.find((e) => e.id === linkId);
      if (!edge) return;
      const isLedTo = edge.source_id === currentNodeId;
      const currentSec: 'ledTo' | 'builtUpon' = isLedTo
        ? 'ledTo'
        : 'builtUpon';
      if (currentSec !== from) return;

      const peerId = isLedTo ? edge.target_id : edge.source_id;
      const curLe =
        (draft.linkEdits as Record<string, LinkSnap> | undefined) ?? {};
      const overlay = curLe[linkId];
      const relRaw = String(
        overlay?.relation_type ?? edge.relation_type ?? RelationType.MATERIAL
      );
      const relType = (VALID_RELATIONS.has(relRaw)
        ? relRaw
        : RelationType.MATERIAL) as RelationType;
      const is_opt = overlay?.is_optional ?? Boolean(edge.is_optional);
      const notesRaw =
        overlay?.notes ??
        (typeof edge.notes === 'string' ? edge.notes : '');
      const notes =
        typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : '';

      const newAdd =
        to === 'ledTo'
          ? {
              source_id: currentNodeId,
              target_id: peerId,
              relation_type: relType,
              section: 'ledTo' as const,
              is_optional: is_opt,
              ...(notes ? { notes } : {}),
              movedFromLinkId: linkId,
            }
          : {
              source_id: peerId,
              target_id: currentNodeId,
              relation_type: relType,
              section: 'builtUpon' as const,
              is_optional: is_opt,
              ...(notes ? { notes } : {}),
              movedFromLinkId: linkId,
            };

      const src = String(newAdd.source_id);
      const tgt = String(newAdd.target_id);
      if (wouldDuplicateEdge(src, tgt, { ignoreGraphEdgeId: linkId })) {
        return;
      }

      const nextLe = { ...curLe };
      delete nextLe[linkId];
      const nextRemoved = draftRemoved.includes(linkId)
        ? draftRemoved
        : [...draftRemoved, linkId];
      onEditDraftChange({
        ...draft,
        linkEdits: nextLe,
        [ADMIN_DRAFT_REMOVED_IDS]: nextRemoved,
        [ADMIN_DRAFT_PROPOSED_ADD]: [...draftAdds, newAdd],
      });
    },
    [
      currentNodeId,
      draft,
      draftAdds,
      draftRemoved,
      graphEdges,
      onEditDraftChange,
      wouldDuplicateEdge,
    ]
  );

  const onRemove = useCallback(
    (linkId: string) => {
      const idx = adminAddLinkIndex(linkId);
      if (idx !== null && idx >= 0 && idx < draftAdds.length) {
        const add = draftAdds[idx] as Record<string, unknown>;
        const movedFrom =
          typeof add.movedFromLinkId === 'string'
            ? add.movedFromLinkId.trim()
            : '';
        const next = draftAdds.filter((_, j) => j !== idx);
        const nextRemoved = movedFrom
          ? draftRemoved.filter((id) => id !== movedFrom)
          : draftRemoved;
        onEditDraftChange({
          ...draft,
          [ADMIN_DRAFT_PROPOSED_ADD]: next,
          [ADMIN_DRAFT_REMOVED_IDS]: nextRemoved,
        });
        return;
      }
      const edge = graphEdges.find((e) => e.id === linkId);
      if (!edge || draftRemoved.includes(linkId)) return;
      const curLe =
        (draft.linkEdits as Record<string, LinkSnap> | undefined) ?? {};
      const nextLe = { ...curLe };
      delete nextLe[linkId];
      onEditDraftChange({
        ...draft,
        [ADMIN_DRAFT_REMOVED_IDS]: [...draftRemoved, linkId],
        linkEdits: nextLe,
      });
    },
    [draft, draftAdds, draftRemoved, graphEdges, onEditDraftChange]
  );

  const onRestoreRemovedLink = useCallback(
    (linkId: string) => {
      onEditDraftChange({
        ...draft,
        [ADMIN_DRAFT_REMOVED_IDS]: draftRemoved.filter((id) => id !== linkId),
      });
    },
    [draft, draftRemoved, onEditDraftChange]
  );

  const onChangeInventionKind = useCallback(
    (linkId: string, peerId: string, kind: InventionKindKey) => {
      const relationType = relationTypeFromInventionKind(kind);
      const { dimension, materialLevel } = inventionKindToNodeFields(kind);
      if (!peerId.startsWith('__unresolved__')) {
        updateNode(peerId, {
          dimension,
          materialLevel,
        });
      }
      const idx = adminAddLinkIndex(linkId);
      if (idx !== null && idx >= 0 && idx < draftAdds.length) {
        const next = draftAdds.map((a, j) =>
          j === idx
            ? {
                ...(a as Record<string, unknown>),
                relation_type: relationType,
                dimension,
                materialLevel,
              }
            : a
        );
        onEditDraftChange({
          ...draft,
          [ADMIN_DRAFT_PROPOSED_ADD]: next,
        });
        return;
      }
      const edge = graphEdges.find((e) => e.id === linkId);
      const curLe =
        (draft.linkEdits as Record<string, LinkSnap> | undefined) ?? {};
      const prev: LinkSnap =
        curLe[linkId] ??
        (edge
          ? {
              id: linkId,
              relation_type: String(
                edge.relation_type ?? RelationType.MATERIAL
              ),
              notes: typeof edge.notes === 'string' ? edge.notes : '',
              is_optional: Boolean(edge.is_optional),
            }
          : (origLinkEdits[linkId] ?? {
              id: linkId,
              relation_type: RelationType.MATERIAL,
              notes: '',
              is_optional: false,
            }));
      onEditDraftChange({
        ...draft,
        linkEdits: {
          ...curLe,
          [linkId]: {
            ...prev,
            relation_type: relationType,
          },
        },
      });
    },
    [draft, draftAdds, graphEdges, origLinkEdits, onEditDraftChange, updateNode]
  );

  const onChangeLinkNeighborhood = useCallback(
    (linkId: string, mode: LinkNeighborhoodMode) => {
      const is_optional = mode === 'direct_and_extended';
      const idx = adminAddLinkIndex(linkId);
      if (idx !== null && idx >= 0 && idx < draftAdds.length) {
        const next = draftAdds.map((a, j) =>
          j === idx
            ? { ...(a as Record<string, unknown>), is_optional }
            : a
        );
        onEditDraftChange({
          ...draft,
          [ADMIN_DRAFT_PROPOSED_ADD]: next,
        });
        return;
      }
      const edge = graphEdges.find((e) => e.id === linkId);
      const curLe =
        (draft.linkEdits as Record<string, LinkSnap> | undefined) ?? {};
      const prev: LinkSnap =
        curLe[linkId] ??
        (edge
          ? {
              id: linkId,
              relation_type: String(
                edge.relation_type ?? RelationType.MATERIAL
              ),
              notes: typeof edge.notes === 'string' ? edge.notes : '',
              is_optional: Boolean(edge.is_optional),
            }
          : (origLinkEdits[linkId] ?? {
              id: linkId,
              relation_type: RelationType.MATERIAL,
              notes: '',
              is_optional: false,
            }));
      onEditDraftChange({
        ...draft,
        linkEdits: {
          ...curLe,
          [linkId]: {
            ...prev,
            is_optional,
          },
        },
      });
    },
    [draft, draftAdds, graphEdges, origLinkEdits, onEditDraftChange]
  );

  return (
    <>
      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        {tEditor('addCardHintLinks')}
      </p>
      <SuggestLinkSection
        className="!mt-3"
        sectionTitle={tExplore('ledTo')}
        count={ledToRows.length}
        open={ledToOpen}
        onToggleOpen={() => setLedToOpen((v) => !v)}
        emptyLabel={tExplore('noDownstream')}
        currentNodeId={currentNodeId}
        locale={locale}
        graphNodes={graphNodes}
        peerSearchBlobMap={peerSearchBlobMap}
        detailsById={detailsById}
        existingRows={ledToRows}
        onRemove={onRemove}
        onRestoreLink={onRestoreRemovedLink}
        onAddPeer={(peerId) => appendLink('ledTo', peerId)}
        showRelationPicker
        onChangeInventionKind={onChangeInventionKind}
        linkNeighborhoodInLinkRows
        onChangeLinkNeighborhood={onChangeLinkNeighborhood}
        listSection="ledTo"
        onMoveLinkToOtherSection={(id) =>
          moveLinkToOtherSection(id, 'ledTo')
        }
      />
      <SuggestLinkSection
        className="!mt-4"
        sectionTitle={tExplore('builtUpon')}
        count={builtUponRows.length}
        open={builtUponOpen}
        onToggleOpen={() => setBuiltUponOpen((v) => !v)}
        emptyLabel={tExplore('noUpstream')}
        currentNodeId={currentNodeId}
        locale={locale}
        graphNodes={graphNodes}
        peerSearchBlobMap={peerSearchBlobMap}
        detailsById={detailsById}
        existingRows={builtUponRows}
        onRemove={onRemove}
        onRestoreLink={onRestoreRemovedLink}
        onAddPeer={(peerId) => appendLink('builtUpon', peerId)}
        showRelationPicker
        onChangeInventionKind={onChangeInventionKind}
        linkNeighborhoodInLinkRows
        onChangeLinkNeighborhood={onChangeLinkNeighborhood}
        listSection="builtUpon"
        onMoveLinkToOtherSection={(id) =>
          moveLinkToOtherSection(id, 'builtUpon')
        }
      />
    </>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { SuggestLinkSection } from '@/components/ui/SuggestLinkEditRows';
import { buildPeerSearchBlobMap } from '@/lib/suggest-peer-search';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { slugify } from '@/lib/utils';
import { VALID_RELATIONS } from '@/lib/admin-suggestion-shared';
import type { SuggestLinkSnapshot } from '@/lib/suggestion-link-snapshot';
import { NodeCategory, RelationType } from '@/lib/types';
import type { LinkNeighborhoodMode } from '@/stores/ui-store';
import {
  type InventionKindKey,
  inventionKindToNodeFields,
  relationTypeFromInventionKind,
} from '@/lib/invention-classification';

type LinkEdge = {
  source_id: string;
  target_id: string;
  relation_type: string;
  is_optional?: boolean;
};

type Props = {
  /** Slug de la future carte (source/target dans `links`). */
  placeholderNodeId: string;
  draft: Record<string, unknown>;
  onEditDraftChange: (d: Record<string, unknown>) => void;
  nodeNames: Record<string, string>;
};

function linkIndexFromId(linkId: string): number | null {
  const m = /^newnode-link-(\d+)$/.exec(linkId);
  if (!m) return null;
  return Number(m[1]);
}

export function AdminNewNodeLinkSearches({
  placeholderNodeId,
  draft,
  onEditDraftChange,
  nodeNames,
}: Props) {
  const locale = useLocale();
  const tEditor = useTranslations('editor');
  const tExplore = useTranslations('explore');
  const graphNodes = useGraphStore((s) => s.nodes);
  const getNodeById = useGraphStore((s) => s.getNodeById);
  const updateNode = useGraphStore((s) => s.updateNode);
  const refreshData = useGraphStore((s) => s.refreshData);
  const detailsById = useNodeDetailsStore((s) => s.byId);

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

  const draftLinks = useMemo(() => {
    const raw = draft.links;
    if (!Array.isArray(raw)) return [] as LinkEdge[];
    const out: LinkEdge[] = [];
    for (const x of raw) {
      if (!x || typeof x !== 'object') continue;
      const o = x as Record<string, unknown>;
      const s = String(o.source_id ?? '').trim();
      const t = String(o.target_id ?? '').trim();
      const r = String(o.relation_type ?? RelationType.MATERIAL);
      if (!s || !t) continue;
      if (!VALID_RELATIONS.has(r)) continue;
      out.push({
        source_id: s,
        target_id: t,
        relation_type: r,
        is_optional: Boolean(o.is_optional),
      });
    }
    return out;
  }, [draft.links]);

  const n = draft.node as Record<string, unknown> | undefined;
  const phForEdges = useMemo(() => {
    const fromProp = placeholderNodeId.trim();
    const pid =
      typeof n?.proposed_id === 'string' ? n.proposed_id.trim() : '';
    const name = typeof n?.name === 'string' ? n.name.trim() : '';
    return fromProp || pid || (name ? slugify(name) : '') || 'node';
  }, [placeholderNodeId, n?.proposed_id, n?.name]);

  /** Slugs possibles pour la carte (formulaire + données d’origine + extrémités non résolues dans le graphe). */
  const phSet = useMemo(() => {
    const s = new Set<string>();
    if (phForEdges) s.add(phForEdges);
    if (placeholderNodeId.trim()) s.add(placeholderNodeId.trim());
    const pid =
      typeof n?.proposed_id === 'string' ? n.proposed_id.trim() : '';
    if (pid) s.add(pid);
    for (const L of draftLinks) {
      const srcKnown = Boolean(nodeNames[L.source_id]);
      const tgtKnown = Boolean(nodeNames[L.target_id]);
      if (!srcKnown && tgtKnown) s.add(L.source_id);
      if (srcKnown && !tgtKnown) s.add(L.target_id);
    }
    return s;
  }, [phForEdges, placeholderNodeId, n?.proposed_id, draftLinks, nodeNames]);

  const hasEdge = useCallback(
    (source_id: string, target_id: string) =>
      draftLinks.some(
        (a) => a.source_id === source_id && a.target_id === target_id
      ),
    [draftLinks]
  );

  const appendLink = useCallback(
    (section: 'ledTo' | 'builtUpon', peerId: string) => {
      const ph = phForEdges;
      if (!ph || !peerId) return;
      const source_id = section === 'ledTo' ? ph : peerId;
      const target_id = section === 'ledTo' ? peerId : ph;
      if (hasEdge(source_id, target_id)) return;
      onEditDraftChange({
        ...draft,
        link: {},
        links: [
          ...draftLinks,
          {
            source_id,
            target_id,
            relation_type: RelationType.MATERIAL,
            is_optional: false,
          },
        ],
      });
    },
    [draft, draftLinks, hasEdge, onEditDraftChange, phForEdges]
  );

  type Row = {
    linkId: string;
    peerId: string;
    peerLabel: string;
    peerCategory: NodeCategory;
    value: SuggestLinkSnapshot;
    variant: 'pendingAdd';
  };

  const ledToRows = useMemo(() => {
    const out: Row[] = [];
    for (let i = 0; i < draftLinks.length; i++) {
      const add = draftLinks[i];
      if (!phSet.has(add.source_id)) continue;
      if (add.target_id === add.source_id) continue;
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
        id: `newnode-link-${i}`,
        relation_type: rel,
        notes: '',
        is_optional: Boolean(add.is_optional),
      };
      out.push({
        linkId: `newnode-link-${i}`,
        peerId,
        peerLabel,
        peerCategory: (peer?.category ?? NodeCategory.ENERGY) as NodeCategory,
        value,
        variant: 'pendingAdd',
      });
    }
    return out;
  }, [draftLinks, phSet, getNodeById, locale, detailsById, nodeNames]);

  const builtUponRows = useMemo(() => {
    const out: Row[] = [];
    for (let i = 0; i < draftLinks.length; i++) {
      const add = draftLinks[i];
      if (!phSet.has(add.target_id)) continue;
      if (add.target_id === add.source_id) continue;
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
        id: `newnode-link-${i}`,
        relation_type: rel,
        notes: '',
        is_optional: Boolean(add.is_optional),
      };
      out.push({
        linkId: `newnode-link-${i}`,
        peerId,
        peerLabel,
        peerCategory: (peer?.category ?? NodeCategory.ENERGY) as NodeCategory,
        value,
        variant: 'pendingAdd',
      });
    }
    return out;
  }, [draftLinks, phSet, getNodeById, locale, detailsById, nodeNames]);

  const onRemove = useCallback(
    (linkId: string) => {
      const idx = linkIndexFromId(linkId);
      if (idx === null || idx < 0 || idx >= draftLinks.length) return;
      const next = draftLinks.filter((_, j) => j !== idx);
      onEditDraftChange({
        ...draft,
        link: {},
        links: next,
      });
    },
    [draft, draftLinks, onEditDraftChange]
  );

  const onChangeInventionKind = useCallback(
    (linkId: string, peerId: string, kind: InventionKindKey) => {
      const relationType = relationTypeFromInventionKind(kind);
      const { dimension, materialLevel } = inventionKindToNodeFields(kind);
      if (getNodeById(peerId)) {
        updateNode(peerId, { dimension, materialLevel });
      }
      const idx = linkIndexFromId(linkId);
      if (idx === null || idx < 0 || idx >= draftLinks.length) return;
      const next = draftLinks.map((edge, j) =>
        j === idx ? { ...edge, relation_type: relationType } : edge
      );
      onEditDraftChange({
        ...draft,
        link: {},
        links: next,
      });
    },
    [draft, draftLinks, getNodeById, onEditDraftChange, updateNode]
  );

  const onChangeLinkNeighborhood = useCallback(
    (linkId: string, mode: LinkNeighborhoodMode) => {
      const idx = linkIndexFromId(linkId);
      if (idx === null || idx < 0 || idx >= draftLinks.length) return;
      const is_optional = mode === 'direct_and_extended';
      const next = draftLinks.map((edge, j) =>
        j === idx ? { ...edge, is_optional } : edge
      );
      onEditDraftChange({
        ...draft,
        link: {},
        links: next,
      });
    },
    [draft, draftLinks, onEditDraftChange]
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
        currentNodeId={phForEdges}
        locale={locale}
        graphNodes={graphNodes}
        peerSearchBlobMap={peerSearchBlobMap}
        detailsById={detailsById}
        existingRows={ledToRows}
        onRemove={onRemove}
        onAddPeer={(peerId) => appendLink('ledTo', peerId)}
        showRelationPicker
        onChangeInventionKind={onChangeInventionKind}
        linkNeighborhoodInLinkRows
        onChangeLinkNeighborhood={onChangeLinkNeighborhood}
      />
      <SuggestLinkSection
        className="!mt-4"
        sectionTitle={tExplore('builtUpon')}
        count={builtUponRows.length}
        open={builtUponOpen}
        onToggleOpen={() => setBuiltUponOpen((v) => !v)}
        emptyLabel={tExplore('noUpstream')}
        currentNodeId={phForEdges}
        locale={locale}
        graphNodes={graphNodes}
        peerSearchBlobMap={peerSearchBlobMap}
        detailsById={detailsById}
        existingRows={builtUponRows}
        onRemove={onRemove}
        onAddPeer={(peerId) => appendLink('builtUpon', peerId)}
        showRelationPicker
        onChangeInventionKind={onChangeInventionKind}
        linkNeighborhoodInLinkRows
        onChangeLinkNeighborhood={onChangeLinkNeighborhood}
      />
    </>
  );
}

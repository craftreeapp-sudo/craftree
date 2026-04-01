'use client';

import { useEffect, useMemo } from 'react';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import {
  getExploreNodeId,
  type SuggestionRow,
} from '@/lib/admin-suggestion-shared';

/**
 * URL d’aperçu de la carte liée à une suggestion (explore / graphe),
 * aligné sur `SuggestNodeCorrectionPanel` (`suggestCardImageUrl`).
 */
export function useAdminSuggestionCardImageUrl(row: SuggestionRow | null) {
  const refreshData = useGraphStore((s) => s.refreshData);
  const nodesLength = useGraphStore((s) => s.nodes.length);
  const getNodeById = useGraphStore((s) => s.getNodeById);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const detailsById = useNodeDetailsStore((s) => s.byId);

  const previewId = useMemo(
    () => (row ? getExploreNodeId(row) : null),
    [row]
  );

  useEffect(() => {
    if (previewId && nodesLength === 0) {
      void refreshData();
    }
  }, [previewId, nodesLength, refreshData]);

  return useMemo(() => {
    if (!previewId) return null;
    const node = getNodeById(previewId);
    const detail = detailsById[previewId];
    const raw = (detail?.image_url ?? node?.image_url)?.trim();
    if (!raw) return null;
    const bust = imageBustByNodeId[previewId] ?? 0;
    return bust > 0
      ? `${raw}${raw.includes('?') ? '&' : '?'}t=${bust}`
      : raw;
  }, [previewId, getNodeById, detailsById, imageBustByNodeId]);
}

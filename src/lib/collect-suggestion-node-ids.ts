/** IDs de nœuds référencés par une ligne `suggestions` (noms pour l’admin). */
export function collectNodeIdsFromSuggestionRow(row: {
  suggestion_type: string;
  node_id: unknown;
  data: unknown;
}): string[] {
  const ids: string[] = [];
  if (row.node_id && typeof row.node_id === 'string') ids.push(row.node_id);
  const d = row.data as Record<string, unknown> | null;
  if (!d) return ids;
  if (row.suggestion_type === 'add_link') {
    if (typeof d.source_id === 'string') ids.push(d.source_id);
    if (typeof d.target_id === 'string') ids.push(d.target_id);
  }
  if (row.suggestion_type === 'new_node') {
    const link = d.link as
      | { source_id?: string; target_id?: string }
      | undefined;
    if (link?.source_id) ids.push(link.source_id);
    if (link?.target_id) ids.push(link.target_id);
    const links = d.links as { source_id?: string; target_id?: string }[] | undefined;
    if (Array.isArray(links)) {
      for (const L of links) {
        if (L?.source_id) ids.push(L.source_id);
        if (L?.target_id) ids.push(L.target_id);
      }
    }
  }
  if (row.suggestion_type === 'delete_link') {
    if (typeof d.source_id === 'string') ids.push(d.source_id);
    if (typeof d.target_id === 'string') ids.push(d.target_id);
  }
  if (row.suggestion_type === 'anonymous_feedback') {
    const nid =
      typeof d.node_id === 'string'
        ? d.node_id
        : typeof row.node_id === 'string'
          ? row.node_id
          : '';
    if (nid) ids.push(nid);
  }
  return ids;
}

export function collectNodeIdsFromSuggestions(
  rows: { suggestion_type: string; node_id: unknown; data: unknown }[]
): string[] {
  const ids: string[] = [];
  for (const r of rows) {
    ids.push(...collectNodeIdsFromSuggestionRow(r));
  }
  return ids;
}

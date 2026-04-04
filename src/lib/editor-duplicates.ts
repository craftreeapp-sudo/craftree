/** Clé comparable pour détecter les doublons de libellés (nom ou nom EN). */
export function normalizeForDuplicateKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export type DuplicateCheckNode = {
  id: string;
  name: string;
  name_en?: string | null;
};

/** IDs des fiches dont le nom (ou le nom EN) est en double par rapport à une autre fiche. */
export function duplicateNodeIdsFromNodes(
  nodes: readonly DuplicateCheckNode[]
): Set<string> {
  const byName = new Map<string, string[]>();
  const byNameEn = new Map<string, string[]>();
  for (const n of nodes) {
    const nk = normalizeForDuplicateKey(n.name);
    if (nk.length > 0) {
      if (!byName.has(nk)) byName.set(nk, []);
      byName.get(nk)!.push(n.id);
    }
    const en = n.name_en?.trim();
    if (en) {
      const ek = normalizeForDuplicateKey(en);
      if (ek.length > 0) {
        if (!byNameEn.has(ek)) byNameEn.set(ek, []);
        byNameEn.get(ek)!.push(n.id);
      }
    }
  }
  const dup = new Set<string>();
  for (const ids of byName.values()) {
    if (ids.length > 1) ids.forEach((id) => dup.add(id));
  }
  for (const ids of byNameEn.values()) {
    if (ids.length > 1) ids.forEach((id) => dup.add(id));
  }
  return dup;
}

/**
 * Une autre fiche en doublon (même nom ou même nom EN) que `nodeId`, pour navigation / scroll.
 */
export function findDuplicatePeerNodeId(
  nodes: readonly DuplicateCheckNode[],
  nodeId: string
): string | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const nk = normalizeForDuplicateKey(node.name);
  if (nk.length > 0) {
    const same = nodes
      .filter((n) => normalizeForDuplicateKey(n.name) === nk)
      .map((n) => n.id);
    if (same.length > 1) {
      const other = same.find((id) => id !== nodeId);
      if (other) return other;
    }
  }
  const en = node.name_en?.trim();
  if (en) {
    const ek = normalizeForDuplicateKey(en);
    const sameEn = nodes
      .filter((n) => {
        const ne = n.name_en?.trim();
        return ne && normalizeForDuplicateKey(ne) === ek;
      })
      .map((n) => n.id);
    if (sameEn.length > 1) {
      const other = sameEn.find((id) => id !== nodeId);
      if (other) return other;
    }
  }
  return null;
}

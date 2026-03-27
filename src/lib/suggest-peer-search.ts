import type { TechNodeBasic, TechNodeDetails } from '@/lib/types';

/**
 * Texte indexé pour la recherche de cartes (toutes les inventions du graphe + détails chargés).
 */
export function buildPeerSearchBlobMap(
  nodes: TechNodeBasic[],
  detailsById: Record<string, TechNodeDetails | undefined>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const n of nodes) {
    const d = detailsById[n.id];
    const parts: string[] = [
      n.id,
      n.name,
      n.era,
      n.type,
      n.category,
      n.origin ?? '',
      ...(n.tags ?? []),
      d?.name_en ?? '',
      (d?.description ?? '').slice(0, 600),
      (d?.description_en ?? '').slice(0, 600),
      ...(d?.tags ?? []),
    ];
    map[n.id] = parts.join(' ').toLowerCase();
  }
  return map;
}

/** Tous les mots (séparés par des espaces) doivent apparaître dans le blob. */
export function matchesSearchTokens(blob: string, queryRaw: string): boolean {
  const q = queryRaw.trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const b = blob.toLowerCase();
  return tokens.every((t) => b.includes(t));
}

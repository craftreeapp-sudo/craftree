import nodesIndex from '@/data/nodes-index.json';

/** Premier nœud par ordre alphabétique du nom (aligné sur l’ancienne redirection /explore). */
export function getDefaultTreeNodeId(): string {
  const nodes = nodesIndex.nodes;
  if (nodes.length === 0) return 'feu';
  const sorted = [...nodes].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr')
  );
  return sorted[0]!.id;
}

/**
 * URL canonique d’une invention (vue Built Upon par défaut, sans query inutile).
 * `view=led-to` uniquement pour la vue aval.
 */
export function treeInventionPath(
  id: string,
  view?: 'built-upon' | 'led-to'
): string {
  const base = `/tree/${encodeURIComponent(id)}`;
  if (view === 'led-to') return `${base}?view=led-to`;
  return base;
}

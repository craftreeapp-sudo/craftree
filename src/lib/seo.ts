/**
 * SEO — BRIEF §11 (base URL, résumés pour métadonnées)
 */

export function getSiteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ??
    'https://craftree.app'
  );
}

interface SeedNode {
  id: string;
  name: string;
  description?: string;
}

interface SeedLink {
  source_id: string;
  target_id: string;
}

/** Description courte pour /explore?node= : intrants principaux */
export function buildExploreNodeDescription(
  nodeId: string,
  nodes: SeedNode[],
  links: SeedLink[]
): string {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    return 'Explorez le Tree des technologies et des chaînes de fabrication.';
  }
  const inputs = links
    .filter((l) => l.target_id === nodeId)
    .map((l) => nodes.find((n) => n.id === l.source_id)?.name ?? l.source_id)
    .filter(Boolean);
  if (inputs.length === 0) {
    return (
      node.description?.slice(0, 160) ??
      `Découvrez ${node.name} dans l’arbre Craftree.`
    );
  }
  const list = inputs.slice(0, 10).join(', ');
  const more = inputs.length > 10 ? ` (+${inputs.length - 10})` : '';
  return `Recette : fabriqué à partir de ${list}${more}. ${node.description?.slice(0, 80) ?? ''}`.slice(
    0,
    160
  );
}

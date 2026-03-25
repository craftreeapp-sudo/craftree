/**
 * Affichage « Couche N » : N = profondeur + 1 (Couche 1 = matières premières en bas).
 */
export function getTreeLayerDisplayIndex(depth: number): number {
  return Math.min(20, Math.max(1, depth + 1));
}

/** Libellé court pour badges (recherche, etc.) */
export function getTreeLayerShortLabel(depth: number): string {
  return `Couche ${getTreeLayerDisplayIndex(depth)}`;
}

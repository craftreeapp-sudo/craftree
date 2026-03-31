import type { TechNodeBasic } from './types';

/**
 * Affichage « Couche N » : N = profondeur + 1 (Couche 1 = matières premières en bas).
 */
export function getTreeLayerDisplayIndex(depth: number): number {
  return Math.min(20, Math.max(1, depth + 1));
}

/** Profondeur brute dans l’arbre (0 = matière première). */
export function treeLayerDepthFromNode(node: TechNodeBasic): number {
  if (node.type === 'raw_material') return 0;
  return node.complexity_depth ?? 0;
}

/** Indice affiché sur les cartes (badge « couche »). */
export function treeLayerDisplayIndexFromNode(node: TechNodeBasic): number {
  return getTreeLayerDisplayIndex(treeLayerDepthFromNode(node));
}

/** Libellé court pour badges (recherche, etc.) */
export function getTreeLayerShortLabel(depth: number): string {
  return `Couche ${getTreeLayerDisplayIndex(depth)}`;
}

import { NodeCategory } from './types';

/**
 * Ordre gauche → droite (vue focalisée /explore, aligné sur la légende).
 */
export const NODE_CATEGORY_DISPLAY_ORDER: readonly NodeCategory[] = [
  NodeCategory.MINERAL,
  NodeCategory.VEGETAL,
  NodeCategory.ANIMAL,
  NodeCategory.ELEMENT,
  NodeCategory.ENERGY,
  NodeCategory.MATERIAL,
  NodeCategory.TOOL,
  NodeCategory.PROCESS,
  NodeCategory.MACHINE,
  NodeCategory.ELECTRONICS,
  NodeCategory.CHEMISTRY,
  NodeCategory.CONSTRUCTION,
  NodeCategory.TRANSPORT,
  NodeCategory.COMMUNICATION,
  NodeCategory.FOOD,
  NodeCategory.TEXTILE,
  NodeCategory.MEDICAL,
  NodeCategory.WEAPON,
  NodeCategory.OPTICAL,
  NodeCategory.SOFTWARE,
];

/** Indice pour tri (catégories inconnues en dernier). */
export function categoryDisplayOrderIndex(
  c: NodeCategory | undefined
): number {
  if (!c) return 999;
  const i = NODE_CATEGORY_DISPLAY_ORDER.indexOf(c);
  return i >= 0 ? i : 999;
}

/** Libellés FR affichés sur les cartes (badges uppercase). */
export const CATEGORY_LABELS_FR: Record<NodeCategory, string> = {
  [NodeCategory.MINERAL]: 'MINÉRAL',
  [NodeCategory.VEGETAL]: 'VÉGÉTAL',
  [NodeCategory.ANIMAL]: 'ANIMAL',
  [NodeCategory.ELEMENT]: 'ÉLÉMENT',
  [NodeCategory.ENERGY]: 'ÉNERGIE',
  [NodeCategory.MATERIAL]: 'MATÉRIAU',
  [NodeCategory.TOOL]: 'OUTIL',
  [NodeCategory.PROCESS]: 'PROCÉDÉ',
  [NodeCategory.MACHINE]: 'MACHINE',
  [NodeCategory.ELECTRONICS]: 'ÉLECTRONIQUE',
  [NodeCategory.CHEMISTRY]: 'CHIMIE',
  [NodeCategory.CONSTRUCTION]: 'CONSTRUCTION',
  [NodeCategory.TRANSPORT]: 'TRANSPORT',
  [NodeCategory.COMMUNICATION]: 'COMMUNICATION',
  [NodeCategory.FOOD]: 'ALIMENTATION',
  [NodeCategory.TEXTILE]: 'TEXTILE',
  [NodeCategory.MEDICAL]: 'MÉDICAL',
  [NodeCategory.WEAPON]: 'ARMES',
  [NodeCategory.OPTICAL]: 'OPTIQUE',
  [NodeCategory.SOFTWARE]: 'LOGICIEL',
};

export function getCategoryLabelFr(category: NodeCategory): string {
  return CATEGORY_LABELS_FR[category] ?? String(category).toUpperCase();
}

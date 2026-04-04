import { NodeCategory } from './types';
import { PRIMARY_CARD_CATEGORY_ORDER } from './card-primary-categories';

/**
 * Ordre gauche → droite (vue focalisée /explore, aligné sur la légende).
 */
export const NODE_CATEGORY_DISPLAY_ORDER: readonly NodeCategory[] =
  PRIMARY_CARD_CATEGORY_ORDER;

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
  [NodeCategory.ENERGY]: 'ÉNERGIE',
  [NodeCategory.CONSTRUCTION]: 'CONSTRUCTION',
  [NodeCategory.WEAPON]: 'ARMES',
  [NodeCategory.NETWORK]: 'RÉSEAU',
  [NodeCategory.FOOD]: 'ALIMENTATION',
  [NodeCategory.TRANSPORT]: 'TRANSPORT',
  [NodeCategory.SOFTWARE]: 'LOGICIEL',
  [NodeCategory.INFRASTRUCTURE]: 'INFRASTRUCTURE',
  [NodeCategory.TEXTILE]: 'TEXTILE',
  [NodeCategory.COMMUNICATION]: 'COMMUNICATION',
  [NodeCategory.AGRICULTURE]: 'AGRICULTURE',
  [NodeCategory.ANIMAL]: 'ANIMAL',
  [NodeCategory.ROBOTICS]: 'ROBOTIQUE',
  [NodeCategory.CHEMISTRY]: 'CHIMIE',
  [NodeCategory.ELECTRONICS]: 'ÉLECTRONIQUE',
  [NodeCategory.ENVIRONMENT]: 'ENVIRONNEMENT',
  [NodeCategory.AUTOMATION]: 'AUTOMATISATION',
  [NodeCategory.MEDICAL]: 'MÉDICAL',
  [NodeCategory.OPTICAL]: 'OPTIQUE',
  [NodeCategory.STORAGE]: 'STOCKAGE',
  [NodeCategory.AERONAUTICS]: 'AÉRONAUTIQUE',
  [NodeCategory.SPACE]: 'SPATIAL',
  [NodeCategory.INDUSTRY]: 'INDUSTRIE',
  [NodeCategory.NANOTECHNOLOGY]: 'NANOTECHNOLOGIE',
  [NodeCategory.BIOTECHNOLOGY]: 'BIOTECHNOLOGIE',
  [NodeCategory.SECURITY]: 'SÉCURITÉ',
  [NodeCategory.HOME_AUTOMATION]: 'DOMOTIQUE',
};

export function getCategoryLabelFr(category: NodeCategory): string {
  return CATEGORY_LABELS_FR[category] ?? String(category).toUpperCase();
}

import { NodeCategory } from './types';

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

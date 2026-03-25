/**
 * Libellés FR pour filtres et UI (catégories, époques, types)
 */
import {
  NodeCategory as NC,
  Era as EraEnum,
  type Era,
  type TechNodeType,
} from '@/lib/types';

/** Ordre d’affichage des époques (chronologique) */
export const ERA_ORDER: Era[] = [
  EraEnum.PREHISTORIC,
  EraEnum.ANCIENT,
  EraEnum.MEDIEVAL,
  EraEnum.RENAISSANCE,
  EraEnum.INDUSTRIAL,
  EraEnum.MODERN,
  EraEnum.DIGITAL,
  EraEnum.CONTEMPORARY,
];

export const ERA_LABELS_FR: Record<Era, string> = {
  [EraEnum.PREHISTORIC]: 'Préhistorique',
  [EraEnum.ANCIENT]: 'Antiquité',
  [EraEnum.MEDIEVAL]: 'Moyen Âge',
  [EraEnum.RENAISSANCE]: 'Renaissance',
  [EraEnum.INDUSTRIAL]: 'Industriel',
  [EraEnum.MODERN]: 'Moderne',
  [EraEnum.DIGITAL]: 'Numérique',
  [EraEnum.CONTEMPORARY]: 'Contemporain',
};

/** Plages indicatives (BRIEF §2.1) */
export const ERA_DATE_RANGES: Record<Era, string> = {
  [EraEnum.PREHISTORIC]: 'avant −3000',
  [EraEnum.ANCIENT]: '−3000 à 500',
  [EraEnum.MEDIEVAL]: '500 à 1500',
  [EraEnum.RENAISSANCE]: '1500 à 1750',
  [EraEnum.INDUSTRIAL]: '1750 à 1900',
  [EraEnum.MODERN]: '1900 à 1970',
  [EraEnum.DIGITAL]: '1970 à 2010',
  [EraEnum.CONTEMPORARY]: '2010+',
};

export const NODE_CATEGORY_LABELS_FR: Record<NC, string> = {
  [NC.MINERAL]: 'Minéral',
  [NC.VEGETAL]: 'Végétal',
  [NC.ANIMAL]: 'Animal',
  [NC.ELEMENT]: 'Élément',
  [NC.ENERGY]: 'Énergie',
  [NC.MATERIAL]: 'Matériau',
  [NC.TOOL]: 'Outillage',
  [NC.PROCESS]: 'Procédé',
  [NC.MACHINE]: 'Machine',
  [NC.ELECTRONICS]: 'Électronique',
  [NC.CHEMISTRY]: 'Chimie',
  [NC.CONSTRUCTION]: 'Construction',
  [NC.TRANSPORT]: 'Transport',
  [NC.COMMUNICATION]: 'Communication',
  [NC.FOOD]: 'Alimentation',
  [NC.TEXTILE]: 'Textile',
  [NC.MEDICAL]: 'Médical',
  [NC.WEAPON]: 'Arme',
  [NC.OPTICAL]: 'Optique',
  [NC.SOFTWARE]: 'Logiciel',
};

/** Ordre d’affichage des catégories (groupes naturels puis tech alphabétique cohérent) */
export const NODE_CATEGORY_ORDER: NC[] = [
  NC.MINERAL,
  NC.VEGETAL,
  NC.ANIMAL,
  NC.ELEMENT,
  NC.ENERGY,
  NC.MATERIAL,
  NC.FOOD,
  NC.TEXTILE,
  NC.CHEMISTRY,
  NC.MEDICAL,
  NC.CONSTRUCTION,
  NC.TRANSPORT,
  NC.COMMUNICATION,
  NC.ELECTRONICS,
  NC.MACHINE,
  NC.TOOL,
  NC.PROCESS,
  NC.OPTICAL,
  NC.WEAPON,
  NC.SOFTWARE,
];

export const TECH_NODE_TYPE_ORDER: TechNodeType[] = [
  'raw_material',
  'material',
  'process',
  'tool',
  'component',
  'end_product',
];

export const TECH_NODE_TYPE_LABELS_FR: Record<TechNodeType, string> = {
  raw_material: 'Matière première',
  material: 'Matériau',
  process: 'Procédé',
  tool: 'Outil',
  component: 'Composant',
  end_product: 'Produit final',
};

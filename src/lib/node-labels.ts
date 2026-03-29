/**
 * Libellés FR pour filtres et UI (catégories, époques, types)
 */
import {
  NodeCategory as NC,
  Era as EraEnum,
  type Era,
  type MaterialLevel,
  type NodeDimension,
  type TechNodeType,
} from '@/lib/types';
import { PRIMARY_CARD_CATEGORY_ORDER } from '@/lib/card-primary-categories';

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
  [NC.ENERGY]: 'Énergie',
  [NC.CONSTRUCTION]: 'Construction',
  [NC.WEAPON]: 'Armes',
  [NC.NETWORK]: 'Réseau',
  [NC.FOOD]: 'Alimentation',
  [NC.TRANSPORT]: 'Transport',
  [NC.SOFTWARE]: 'Logiciel',
  [NC.INFRASTRUCTURE]: 'Infrastructure',
  [NC.TEXTILE]: 'Textile',
  [NC.COMMUNICATION]: 'Communication',
  [NC.AGRICULTURE]: 'Agriculture',
  [NC.ROBOTICS]: 'Robotique',
  [NC.CHEMISTRY]: 'Chimie',
  [NC.ELECTRONICS]: 'Électronique',
  [NC.ENVIRONMENT]: 'Environnement',
  [NC.AUTOMATION]: 'Automatisation',
  [NC.MEDICAL]: 'Médical',
  [NC.OPTICAL]: 'Optique',
  [NC.STORAGE]: 'Stockage',
  [NC.AERONAUTICS]: 'Aéronautique',
  [NC.SPACE]: 'Spatial',
  [NC.INDUSTRY]: 'Industrie',
  [NC.NANOTECHNOLOGY]: 'Nanotechnologie',
  [NC.BIOTECHNOLOGY]: 'Biotechnologie',
  [NC.SECURITY]: 'Sécurité',
  [NC.HOME_AUTOMATION]: 'Domotique',
};

/** Ordre d’affichage des catégories (aligné sur les cartes site). */
export const NODE_CATEGORY_ORDER: NC[] = [...PRIMARY_CARD_CATEGORY_ORDER];

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

export const DIMENSION_ORDER: NodeDimension[] = [
  'matter',
  'process',
  'tool',
];

export const DIMENSION_LABELS_FR: Record<NodeDimension, string> = {
  matter: 'Matière',
  process: 'Procédé',
  tool: 'Outil',
};

export const MATERIAL_LEVEL_ORDER: MaterialLevel[] = [
  'raw',
  'processed',
  'industrial',
  'component',
];

export const MATERIAL_LEVEL_LABELS_FR: Record<MaterialLevel, string> = {
  raw: 'Brut',
  processed: 'Transformé',
  industrial: 'Industriel',
  component: 'Composant',
};

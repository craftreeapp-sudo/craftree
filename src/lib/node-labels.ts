/**
 * Libellés FR pour filtres et UI (catégories, époques, dimensions, niveaux matière)
 */
import {
  NodeCategory as NC,
  Era as EraEnum,
  type Era,
  type MaterialLevel,
  type NodeDimension,
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
  [EraEnum.PREHISTORIC]: 'Préhistorique (avant ~3000 av. J.-C.)',
  [EraEnum.ANCIENT]: 'Antiquité (3000 av. J.-C. – 500)',
  [EraEnum.MEDIEVAL]: 'Moyen Âge (500 – 1500)',
  [EraEnum.RENAISSANCE]: 'Renaissance (1500 – 1750)',
  [EraEnum.INDUSTRIAL]: 'Industriel (1750 – 1900)',
  [EraEnum.MODERN]: 'Moderne (1900 – 1970)',
  [EraEnum.DIGITAL]: 'Numérique (1970 – 2010)',
  [EraEnum.CONTEMPORARY]: 'Contemporain (depuis 2010)',
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

/**
 * Visuels pour la page « Catégories » (Unsplash — thématiques cohérentes).
 */
import {
  NodeCategory as NC,
  Era,
  type MaterialLevel,
  type NodeDimension,
} from '@/lib/types';

const Q = 'auto=format&fit=crop&w=800&q=82';

function u(id: string): string {
  return `https://images.unsplash.com/${id}?${Q}`;
}

/** Une image représentative par catégorie de nœud (une photo Unsplash distincte par entrée). */
export const PICKER_IMAGE_CATEGORY: Record<NC, string> = {
  [NC.ENERGY]: u('photo-1509391366360-2e959784a276'),
  [NC.CONSTRUCTION]: u('photo-1504307651254-35680f356dfd'),
  [NC.WEAPON]: u('photo-1550751827-4bd374c3f58b'),
  [NC.NETWORK]: u('photo-1558618666-fcd25c85cd64'),
  [NC.FOOD]: u('photo-1504674900247-0877df9cc836'),
  [NC.TRANSPORT]: u('photo-1449965408869-eaa3f722e40d'),
  [NC.SOFTWARE]: u('photo-1461749280684-dccba630e2f6'),
  /** Routes, ponts, réseaux (distinct de construction). */
  [NC.INFRASTRUCTURE]: u('photo-1590674899484-d5640e854abe'),
  [NC.TEXTILE]: u('photo-1523381210434-271e8be1f52b'),
  /** Télécoms, médias (distinct de « network » câbles / infra numérique). */
  [NC.COMMUNICATION]: u('photo-1522071820081-009f0129c71c'),
  [NC.AGRICULTURE]: u('photo-1464226184884-fa280b87c399'),
  [NC.ROBOTICS]: u('photo-1581091226825-a6a2a5aee158'),
  [NC.CHEMISTRY]: u('photo-1532094349884-543bc11b234d'),
  [NC.ELECTRONICS]: u('photo-1518770660439-4636190af475'),
  [NC.ENVIRONMENT]: u('photo-1470071459604-3b5ec3a7fe05'),
  [NC.AUTOMATION]: u('photo-1497366216548-37526070297c'),
  [NC.MEDICAL]: u('photo-1579684385127-1ef15d508118'),
  [NC.OPTICAL]: u('photo-1628595351029-c2bf17511435'),
  [NC.STORAGE]: u('photo-1597872200969-2b65d56bd16b'),
  [NC.AERONAUTICS]: u('photo-1436491865332-7a61a109cc05'),
  [NC.SPACE]: u('photo-1451187580459-43490279c0fa'),
  /** Procédés industriels génériques (distinct d’automation). */
  [NC.INDUSTRY]: u('photo-1486406146926-c627a92ad1ab'),
  [NC.NANOTECHNOLOGY]: u('photo-1582719471384-894fbb16e074'),
  [NC.BIOTECHNOLOGY]: u('photo-1532187863486-abf9dbad1b69'),
  [NC.SECURITY]: u('photo-1563986768609-322da13575f3'),
  [NC.HOME_AUTOMATION]: u('photo-1558002038-1055907df827'),
};

/** Une image par époque */
export const PICKER_IMAGE_ERA: Record<Era, string> = {
  [Era.PREHISTORIC]: u('photo-1518709268805-4e9042af2176'),
  [Era.ANCIENT]: u('photo-1555992336-fae0cdad3108'),
  [Era.MEDIEVAL]: u('photo-1539650116455-0e0562142317'),
  [Era.RENAISSANCE]: u('photo-1578662996442-48f60103fc96'),
  [Era.INDUSTRIAL]: u('photo-1581092160562-40aa08f9a2ad'),
  [Era.MODERN]: u('photo-1449824913935-59a10b8d2000'),
  [Era.DIGITAL]: u('photo-1517694712202-14dd9538aa97'),
  [Era.CONTEMPORARY]: u('photo-1519389950473-47ba0277781c'),
};

/** Une image par dimension (matière / procédé / outil). */
export const PICKER_IMAGE_DIMENSION: Record<NodeDimension, string> = {
  matter: u('photo-1506905925346-21bda4d32df4'),
  process: u('photo-1565043666747-89394e2a4b95'),
  tool: u('photo-1551434678-e076c223a692'),
};

/** Une image par niveau matière (si dimension = matter). */
export const PICKER_IMAGE_MATERIAL_LEVEL: Record<MaterialLevel, string> = {
  raw: u('photo-1506905925346-21bda4d32df4'),
  processed: u('photo-1581091226825-a6a2a5aee158'),
  industrial: u('photo-1486406146926-c627a92ad1ab'),
  component: u('photo-1581091226825-a6a2a5aee158'),
};

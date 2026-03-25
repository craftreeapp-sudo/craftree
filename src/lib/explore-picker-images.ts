/**
 * Visuels pour la page « Catégories » (Unsplash — thématiques cohérentes).
 */
import { NodeCategory as NC, Era } from '@/lib/types';
import type { TechNodeType } from '@/lib/types';

const Q = 'auto=format&fit=crop&w=800&q=82';

function u(id: string): string {
  return `https://images.unsplash.com/${id}?${Q}`;
}

/** Une image représentative par catégorie de nœud */
export const PICKER_IMAGE_CATEGORY: Record<NC, string> = {
  [NC.MINERAL]: u('photo-1506905925346-21bda4d32df4'),
  [NC.VEGETAL]: u('photo-1464226184884-fa280b87c399'),
  [NC.ANIMAL]: u('photo-1474511320723-9a56873867b5'),
  [NC.ELEMENT]: u('photo-1509316785289-025f5b846b35'),
  [NC.ENERGY]: u('photo-1509391366360-2e959784a276'),
  [NC.MATERIAL]: u('photo-1589939705384-5185137a7f0f'),
  [NC.TOOL]: u('photo-1581145690031-7e6e0c4d5c7f'),
  [NC.PROCESS]: u('photo-1565043666747-89394e2a4b95'),
  [NC.MACHINE]: u('photo-1581091226825-a6a2a5aee158'),
  [NC.ELECTRONICS]: u('photo-1518770660439-4636190af475'),
  [NC.CHEMISTRY]: u('photo-1532094349884-543bc11b234d'),
  [NC.CONSTRUCTION]: u('photo-1504307651254-35680f356dfd'),
  [NC.TRANSPORT]: u('photo-1449965408869-eaa3f722e40d'),
  [NC.COMMUNICATION]: u('photo-1558618666-fcd25c85cd64'),
  [NC.FOOD]: u('photo-1542838132-19c43e701039'),
  [NC.TEXTILE]: u('photo-1558171813-3c031a71257d'),
  [NC.MEDICAL]: u('photo-1579684385127-1ef15d508118'),
  [NC.WEAPON]: u('photo-1595590424283-b8f178427349'),
  [NC.OPTICAL]: u('photo-1516962129806-989217e7a14e'),
  [NC.SOFTWARE]: u('photo-1461749280684-dccba630e2f6'),
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

/** Une image par type de nœud */
export const PICKER_IMAGE_TYPE: Record<TechNodeType, string> = {
  raw_material: u('photo-1506905925346-21bda4d32df4'),
  material: u('photo-1581091226825-a6a2a5aee158'),
  process: u('photo-1565043666747-89394e2a4b95'),
  tool: u('photo-1581145690031-7e6e0c4d5c7f'),
  component: u('photo-1581091226825-a6a2a5aee158'),
  end_product: u('photo-1558618666-fcd25c85cd64'),
};

import { NodeCategory } from '@/lib/types';

/**
 * Catégories principales affichées sur les cartes — ordre du menu « Suggest a correction ».
 */
export const PRIMARY_CARD_CATEGORY_ORDER: readonly NodeCategory[] = [
  NodeCategory.ENERGY,
  NodeCategory.CONSTRUCTION,
  NodeCategory.WEAPON,
  NodeCategory.NETWORK,
  NodeCategory.FOOD,
  NodeCategory.TRANSPORT,
  NodeCategory.SOFTWARE,
  NodeCategory.INFRASTRUCTURE,
  NodeCategory.TEXTILE,
  NodeCategory.COMMUNICATION,
  NodeCategory.AGRICULTURE,
  NodeCategory.ROBOTICS,
  NodeCategory.CHEMISTRY,
  NodeCategory.ELECTRONICS,
  NodeCategory.ENVIRONMENT,
  NodeCategory.AUTOMATION,
  NodeCategory.MEDICAL,
  NodeCategory.OPTICAL,
  NodeCategory.STORAGE,
  NodeCategory.AERONAUTICS,
  NodeCategory.SPACE,
  NodeCategory.INDUSTRY,
  NodeCategory.NANOTECHNOLOGY,
  NodeCategory.BIOTECHNOLOGY,
  NodeCategory.SECURITY,
  NodeCategory.HOME_AUTOMATION,
] as const;

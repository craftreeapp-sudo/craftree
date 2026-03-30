import type { OriginType, NatureType } from '@/lib/types';

const ORIGIN_EXPLORE_KEYS: Record<OriginType, string> = {
  mineral: 'originTypeMineral',
  vegetal: 'originTypeVegetal',
  animal: 'originTypeAnimal',
};

const NATURE_EXPLORE_KEYS: Record<NatureType, string> = {
  element: 'natureTypeElement',
  compose: 'natureTypeCompose',
  materiau: 'natureTypeMateriau',
};

export function originTypeToExploreKey(v: OriginType): string {
  return ORIGIN_EXPLORE_KEYS[v];
}

export function natureTypeToExploreKey(v: NatureType): string {
  return NATURE_EXPLORE_KEYS[v];
}

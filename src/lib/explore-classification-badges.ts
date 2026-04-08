import type { ChemicalNature, NaturalOrigin } from '@/lib/types';

const ORIGIN_EXPLORE_KEYS: Record<NaturalOrigin, string> = {
  mineral: 'originTypeMineral',
  plant: 'originTypePlant',
  animal: 'originTypeAnimal',
};

const NATURE_EXPLORE_KEYS: Record<ChemicalNature, string> = {
  element: 'natureTypeElement',
  compound: 'natureTypeCompound',
  material: 'natureTypeMaterial',
};

export function naturalOriginToExploreKey(v: NaturalOrigin): string {
  return ORIGIN_EXPLORE_KEYS[v];
}

export function chemicalNatureToExploreKey(v: ChemicalNature): string {
  return NATURE_EXPLORE_KEYS[v];
}

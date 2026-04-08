import type { ChemicalNature, NaturalOrigin } from '@/lib/types';

export const NATURAL_ORIGIN_ORDER: readonly NaturalOrigin[] = [
  'mineral',
  'plant',
  'animal',
];

export const CHEMICAL_NATURE_ORDER: readonly ChemicalNature[] = [
  'element',
  'compound',
  'material',
];

/** Ancienne valeur seed/DB → valeur canonique. */
export function parseNaturalOrigin(
  raw: string | null | undefined
): NaturalOrigin | '' {
  if (raw == null || raw === '') return '';
  const s = raw === 'vegetal' ? 'plant' : raw;
  return NATURAL_ORIGIN_ORDER.includes(s as NaturalOrigin)
    ? (s as NaturalOrigin)
    : '';
}

/** Valeur pour `nodes.natural_origin` (CHECK SQL : mineral, vegetal, animal). */
export function naturalOriginAppToDb(
  p: NaturalOrigin
): 'mineral' | 'vegetal' | 'animal' {
  return p === 'plant' ? 'vegetal' : p;
}

export function parseChemicalNature(
  raw: string | null | undefined
): ChemicalNature | '' {
  if (raw == null || raw === '') return '';
  const n =
    raw === 'compose'
      ? 'compound'
      : raw === 'materiau'
        ? 'material'
        : raw;
  return CHEMICAL_NATURE_ORDER.includes(n as ChemicalNature)
    ? (n as ChemicalNature)
    : '';
}

import type { ChemicalNature, NaturalOrigin } from '@/lib/types';

export const NATURAL_ORIGIN_ORDER: readonly NaturalOrigin[] = [
  'mineral',
  'vegetal',
  'animal',
];

export const CHEMICAL_NATURE_ORDER: readonly ChemicalNature[] = [
  'element',
  'compound',
  'material',
];

export function parseNaturalOrigin(
  raw: string | null | undefined
): NaturalOrigin | '' {
  if (raw == null || raw === '') return '';
  return NATURAL_ORIGIN_ORDER.includes(raw as NaturalOrigin)
    ? (raw as NaturalOrigin)
    : '';
}

export function parseChemicalNature(
  raw: string | null | undefined
): ChemicalNature | '' {
  if (raw == null || raw === '') return '';
  return CHEMICAL_NATURE_ORDER.includes(raw as ChemicalNature)
    ? (raw as ChemicalNature)
    : '';
}

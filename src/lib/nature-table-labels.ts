import type { SeedNode } from '@/lib/types';

/** Libellés explore `suggestNaturalOrigin_*` */
export function naturalOriginTableLabel(
  n: SeedNode,
  tExplore: (key: string) => string
): string {
  const o = n.naturalOrigin;
  if (!o) return '—';
  if (o === 'mineral' || o === 'plant' || o === 'animal') {
    return tExplore(`suggestNaturalOrigin_${o}`);
  }
  return '—';
}

/** Libellés explore `suggestChemicalNature_*` */
export function chemicalNatureTableLabel(
  n: SeedNode,
  tExplore: (key: string) => string
): string {
  const raw = n.chemicalNature;
  if (!raw) return '—';
  if (raw === 'element' || raw === 'compound' || raw === 'material') {
    return tExplore(`suggestChemicalNature_${raw}`);
  }
  return '—';
}

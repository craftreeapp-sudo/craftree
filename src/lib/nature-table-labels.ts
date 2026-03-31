import type { SeedNode } from '@/lib/types';

/** Libellés explore `suggestNaturalOrigin_*` */
export function naturalOriginTableLabel(
  n: SeedNode,
  tExplore: (key: string) => string
): string {
  const o = n.origin_type ?? n.naturalOrigin;
  if (!o) return '—';
  if (o === 'mineral' || o === 'vegetal' || o === 'animal') {
    return tExplore(`suggestNaturalOrigin_${o}`);
  }
  return '—';
}

/** Libellés explore `suggestChemicalNature_*` (DB : compose / materiau) */
export function chemicalNatureTableLabel(
  n: SeedNode,
  tExplore: (key: string) => string
): string {
  const raw = n.nature_type ?? n.chemicalNature;
  if (!raw) return '—';
  const map: Record<string, 'element' | 'compound' | 'material'> = {
    element: 'element',
    compose: 'compound',
    compound: 'compound',
    materiau: 'material',
    material: 'material',
  };
  const k = map[String(raw)];
  if (!k) return '—';
  return tExplore(`suggestChemicalNature_${k}`);
}

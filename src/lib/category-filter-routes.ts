/**
 * Validation des segments d’URL /categories/[kind]/[id]
 */
import { NodeCategory, Era } from '@/lib/types';
import type { MaterialLevel, NodeDimension } from '@/lib/types';
import { DIMENSION_ORDER, MATERIAL_LEVEL_ORDER } from '@/lib/node-labels';
import { INVENTION_KIND_ORDER, type InventionKindKey } from '@/lib/invention-classification';

export const FILTER_KINDS = [
  'category',
  'era',
  'dimension',
  'materialLevel',
  'inventionKind',
] as const;
export type FilterKind = (typeof FILTER_KINDS)[number];

const DIMENSION_SET = new Set<string>(DIMENSION_ORDER);
const MATERIAL_LEVEL_SET = new Set<string>(MATERIAL_LEVEL_ORDER);
const INVENTION_KIND_SET = new Set<string>(INVENTION_KIND_ORDER);

export function isFilterKind(s: string): s is FilterKind {
  return FILTER_KINDS.includes(s as FilterKind);
}

export function isValidCategoryId(id: string): id is NodeCategory {
  return (Object.values(NodeCategory) as string[]).includes(id);
}

export function isValidEraId(id: string): id is Era {
  return (Object.values(Era) as string[]).includes(id);
}

export function isValidDimensionId(id: string): id is NodeDimension {
  return DIMENSION_SET.has(id);
}

export function isValidMaterialLevelId(id: string): id is MaterialLevel {
  return MATERIAL_LEVEL_SET.has(id);
}

export function isValidInventionKindId(id: string): id is InventionKindKey {
  return INVENTION_KIND_SET.has(id);
}

export function validateFilterParams(
  kind: string,
  id: string
): { ok: true; kind: FilterKind; id: string } | { ok: false } {
  if (!isFilterKind(kind)) return { ok: false };
  if (kind === 'category' && isValidCategoryId(id))
    return { ok: true, kind: 'category', id };
  if (kind === 'era' && isValidEraId(id)) return { ok: true, kind: 'era', id };
  if (kind === 'dimension' && isValidDimensionId(id))
    return { ok: true, kind: 'dimension', id };
  if (kind === 'materialLevel' && isValidMaterialLevelId(id))
    return { ok: true, kind: 'materialLevel', id };
  if (kind === 'inventionKind' && isValidInventionKindId(id))
    return { ok: true, kind: 'inventionKind', id };
  return { ok: false };
}

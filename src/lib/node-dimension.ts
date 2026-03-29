import type { MaterialLevel, NodeDimension } from '@/lib/types';

const DIMENSIONS = new Set<NodeDimension>(['matter', 'process', 'tool']);
const LEVELS = new Set<MaterialLevel>([
  'raw',
  'processed',
  'industrial',
  'component',
]);

/** `undefined` = champ absent du body (ne pas écraser à l’update). */
export function parseDimensionInput(
  v: unknown
): NodeDimension | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v === 'string' && DIMENSIONS.has(v as NodeDimension)) {
    return v as NodeDimension;
  }
  return undefined;
}

/** `undefined` = champ absent du body. */
export function parseMaterialLevelInput(
  v: unknown
): MaterialLevel | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v === 'string' && LEVELS.has(v as MaterialLevel)) {
    return v as MaterialLevel;
  }
  return undefined;
}

export function normalizeMaterialLevelForDimension(
  dimension: NodeDimension | null,
  materialLevel: MaterialLevel | null
): MaterialLevel | null {
  return dimension === 'matter' ? materialLevel : null;
}

/**
 * Fusion update : champs optionnels depuis `body`, puis contrainte matter ↔ level.
 */
export function mergeDimensionMaterialLevel(
  cur: { dimension?: NodeDimension | null; materialLevel?: MaterialLevel | null },
  body: Record<string, unknown>
): { dimension: NodeDimension | null; materialLevel: MaterialLevel | null } {
  let dimension: NodeDimension | null =
    cur.dimension === undefined ? null : cur.dimension;
  let materialLevel: MaterialLevel | null =
    cur.materialLevel === undefined ? null : cur.materialLevel;

  const bd = parseDimensionInput(body.dimension);
  if (bd !== undefined) dimension = bd;
  const bml = parseMaterialLevelInput(body.materialLevel);
  if (bml !== undefined) materialLevel = bml;

  materialLevel = normalizeMaterialLevelForDimension(dimension, materialLevel);
  return { dimension, materialLevel };
}

/** Création : valeurs par défaut null si absent ou invalide. */
export function dimensionMaterialLevelFromCreateBody(body: Record<string, unknown>): {
  dimension: NodeDimension | null;
  materialLevel: MaterialLevel | null;
} {
  const dim =
    body.dimension === undefined || body.dimension === null || body.dimension === ''
      ? null
      : parseDimensionInput(body.dimension) ?? null;
  const ml =
    body.materialLevel === undefined ||
    body.materialLevel === null ||
    body.materialLevel === ''
      ? null
      : parseMaterialLevelInput(body.materialLevel) ?? null;
  return {
    dimension: dim,
    materialLevel: normalizeMaterialLevelForDimension(dim, ml),
  };
}

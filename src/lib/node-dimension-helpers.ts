/**
 * Classification d’une invention : `dimension` + `materialLevel` (remplace l’ancien champ `type`).
 */
import type { MaterialLevel, NodeDimension } from '@/lib/types';

const MATTER: NodeDimension = 'matter';
const PROCESS: NodeDimension = 'process';
const TOOL: NodeDimension = 'tool';

/** Dimension effective : défaut `matter` si non renseigné. */
export function effectiveDimension(n: {
  dimension?: NodeDimension | null;
}): NodeDimension {
  const d = n.dimension;
  if (d === MATTER || d === PROCESS || d === TOOL) return d;
  return MATTER;
}

/**
 * Niveau matière effectif si `dimension === 'matter'` ; sinon `null`.
 * Défaut `processed` pour la matière si absent.
 */
export function effectiveMaterialLevel(n: {
  dimension?: NodeDimension | null;
  materialLevel?: MaterialLevel | null;
}): MaterialLevel | null {
  if (effectiveDimension(n) !== MATTER) return null;
  const ml = n.materialLevel;
  if (ml === 'raw' || ml === 'processed' || ml === 'industrial' || ml === 'component') {
    return ml;
  }
  return 'processed';
}

export function isRawMaterialNode(n: {
  dimension?: NodeDimension | null;
  materialLevel?: MaterialLevel | null;
}): boolean {
  return (
    effectiveDimension(n) === MATTER && effectiveMaterialLevel(n) === 'raw'
  );
}

export function isMatterDimensionNode(n: {
  dimension?: NodeDimension | null;
}): boolean {
  return effectiveDimension(n) === MATTER;
}

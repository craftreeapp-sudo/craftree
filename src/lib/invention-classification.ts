import {
  RelationType,
  type MaterialLevel,
  type NodeDimension,
  type TechNodeBasic,
} from '@/lib/types';
import { effectiveDimension, effectiveMaterialLevel } from '@/lib/node-dimension-helpers';

/** Clé unique pour les 8 types (liens + dimension de fiche). */
export type InventionKindKey =
  | 'matter_raw'
  | 'matter_processed'
  | 'matter_industrial'
  | 'composant'
  | 'tool'
  | 'energy'
  | 'process'
  | 'infrastructure';

export const INVENTION_KIND_ORDER: readonly InventionKindKey[] = [
  'matter_raw',
  'matter_processed',
  'matter_industrial',
  'composant',
  'tool',
  'energy',
  'process',
  'infrastructure',
] as const;

export function inventionKindToNodeFields(kind: InventionKindKey): {
  dimension: NodeDimension | null;
  materialLevel: MaterialLevel | null;
} {
  switch (kind) {
    case 'matter_raw':
      return { dimension: 'matter', materialLevel: 'raw' };
    case 'matter_processed':
      return { dimension: 'matter', materialLevel: 'processed' };
    case 'matter_industrial':
      return { dimension: 'matter', materialLevel: 'industrial' };
    case 'composant':
      return { dimension: 'composant', materialLevel: null };
    case 'tool':
      return { dimension: 'tool', materialLevel: null };
    case 'energy':
      return { dimension: 'energy', materialLevel: null };
    case 'process':
      return { dimension: 'process', materialLevel: null };
    case 'infrastructure':
      return { dimension: 'infrastructure', materialLevel: null };
    default: {
      const _x: never = kind;
      return _x;
    }
  }
}

/** Déduit la clé affichée à partir de la fiche (dimension + niveau matière). */
export function inventionKindFromNode(
  node: Pick<TechNodeBasic, 'dimension' | 'materialLevel'>
): InventionKindKey {
  const dim = effectiveDimension(node);
  const ml = effectiveMaterialLevel(node);
  if (dim === 'matter') {
    if (ml === 'processed') return 'matter_processed';
    if (ml === 'industrial') return 'matter_industrial';
    if (ml === 'component') return 'composant';
    return 'matter_raw';
  }
  if (dim === 'composant') return 'composant';
  if (dim === 'tool') return 'tool';
  if (dim === 'energy') return 'energy';
  if (dim === 'process') return 'process';
  if (dim === 'infrastructure') return 'infrastructure';
  return 'matter_raw';
}

export function relationTypeFromInventionKind(kind: InventionKindKey): RelationType {
  switch (kind) {
    case 'matter_raw':
    case 'matter_processed':
    case 'matter_industrial':
      return RelationType.MATERIAL;
    case 'composant':
      return RelationType.COMPONENT;
    case 'tool':
      return RelationType.TOOL;
    case 'energy':
      return RelationType.ENERGY;
    case 'process':
      return RelationType.PROCESS;
    case 'infrastructure':
      return RelationType.INFRASTRUCTURE;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * Valeur du sélecteur « type de relation » pour un lien : combine `relation_type`
 * et classification du pair (pour les trois « matière »).
 */
/** Formulaire éditeur : dimension vide = classification non renseignée. */
export function inventionKindFromFormStrings(
  dimension: string,
  materialLevel: string
): InventionKindKey | '' {
  if (!dimension.trim()) return '';
  return inventionKindFromNode({
    dimension: dimension as NodeDimension,
    materialLevel: materialLevel.trim()
      ? (materialLevel as MaterialLevel)
      : null,
  });
}

/** Pour les champs texte du formulaire (chaîne vide = null API). */
export function inventionKindToFormStrings(kind: InventionKindKey): {
  dimension: string;
  materialLevel: string;
} {
  const { dimension, materialLevel } = inventionKindToNodeFields(kind);
  return {
    dimension: dimension ?? '',
    materialLevel: materialLevel ?? '',
  };
}

export function inventionKindFromLinkAndPeer(
  relationType: RelationType,
  peer: Pick<TechNodeBasic, 'dimension' | 'materialLevel'> | undefined
): InventionKindKey {
  /** Lien « composant » : le sélecteur doit suivre le type de lien, pas la fiche pair si elle est encore classée en matière. */
  if (relationType === RelationType.COMPONENT) {
    return 'composant';
  }
  if (relationType === RelationType.MATERIAL) {
    if (!peer) return 'matter_raw';
    return inventionKindFromNode(peer);
  }
  switch (relationType) {
    case RelationType.TOOL:
      return 'tool';
    case RelationType.ENERGY:
      return 'energy';
    case RelationType.PROCESS:
      return 'process';
    case RelationType.INFRASTRUCTURE:
      return 'infrastructure';
    default:
      return 'matter_raw';
  }
}

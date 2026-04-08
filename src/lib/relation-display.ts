import { RelationType } from '@/lib/types';

/** Anciennes valeurs DB / seed avant migration des types officiels. */
const LEGACY_RELATION: Record<string, RelationType> = {
  knowledge: RelationType.PROCESS,
  catalyst: RelationType.TOOL,
};

const OFFICIAL = new Set<string>(Object.values(RelationType));

/**
 * Mappe les `relation_type` hérités vers l’enum actuel pour affichage i18n / couleurs.
 */
export function normalizeRelationTypeForUi(raw: string): RelationType {
  const mapped = LEGACY_RELATION[raw];
  if (mapped) return mapped;
  if (OFFICIAL.has(raw)) return raw as RelationType;
  return RelationType.PROCESS;
}

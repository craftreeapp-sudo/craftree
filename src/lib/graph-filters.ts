import type { Era, NodeCategory } from '@/lib/types';
import {
  INVENTION_KIND_ORDER,
  type InventionKindKey,
  inventionKindFromNode,
} from '@/lib/invention-classification';
import { NodeCategory as NC, Era as EraEnum } from '@/lib/types';
import type { TechNodeBasic } from '@/lib/types';

const ALL_CATEGORIES = new Set(Object.values(NC) as NodeCategory[]);
const ALL_ERAS = new Set(Object.values(EraEnum) as Era[]);
const ALL_INVENTION_KINDS = new Set<InventionKindKey>(INVENTION_KIND_ORDER);

/** Tous les critères de filtre sont actifs (= vue par défaut, aucune restriction). */
export function areAllFiltersActive(
  activeCategories: ReadonlySet<NodeCategory>,
  activeEras: ReadonlySet<Era>,
  activeInventionKinds: ReadonlySet<InventionKindKey>
): boolean {
  if (
    activeCategories.size !== ALL_CATEGORIES.size ||
    activeEras.size !== ALL_ERAS.size ||
    activeInventionKinds.size !== ALL_INVENTION_KINDS.size
  ) {
    return false;
  }
  for (const c of ALL_CATEGORIES) {
    if (!activeCategories.has(c)) return false;
  }
  for (const e of ALL_ERAS) {
    if (!activeEras.has(e)) return false;
  }
  for (const k of ALL_INVENTION_KINDS) {
    if (!activeInventionKinds.has(k)) return false;
  }
  return true;
}

/**
 * Un nœud est visible (non grisé) si catégorie, époque et type de fiche (8 kinds) matchent.
 */
export function nodePassesFilters(
  n: Pick<TechNodeBasic, 'category' | 'era' | 'dimension' | 'materialLevel'>,
  activeCategories: ReadonlySet<NodeCategory>,
  activeEras: ReadonlySet<Era>,
  activeInventionKinds: ReadonlySet<InventionKindKey>
): boolean {
  if (!activeCategories.has(n.category)) return false;
  if (n.era !== undefined && !activeEras.has(n.era)) return false;
  const kind = inventionKindFromNode(n);
  if (!activeInventionKinds.has(kind)) return false;
  return true;
}

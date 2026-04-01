import type { Era, MaterialLevel, NodeCategory, NodeDimension } from '@/lib/types';
import { NodeCategory as NC, Era as EraEnum } from '@/lib/types';
import {
  effectiveDimension,
  effectiveMaterialLevel,
} from '@/lib/node-dimension-helpers';
import type { TechNodeBasic } from '@/lib/types';

const ALL_CATEGORIES = new Set(Object.values(NC) as NodeCategory[]);
const ALL_ERAS = new Set(Object.values(EraEnum) as Era[]);
const ALL_DIMENSIONS = new Set<NodeDimension>(['matter', 'process', 'tool']);
const ALL_MATERIAL_LEVELS = new Set<MaterialLevel>([
  'raw',
  'processed',
  'industrial',
  'component',
]);

/** Tous les critères de filtre sont actifs (= vue par défaut, aucune restriction). */
export function areAllFiltersActive(
  activeCategories: ReadonlySet<NodeCategory>,
  activeEras: ReadonlySet<Era>,
  activeDimensions: ReadonlySet<NodeDimension>,
  activeMaterialLevels: ReadonlySet<MaterialLevel>
): boolean {
  if (
    activeCategories.size !== ALL_CATEGORIES.size ||
    activeEras.size !== ALL_ERAS.size ||
    activeDimensions.size !== ALL_DIMENSIONS.size ||
    activeMaterialLevels.size !== ALL_MATERIAL_LEVELS.size
  ) {
    return false;
  }
  for (const c of ALL_CATEGORIES) {
    if (!activeCategories.has(c)) return false;
  }
  for (const e of ALL_ERAS) {
    if (!activeEras.has(e)) return false;
  }
  for (const d of ALL_DIMENSIONS) {
    if (!activeDimensions.has(d)) return false;
  }
  for (const m of ALL_MATERIAL_LEVELS) {
    if (!activeMaterialLevels.has(m)) return false;
  }
  return true;
}

/**
 * Un nœud est visible (non grisé) si catégorie, époque, dimension matchent ;
 * si la dimension effective est `matter`, le niveau matière effectif doit être actif.
 */
export function nodePassesFilters(
  n: Pick<TechNodeBasic, 'category' | 'era' | 'dimension' | 'materialLevel'>,
  activeCategories: ReadonlySet<NodeCategory>,
  activeEras: ReadonlySet<Era>,
  activeDimensions: ReadonlySet<NodeDimension>,
  activeMaterialLevels: ReadonlySet<MaterialLevel>
): boolean {
  if (!activeCategories.has(n.category)) return false;
  if (n.era !== undefined && !activeEras.has(n.era)) return false;
  const dim = effectiveDimension(n);
  if (!activeDimensions.has(dim)) return false;
  if (dim === 'matter') {
    const ml = effectiveMaterialLevel(n);
    if (ml !== null && !activeMaterialLevels.has(ml)) return false;
  }
  return true;
}

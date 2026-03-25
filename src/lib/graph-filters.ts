import type { Era, NodeCategory, TechNodeType } from '@/lib/types';
import { NodeCategory as NC, Era as EraEnum } from '@/lib/types';

const ALL_CATEGORIES = new Set(Object.values(NC) as NodeCategory[]);
const ALL_ERAS = new Set(Object.values(EraEnum) as Era[]);
/** Aligné sur le store UI — tous les types présents dans les données. */
const ALL_TYPES = new Set<TechNodeType>([
  'raw_material',
  'material',
  'process',
  'tool',
  'component',
  'end_product',
]);

/** Tous les critères de filtre sont actifs (= vue par défaut, aucune restriction). */
export function areAllFiltersActive(
  activeCategories: ReadonlySet<NodeCategory>,
  activeEras: ReadonlySet<Era>,
  activeTypes: ReadonlySet<TechNodeType>
): boolean {
  if (
    activeCategories.size !== ALL_CATEGORIES.size ||
    activeEras.size !== ALL_ERAS.size ||
    activeTypes.size !== ALL_TYPES.size
  ) {
    return false;
  }
  for (const c of ALL_CATEGORIES) {
    if (!activeCategories.has(c)) return false;
  }
  for (const e of ALL_ERAS) {
    if (!activeEras.has(e)) return false;
  }
  for (const t of ALL_TYPES) {
    if (!activeTypes.has(t)) return false;
  }
  return true;
}

/** Un nœud est visible (non grisé par les filtres) si sa catégorie, époque et type sont tous actifs. */
export function nodePassesFilters(
  category: NodeCategory,
  era: Era | undefined,
  type: TechNodeType | undefined,
  activeCategories: ReadonlySet<NodeCategory>,
  activeEras: ReadonlySet<Era>,
  activeTypes: ReadonlySet<TechNodeType>
): boolean {
  if (!activeCategories.has(category)) return false;
  if (era !== undefined && !activeEras.has(era)) return false;
  if (type !== undefined && !activeTypes.has(type)) return false;
  return true;
}

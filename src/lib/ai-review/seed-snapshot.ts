import type { SeedNode } from '@/lib/types';

/**
 * Forme alignée sur `snapshotFromForm` / payloads `edit_node` (sans linkEdits).
 */
export function seedNodeToEditSnapshot(seed: SeedNode): Record<string, unknown> {
  return {
    name: seed.name,
    name_en: seed.name_en ?? '',
    category: seed.category,
    era: seed.era,
    year_approx:
      seed.year_approx === undefined || seed.year_approx === null
        ? null
        : Number(seed.year_approx),
    origin: (seed.origin ?? '').trim(),
    tags: Array.isArray(seed.tags) ? [...seed.tags] : [],
    naturalOrigin: seed.naturalOrigin ?? null,
    chemicalNature: seed.chemicalNature ?? null,
    description: seed.description ?? '',
    description_en: seed.description_en ?? '',
    dimension: seed.dimension ?? null,
    materialLevel: seed.materialLevel ?? null,
    wikipedia_url: seed.wikipedia_url ?? null,
    origin_type: seed.origin_type ?? null,
    nature_type: seed.nature_type ?? null,
  };
}

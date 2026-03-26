import type { TechNodeDetails } from '@/lib/types';

export function nodeRowToTechNodeDetails(
  row: Record<string, unknown>
): TechNodeDetails {
  return {
    name_en: row.name_en != null ? String(row.name_en) : '',
    description: row.description != null ? String(row.description) : '',
    description_en:
      row.description_en != null ? String(row.description_en) : undefined,
    image_url: row.image_url != null ? String(row.image_url) : undefined,
    wikipedia_url: row.wikipedia_url != null ? String(row.wikipedia_url) : undefined,
    origin: row.origin != null ? String(row.origin) : undefined,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
  };
}

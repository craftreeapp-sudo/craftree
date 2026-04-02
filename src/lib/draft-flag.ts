/**
 * Interprétation du flag brouillon (lignes API / JSON / seed).
 * Module dédié — ne pas importer depuis `data.ts` côté client (évite de tirer `seed-data-fs` / `fs`).
 */
export function rowIsDraft(row: Record<string, unknown>): boolean {
  const v = row.is_draft;
  return v === true || v === 'true' || v === 't';
}

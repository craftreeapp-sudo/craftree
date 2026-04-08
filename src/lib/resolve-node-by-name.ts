import type { SupabaseClient } from '@supabase/supabase-js';

/** Correspondance exacte sur `name`, sinon un seul résultat `ilike` partiel. */
export async function resolveNodeIdByName(
  sb: SupabaseClient,
  name: string
): Promise<string | null> {
  const t = name.trim();
  if (!t) return null;
  const { data: exact } = await sb
    .from('nodes')
    .select('id')
    .eq('name', t)
    .limit(2);
  if (exact?.length === 1) return String((exact[0] as { id: string }).id);
  const { data: like } = await sb
    .from('nodes')
    .select('id, name')
    .ilike('name', `%${t.replace(/%/g, '\\%')}%`)
    .limit(5);
  if (like?.length === 1) return String((like[0] as { id: string }).id);
  return null;
}

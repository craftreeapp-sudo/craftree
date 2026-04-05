import type { SupabaseClient } from '@supabase/supabase-js';
import type { SeedNode } from '@/lib/types';

export function rowIsLocked(row: Record<string, unknown>): boolean {
  return row.is_locked === true;
}

export function seedNodeIsLocked(n: Pick<SeedNode, 'is_locked'>): boolean {
  return n.is_locked === true;
}

export function linkEndpointsLockedFromSeed(
  nodes: Pick<SeedNode, 'id' | 'is_locked'>[],
  source_id: string,
  target_id: string
): boolean {
  const src = nodes.find((n) => n.id === source_id);
  const tgt = nodes.find((n) => n.id === target_id);
  return seedNodeIsLocked(src ?? { is_locked: false }) ||
    seedNodeIsLocked(tgt ?? { is_locked: false });
}

export async function linkEndpointsLockedFromSupabase(
  sb: SupabaseClient,
  source_id: string,
  target_id: string
): Promise<boolean> {
  const { data, error } = await sb
    .from('nodes')
    .select('is_locked')
    .in('id', [source_id, target_id]);
  if (error) throw error;
  return Boolean(
    data?.some((r: { is_locked?: boolean }) => r.is_locked === true)
  );
}

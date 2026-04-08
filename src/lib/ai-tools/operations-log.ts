import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';

export type AiToolKind =
  | 'add'
  | 'enrich'
  | 'images'
  | 'review'
  | 'seed_named_drafts';

export async function startAiOperation(params: {
  tool: AiToolKind;
  paramsJson?: Record<string, unknown>;
  costEstimateEur?: number;
  createdByUserId: string | null;
}): Promise<string | null> {
  try {
    const sb = createSupabaseServiceRoleClient();
    const { data, error } = await sb
      .from('ai_operations')
      .insert({
        tool: params.tool,
        status: 'running',
        params: params.paramsJson ?? {},
        cost_estimate: params.costEstimateEur ?? null,
        created_by: params.createdByUserId,
      })
      .select('id')
      .single();
    if (error) {
      console.warn('[ai_operations] insert skipped:', error.message);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    console.warn('[ai_operations]', e);
    return null;
  }
}

export async function completeAiOperation(
  id: string | null,
  patch: {
    status: 'completed' | 'failed';
    results?: Record<string, unknown>;
    cardsProcessed?: number;
    cardsModified?: number;
  }
): Promise<void> {
  if (!id) return;
  try {
    const sb = createSupabaseServiceRoleClient();
    await sb
      .from('ai_operations')
      .update({
        status: patch.status,
        results: patch.results ?? {},
        cards_processed: patch.cardsProcessed ?? 0,
        cards_modified: patch.cardsModified ?? 0,
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);
  } catch (e) {
    console.warn('[ai_operations] complete', e);
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export type AmbiguousMatch = { id: string; name: string };

export type ResolveInventionTokensResult =
  | { ok: true; ids: string[] }
  | {
      ok: false;
      unresolved: string[];
      ambiguous: { token: string; candidates: AmbiguousMatch[] }[];
    };

/**
 * Résout chaque jeton : id exact, puis nom exact, puis un seul résultat ilike partiel.
 */
export async function resolveInventionTokensToIds(
  sb: SupabaseClient,
  tokens: string[]
): Promise<ResolveInventionTokensResult> {
  const unresolved: string[] = [];
  const ambiguous: { token: string; candidates: AmbiguousMatch[] }[] = [];
  const ids: string[] = [];

  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;

    const { data: byId, error: errId } = await sb
      .from('nodes')
      .select('id')
      .eq('id', t)
      .maybeSingle();
    if (errId) throw new Error(errId.message);
    if (byId && typeof (byId as { id?: string }).id === 'string') {
      ids.push((byId as { id: string }).id);
      continue;
    }

    const { data: exact, error: errEx } = await sb
      .from('nodes')
      .select('id, name')
      .eq('name', t)
      .limit(3);
    if (errEx) throw new Error(errEx.message);
    if (exact?.length === 1) {
      ids.push(String((exact[0] as { id: string }).id));
      continue;
    }
    if (exact && exact.length > 1) {
      ambiguous.push({
        token: t,
        candidates: exact.map((r) => ({
          id: String((r as { id: string; name: string }).id),
          name: String((r as { id: string; name: string }).name),
        })),
      });
      continue;
    }

    const pat = `%${escapeIlikePattern(t)}%`;
    const { data: like, error: errLike } = await sb
      .from('nodes')
      .select('id, name')
      .ilike('name', pat)
      .limit(8);
    if (errLike) throw new Error(errLike.message);
    if (!like?.length) {
      unresolved.push(t);
      continue;
    }
    if (like.length === 1) {
      ids.push(String((like[0] as { id: string }).id));
      continue;
    }
    ambiguous.push({
      token: t,
      candidates: like.map((r) => ({
        id: String((r as { id: string; name: string }).id),
        name: String((r as { id: string; name: string }).name),
      })),
    });
  }

  if (unresolved.length > 0 || ambiguous.length > 0) {
    return { ok: false, unresolved, ambiguous };
  }
  return { ok: true, ids };
}

export type ResolveInventionTokensPartialResult = {
  /** Ids résolus (ordre des jetons, sans doublons consécutifs — dédoublonnage final côté appelant). */
  ids: string[];
  unresolved: string[];
  ambiguous: { token: string; candidates: AmbiguousMatch[] }[];
};

/**
 * Résout les jetons sans échouer : introuvables et ambiguïtes sont listés, le reste renvoie des ids.
 */
export async function resolveInventionTokensToIdsPartial(
  sb: SupabaseClient,
  tokens: string[]
): Promise<ResolveInventionTokensPartialResult> {
  const unresolved: string[] = [];
  const ambiguous: { token: string; candidates: AmbiguousMatch[] }[] = [];
  const ids: string[] = [];

  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;

    const { data: byId, error: errId } = await sb
      .from('nodes')
      .select('id')
      .eq('id', t)
      .maybeSingle();
    if (errId) throw new Error(errId.message);
    if (byId && typeof (byId as { id?: string }).id === 'string') {
      ids.push((byId as { id: string }).id);
      continue;
    }

    const { data: exact, error: errEx } = await sb
      .from('nodes')
      .select('id, name')
      .eq('name', t)
      .limit(3);
    if (errEx) throw new Error(errEx.message);
    if (exact?.length === 1) {
      ids.push(String((exact[0] as { id: string }).id));
      continue;
    }
    if (exact && exact.length > 1) {
      ambiguous.push({
        token: t,
        candidates: exact.map((r) => ({
          id: String((r as { id: string; name: string }).id),
          name: String((r as { id: string; name: string }).name),
        })),
      });
      continue;
    }

    const pat = `%${escapeIlikePattern(t)}%`;
    const { data: like, error: errLike } = await sb
      .from('nodes')
      .select('id, name')
      .ilike('name', pat)
      .limit(8);
    if (errLike) throw new Error(errLike.message);
    if (!like?.length) {
      unresolved.push(t);
      continue;
    }
    if (like.length === 1) {
      ids.push(String((like[0] as { id: string }).id));
      continue;
    }
    ambiguous.push({
      token: t,
      candidates: like.map((r) => ({
        id: String((r as { id: string; name: string }).id),
        name: String((r as { id: string; name: string }).name),
      })),
    });
  }

  return { ids, unresolved, ambiguous };
}

/** Message d’erreur API (fr) pour résolution de liste ids / noms. */
export function formatInventionResolveError(
  r: Extract<ResolveInventionTokensResult, { ok: false }>
): string {
  const parts: string[] = [];
  if (r.unresolved.length > 0) {
    parts.push(`Fiches introuvables : ${r.unresolved.join(', ')}`);
  }
  for (const a of r.ambiguous) {
    const names = a.candidates
      .map((c) => `${c.name} (${c.id})`)
      .join(' ; ');
    parts.push(`« ${a.token} » : plusieurs fiches possibles (${names})`);
  }
  return parts.join(' — ');
}

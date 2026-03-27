import type { CraftingLink, RelationType } from '@/lib/types';

/** Champs d’un lien modifiables dans une suggestion de correction. */
export type SuggestLinkSnapshot = {
  id: string;
  relation_type: RelationType;
  notes: string;
  is_optional: boolean;
};

export type SuggestLinkContextEntry = {
  peerId: string;
  peerName: string;
  section: 'ledTo' | 'builtUpon';
};

export function craftingLinkToSnapshot(l: CraftingLink): SuggestLinkSnapshot {
  return {
    id: l.id,
    relation_type: l.relation_type,
    notes: l.notes ?? '',
    is_optional: l.is_optional,
  };
}

function stableStringify(s: SuggestLinkSnapshot): string {
  return JSON.stringify({
    id: s.id,
    relation_type: s.relation_type,
    notes: s.notes.trim(),
    is_optional: s.is_optional,
  });
}

export function computeLinkSuggestionDiff(
  original: Record<string, SuggestLinkSnapshot>,
  proposed: Record<string, SuggestLinkSnapshot>
): Record<string, { from: SuggestLinkSnapshot; to: SuggestLinkSnapshot }> {
  const out: Record<
    string,
    { from: SuggestLinkSnapshot; to: SuggestLinkSnapshot }
  > = {};
  for (const id of Object.keys(proposed)) {
    const a = original[id];
    const b = proposed[id];
    if (!a || !b) continue;
    if (stableStringify(a) !== stableStringify(b)) {
      out[id] = { from: a, to: b };
    }
  }
  return out;
}

/** Identifiants des liens présents à l’origine mais absents de la proposition (suppression demandée). */
export function computeRemovedLinkIds(
  original: Record<string, SuggestLinkSnapshot>,
  proposed: Record<string, SuggestLinkSnapshot>
): string[] {
  return Object.keys(original).filter((id) => proposed[id] === undefined);
}

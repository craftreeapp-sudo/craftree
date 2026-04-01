/**
 * Ordre des champs aligné sur `SuggestionNodeForm` / modal « Ajouter une carte ».
 * Les clés supplémentaires suivent (fiche complète / éditeur).
 */
/** Ordre unique : suggestion visiteur, ajout de carte, base admin (hors image). */
export const SUGGEST_ADD_CARD_NODE_KEYS = [
  'name',
  'name_en',
  'year_approx',
  'category',
  'naturalOrigin',
  'chemicalNature',
  'tags',
  'era',
  'origin',
  'description',
  'description_en',
  'dimension',
  'materialLevel',
  'wikipedia_url',
] as const;

/** Champs réservés à l’admin (hors formulaire visiteur). */
export const EDIT_NODE_EXTRA_KEYS_AFTER_ADD_CARD = ['image_url'] as const;

/** Ordre complet pour une correction de fiche (tous les champs éditables). */
export function editNodeFullKeyOrder(): readonly string[] {
  return [
    ...SUGGEST_ADD_CARD_NODE_KEYS,
    ...EDIT_NODE_EXTRA_KEYS_AFTER_ADD_CARD,
  ];
}

/** Champs après le bloc « même structure qu’ajout de carte » pour new_node. */
export const NEW_NODE_EXTRA_KEYS = [
  'proposed_id',
  'name_en',
  'description_en',
  'wikipedia_url',
  'image_url',
  'dimension',
  'materialLevel',
  'origin_type',
  'nature_type',
] as const;

export function newNodeFullKeyOrder(): readonly string[] {
  return [...SUGGEST_ADD_CARD_NODE_KEYS, ...NEW_NODE_EXTRA_KEYS];
}

/**
 * Ordre des champs aligné sur `SuggestionNodeForm` / modal « Ajouter une carte ».
 * Les clés supplémentaires suivent (fiche complète / éditeur).
 */
export const SUGGEST_ADD_CARD_NODE_KEYS = [
  'name',
  'year_approx',
  'category',
  'naturalOrigin',
  'chemicalNature',
  'tags',
  'era',
  'origin',
  'description',
] as const;

export const EDIT_NODE_EXTRA_KEYS_AFTER_ADD_CARD = [
  'name_en',
  'description_en',
  'type',
  'wikipedia_url',
  'image_url',
  'dimension',
  'materialLevel',
  'origin_type',
  'nature_type',
] as const;

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
  'type',
] as const;

export function newNodeFullKeyOrder(): readonly string[] {
  return [...SUGGEST_ADD_CARD_NODE_KEYS, ...NEW_NODE_EXTRA_KEYS];
}

/**
 * Périmètre produit Craftree pour les prompts LLM.
 * Évite que le modèle traite l’eau, le feu, les minerais, etc. comme des « erreurs »
 * à supprimer : ce sont des nœuds valides dans le graphe de recettes / de savoir.
 */

/** Anglais — verify-inventions.mjs et tout prompt orienté audit qualité. */
export const CRAFTREE_SCOPE_FOR_LLM_EN = `## Craftree scope (read this first)
Craftree maps how human knowledge and resources connect to obtain things: formal inventions, processes, tools, and also natural substances, resources, or “discoveries” that are not patents (e.g. water, fire, ores). Nodes are steps in a recipe graph — what you need to make or enable something downstream — not only patentable gadgets. A natural resource or a foundational process can be a legitimate node because it enables many other technologies. Do NOT recommend deleting a card solely because it is “not an invention” in everyday language: check whether its fields and links are coherent in this graph. Prefer fixing metadata and links over suggesting removal for being natural or foundational.`;

/** Français — add-inventions.mjs, enrich-inventions.mjs, etc. */
export const CRAFTREE_SCOPE_FOR_LLM_FR = `## Périmètre Craftree (à lire en premier)
Craftree représente comment le savoir humain et les ressources s’organisent pour obtenir quelque chose : inventions au sens classique, procédés, outils, mais aussi matières naturelles, ressources, découvertes ou fondations qui ne sont pas des « brevets » (eau, feu, minerais, etc.). Chaque nœud est une étape du graphe de « recettes » — ce qu’il faut pour fabriquer ou rendre possible autre chose — pas seulement des gadgets brevetés. Une ressource naturelle ou un procédé fondateur peut être une fiche légitime parce qu’elle contribue à beaucoup de technologies en aval. Ne propose pas de supprimer une fiche uniquement parce qu’elle n’est « pas une invention » au sens courant : vérifie la cohérence des champs et des liens dans ce modèle. Préfère corriger métadonnées et liens plutôt que recommander la suppression pour le fait d’être naturel ou fondamental.`;

export const AI_REVIEW_MODEL = 'claude-haiku-4-5-20251001';

export const AI_REVIEW_SYSTEM_PROMPT = `Tu es un expert en classification des inventions pour Craftree.
Analyse la fiche d'invention suivante et vérifie qu'elle respecte les règles de classification.

RÈGLES DE CLASSIFICATION :

1. DIMENSION (obligatoire pour toutes les cartes) :
   - "matter" : ce qui compose un objet (matériaux, substances, éléments)
   - "process" : comment on transforme (procédés, techniques, méthodes)
   - "tool" : avec quoi on transforme (outils, machines, installations)

2. MATERIAL LEVEL (obligatoire UNIQUEMENT si dimension = "matter") :
   - "raw" : matières premières brutes extraites de la nature (minerai de cuivre, sable, pétrole brut)
   - "processed" : résultat d'une première transformation (cuivre, silicium, plastique)
   - "industrial" : matériaux utilisables en industrie (circuits en cuivre, verre, polymères)
   - "component" : pièces fonctionnelles d'un produit (batterie, écran, processeur)
   Règle clé : si on le mesure en kg/litres → c'est un matériau (raw/processed/industrial). Si on le compte en unités → c'est un composant.

3. ORIGIN TYPE (pertinent surtout pour dimension = "matter") :
   - "mineral" : provient du sol ou des roches (pierre, sable, minerais) — non vivant
   - "vegetal" : provient des plantes (bois, coton, caoutchouc naturel) — vivant ou issu du vivant
   - "animal" : provient des animaux (cuir, laine, lait) — vivant ou issu du vivant
   - null si non applicable (pour les process et tools)

4. NATURE TYPE (pertinent surtout pour dimension = "matter") :
   - "element" : substance pure définie par la chimie, composé d'un seul type d'atome (cuivre, fer, oxygène)
   - "compound" : composé chimique (eau, sel, acide)
   - "material" : matériau composé de plusieurs substances (plastique, verre, acier)
   - null si non applicable

5. YEAR_APPROX : doit être entre -10000 et 2030. Vérifie que la date est plausible pour cette invention.

6. COHÉRENCE DES LIENS :
   - Les liens "built_upon" doivent être des choses nécessaires pour fabriquer/obtenir l'invention
   - Une invention "matter" de niveau "raw" ne devrait PAS avoir de liens built_upon (c'est une ressource naturelle de base)
   - Un "process" devrait avoir des liens vers les matières ou outils qu'il utilise
   - Un "tool" devrait avoir des liens vers les matières et process nécessaires à sa fabrication

Réponds UNIQUEMENT en JSON avec ce format :
{
  "has_issues": true/false,
  "issues": [
    {
      "field": "nom_du_champ",
      "current_value": "valeur actuelle",
      "suggested_value": "valeur suggérée",
      "reason": "explication courte en français"
    }
  ],
  "missing_links": [
    {
      "type": "built_upon",
      "suggested_name": "nom de l'invention manquante",
      "reason": "explication courte"
    }
  ],
  "suspect_links": [
    {
      "link_id": "id du lien",
      "from": "nom source",
      "to": "nom cible",
      "reason": "pourquoi ce lien semble incorrect"
    }
  ],
  "confidence": 0.0-1.0
}

Si confidence < 0.7, signale que la suggestion nécessite une vérification humaine approfondie.`;

export function buildAiReviewUserPayload(params: {
  mode: 'classify' | 'links' | 'full';
  node: Record<string, unknown>;
  builtUpon: Array<{
    link_id: string;
    source_id: string;
    target_id: string;
    relation_type: string;
    peer_name: string;
  }>;
  ledTo: Array<{
    link_id: string;
    source_id: string;
    target_id: string;
    relation_type: string;
    peer_name: string;
  }>;
}): string {
  const modeHint =
    params.mode === 'classify'
      ? 'Mode: privilégier la classification (dimension, material level, origines, année). Liens : signaler seulement les incohérences majeures.'
      : params.mode === 'links'
        ? 'Mode: privilégier la cohérence des liens built_upon / led_to et des relations.'
        : 'Mode: analyse complète (classification + liens).';

  return JSON.stringify(
    {
      mode_hint: modeHint,
      invention: params.node,
      built_upon: params.builtUpon,
      led_to: params.ledTo,
    },
    null,
    2
  );
}

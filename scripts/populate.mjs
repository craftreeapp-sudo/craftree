/**
 * Peuplement progressif de src/data/seed-data.json via l’API Anthropic (Claude + web search).
 * Upsert Supabase après chaque lot (service role).
 *
 * Usage :
 *   node scripts/populate.mjs
 *   node scripts/populate.mjs --expand
 *   node scripts/populate.mjs --deep
 *   node scripts/populate.mjs --test <nom>   (une seule invention, ex. Cuivre)
 *   node scripts/populate.mjs --no-cascade   (ne pas enrichir la file avec les dépendances manquantes)
 *
 * Prérequis : .env.local avec ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY
 */

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
import { fetchWikipediaImageUrl } from './wikimedia-fetch.mjs';
import {
  createServiceSupabaseClient,
  upsertSeedNodes,
  upsertSeedLinks,
  updateNodeImageUrl,
} from './supabase-seed-sync.mjs';

config({ path: '.env.local' });
config({ path: '.env' });

const testArgIndex = process.argv.indexOf('--test');
let TEST_INVENTION_NAME = null;
if (testArgIndex !== -1) {
  const raw = process.argv[testArgIndex + 1];
  if (!raw || String(raw).startsWith('--')) {
    console.error(
      'Usage : node scripts/populate.mjs --test <nom de l’invention>'
    );
    console.error('Exemple : node scripts/populate.mjs --test Cuivre');
    process.exit(1);
  }
  TEST_INVENTION_NAME = String(raw).trim();
  if (!TEST_INVENTION_NAME) {
    console.error(
      'Le nom de l’invention ne peut pas être vide. Exemple : node scripts/populate.mjs --test Cuivre'
    );
    process.exit(1);
  }
}
const MODE_TEST = TEST_INVENTION_NAME !== null;

const MODE_EXPAND = process.argv.includes('--expand');
const MODE_DEEP = process.argv.includes('--deep');
const MODE_NO_CASCADE = process.argv.includes('--no-cascade');

if (MODE_TEST && (MODE_EXPAND || MODE_DEEP)) {
  console.error(
    '❌ --test ne peut pas être combiné avec --expand ou --deep.'
  );
  process.exit(1);
}

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
if (!apiKey) {
  console.error(
    '❌ ANTHROPIC_API_KEY manquant. Créez .env.local (voir .env.example).'
  );
  process.exit(1);
}

const client = new Anthropic({ apiKey });

/** Rempli au démarrage de main() — pour enqueuePatchNodeImage async */
let serviceSupabase = null;
const SEED_PATH = path.join(process.cwd(), 'src/data/seed-data.json');

const CONCURRENCY = 2;
const PAUSE_BETWEEN_BATCHES_MS = 3000;

const MODEL =
  process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';

function cleanDescription(text) {
  if (text == null || text === '') return '';
  let s = String(text);
  // Blocs cite (y compris attributs type index="1-3")
  s = s.replace(/<cite\b[^>]*>[\s\S]*?<\/cite>/gi, '');
  s = s.replace(/<cite\b[^>]*\/?>/gi, '');
  s = s.replace(/<\/cite>/gi, '');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/\[\d+\]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

const DIMENSION_VALUES = new Set(['matter', 'process', 'tool']);
const MATERIAL_LEVEL_VALUES = new Set([
  'raw',
  'processed',
  'industrial',
  'component',
]);

/** Aligné sur `NodeCategory` dans `src/lib/types.ts` — seules valeurs acceptées en base. */
const NODE_CATEGORY_VALUES = new Set([
  'energy',
  'construction',
  'weapon',
  'network',
  'food',
  'transport',
  'software',
  'infrastructure',
  'textile',
  'communication',
  'agriculture',
  'robotics',
  'chemistry',
  'electronics',
  'environment',
  'automation',
  'medical',
  'optical',
  'storage',
  'aeronautics',
  'space',
  'industry',
  'nanotechnology',
  'biotechnology',
  'security',
  'home_automation',
]);

const TECH_NODE_TYPES = new Set([
  'raw_material',
  'material',
  'process',
  'tool',
  'component',
]);

const NODE_CATEGORY_LIST_FOR_PROMPT = [...NODE_CATEGORY_VALUES].sort().join(', ');

function normalizeCategory(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (NODE_CATEGORY_VALUES.has(s)) return s;
  return 'industry';
}

function normalizeTechNodeType(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === 'end_product') return 'component';
  if (TECH_NODE_TYPES.has(s)) return s;
  return 'material';
}

const ORIGIN_TYPE_VALUES = new Set(['mineral', 'vegetal', 'animal']);
const NATURE_TYPE_VALUES = new Set(['element', 'compose', 'materiau']);

function normalizeOriginNatureTypes(enriched) {
  const otRaw = enriched.origin_type ?? enriched.naturalOrigin;
  const otStr = typeof otRaw === 'string' ? otRaw.trim() : '';
  const origin_type =
    otStr && ORIGIN_TYPE_VALUES.has(otStr) ? otStr : null;

  let ntStr = enriched.nature_type ?? enriched.chemicalNature;
  if (typeof ntStr === 'string') {
    ntStr = ntStr.trim();
    if (ntStr === 'compound') ntStr = 'compose';
    if (ntStr === 'material') ntStr = 'materiau';
  } else {
    ntStr = '';
  }
  const nature_type =
    ntStr && NATURE_TYPE_VALUES.has(ntStr) ? ntStr : null;
  return { origin_type, nature_type };
}

function normalizeDimensionMaterialLevel(enriched) {
  const dRaw = enriched.dimension;
  const dimension =
    typeof dRaw === 'string' && DIMENSION_VALUES.has(dRaw) ? dRaw : null;
  const mlRaw = enriched.materialLevel;
  let materialLevel =
    typeof mlRaw === 'string' && MATERIAL_LEVEL_VALUES.has(mlRaw)
      ? mlRaw
      : null;
  if (dimension !== 'matter') materialLevel = null;
  return { dimension, materialLevel };
}

/** Entier PostgreSQL ; borne les années aberrantes renvoyées par le modèle. */
function normalizeYearApprox(year) {
  if (year == null) return null;
  const n = typeof year === 'number' ? year : Number(year);
  if (!Number.isFinite(n)) return null;
  if (n < -10000) return -10000;
  if (n > 2030) return null;
  return Math.round(n);
}

/** Évite les lectures/écritures concurrentes sur seed-data.json */
let seedWriteChain = Promise.resolve();

function enqueuePatchNodeImage(nodeId, imageUrl) {
  seedWriteChain = seedWriteChain.then(async () => {
    const db = readDB();
    const node = db.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.image_url = imageUrl;
      writeDB(db);
    }
    if (serviceSupabase) {
      await updateNodeImageUrl(serviceSupabase, nodeId, imageUrl);
    }
  });
  return seedWriteChain;
}

function readDB() {
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(SEED_PATH, JSON.stringify(data, null, 2));
}

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeInventionName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sets mis à jour au flush pour les skips en mode normal */
function buildExistingSets(db) {
  const existingNames = new Set(
    db.nodes.map((n) => normalizeInventionName(n.name))
  );
  const existingIds = new Set(db.nodes.map((n) => n.id));
  return { existingNames, existingIds };
}

function alreadyExists(name, existingNames, existingIds) {
  if (!name || typeof name !== 'string') return false;
  return (
    existingNames.has(normalizeInventionName(name)) ||
    existingIds.has(slugify(name))
  );
}

function uniqueLinkId(dbLinks, pendingLinks) {
  const existing = new Set([
    ...dbLinks.map((l) => l.id),
    ...pendingLinks.map((l) => l.id),
  ]);
  let id;
  do {
    id = `l-${crypto.randomBytes(6).toString('hex')}`;
  } while (existing.has(id));
  existing.add(id);
  return id;
}

function nodeNameById(nodes, nodeId) {
  return nodes.find((n) => n.id === nodeId)?.name ?? nodeId;
}

/** Filtre les noms de dépendances trop spécifiques pour la file d'attente. */
function isLikelyFundamental(name) {
  if (!name || typeof name !== 'string') return false;
  const t = name.trim();
  if (t.length > 35) return false;

  const specificPatterns = [
    /en (bronze|fer|bois|pierre|acier|cuivre|verre|or|argent)/i,
    /de (musique|guerre|cuisine|luxe)/i,
    /architecture/i,
    /sculpture/i,
    /temple/i,
    /cathédrale/i,
    /colonne/i,
    /statue/i,
    /bijou/i,
    /ornement/i,
    /décor/i,
  ];

  for (const pattern of specificPatterns) {
    if (pattern.test(t)) return false;
  }
  return true;
}

function buildPrompt(inventionName, existingNodes) {
  return `Tu es un agent de classification pour Craftree, un arbre technologique qui modélise les inventions humaines sous forme de recettes de fabrication.

Recherche des informations sur "${inventionName}" et remplis sa fiche complète.

## RÈGLES DE CLASSIFICATION

### TYPE (obsolète mais conservé pour compatibilité)
- "raw_material" : existe dans la nature sans intervention humaine (eau, sable, minerai de fer, bois)
- "material" : matière transformée par l'homme (acier, plastique, verre, farine)
- "process" : technique ou procédé (fonderie, soudure, distillation)
- "tool" : outil ou machine réutilisable (four, marteau, presse, laser, usine)
- "component" : pièce fonctionnelle intégrée dans un autre produit (transistor, batterie, moteur)

NE JAMAIS utiliser "end_product". Ce type n'existe plus. Si l'objet est utilisé directement par l'utilisateur final (smartphone, voiture, pain), utilise "component" ou "tool" selon le cas.

### CATÉGORIE (site Craftree — une seule valeur parmi la liste EXACTE ci-dessous)

Choisis UNE chaîne parmi ces identifiants (slug, en anglais, minuscules, underscores si besoin) :

${NODE_CATEGORY_LIST_FOR_PROMPT}

Exemples d’aide : énergie → energy ; bâtiment / routes → construction ; armes → weapon ; réseau / Internet → network ; alimentation → food ; déplacement → transport ; code / apps → software ; routes-ponts-canalisations → infrastructure ; textile → textile ; télécom → communication ; agriculture → agriculture ; robotique → robotics ; chimie → chemistry ; électronique → electronics ; environnement → environment ; automatisation industrielle → automation ; santé → medical ; optique → optical ; stockage données → storage ; aviation → aeronautics ; spatial → space ; procédés industriels génériques → industry ; nano → nanotechnology ; biotech → biotechnology ; sûreté / cybersécurité → security ; maison connectée → home_automation.

### ÉPOQUE (basée sur year_approx)

prehistoric (avant -3000), ancient (-3000 à 500), medieval (500 à 1500), renaissance (1500 à 1750), industrial (1750 à 1900), modern (1900 à 1970), digital (1970 à 2010), contemporary (2010+)

### DIMENSION (nature de l'invention)
- "matter" : ce qui compose un objet (matières, substances, composants physiques)
- "process" : comment on transforme (procédés, techniques, méthodes)
- "tool" : avec quoi on transforme (outils, machines, usines, instruments)

### NIVEAU MATIÈRE (materialLevel) — UNIQUEMENT si dimension = "matter", sinon null obligatoirement

Test principal : est-ce qu'on le MESURE (kg, litres, mètres) ou est-ce qu'on le COMPTE (1, 2, 3 unités) ?
- Si on le mesure → c'est raw, processed ou industrial (voir ci-dessous)
- Si on le compte → c'est "component"

Sous-classement pour les matières mesurables :
- "raw" : la nature le fournit tel quel, on extrait/récolte/mine sans transformation. Ex: minerai de fer, sable, pétrole brut, bois, laine brute, eau
- "processed" : une NOUVELLE SUBSTANCE créée par transformation chimique ou physique fondamentale. Le minerai DEVIENT du fer. Le sable DEVIENT du silicium. Ex: acier, silicium, plastique, farine, ciment, verre (en tant que substance)
- "industrial" : le MÊME matériau mais mis en FORME ou CALIBRÉ pour un usage spécifique. Ex: fil de cuivre (= cuivre tréfilé), tôle d'acier (= acier laminé), verre trempé (= verre traité), poutre en béton
- "component" : une pièce fonctionnelle AUTONOME qui FAIT quelque chose. On la compte en unités. Ex: batterie, processeur, moteur, écran, ampoule, pneu, transistor

Cas ambigus — applique ces règles :
- Alliage (acier inoxydable, bronze) = "processed" (c'est une nouvelle substance en vrac)
- Poudre/mélange (poudre à canon, béton frais) = "processed" (on le mesure au poids)
- Béton coulé en forme = "industrial" (même substance mise en forme)
- Pain, fromage = "component" (objet fini comptable)

### ORIGINE NATURELLE (origin_type) — D'où ça vient dans la nature

Applicable principalement aux matières (dimension = "matter"), mais peut aussi s'appliquer à certains outils primitifs.
Mettre null si non applicable (procédés purement intellectuels, machines modernes, etc.)

- "mineral" : provient du sol, des roches, du sous-sol. Non vivant.
  Ex : pierre, sable, minerais (fer, cuivre, or), sel gemme, argile, pétrole, charbon
- "vegetal" : provient des plantes. Vivant ou issu du vivant.
  Ex : bois, coton, caoutchouc naturel, lin, papier, résine, liège
- "animal" : provient des animaux. Vivant ou issu du vivant.
  Ex : cuir, laine, soie, os, ivoire, lait, cire d'abeille

Cas ambigus :
- Pétrole = "mineral" (même s'il provient d'organismes fossiles, c'est extrait du sous-sol)
- Charbon = "mineral" (idem)
- Caoutchouc synthétique = null (ce n'est plus d'origine naturelle)

### NATURE CHIMIQUE/PHYSIQUE (nature_type) — Ce que c'est physiquement

Applicable principalement aux matières (dimension = "matter").
Mettre null si non applicable.

- "element" : substance pure composée d'un seul type d'atome. Définie par le tableau périodique.
  Ex : cuivre (Cu), fer (Fe), or (Au), oxygène (O₂), silicium (Si), carbone
- "compose" : substance formée de plusieurs éléments chimiques liés. A une formule chimique.
  Ex : eau (H₂O), sel (NaCl), acide sulfurique (H₂SO₄), dioxyde de carbone (CO₂), sucre
- "materiau" : mélange, alliage ou assemblage sans formule chimique unique. Défini par ses propriétés d'usage.
  Ex : acier (alliage fer+carbone), béton (ciment+sable+eau+gravier), verre, plastique, bois (matériau composite naturel)

Test rapide :
- Est-ce dans le tableau périodique ? → "element"
- A-t-il une formule chimique simple (H₂O, NaCl) ? → "compose"
- Est-ce un mélange/alliage défini par ses propriétés ? → "materiau"

### INTRANTS (built_upon) — type de relation

- "material" → consommé/transformé/intégré dans le produit. Disparaît.
- "tool" → utilisé pendant la fabrication, récupéré après. Reste intact.
- "energy" → fournit la force, la chaleur, l'énergie.
- "knowledge" → savoir/technique prérequise. Pas un objet physique.
- "catalyst" → facilite mais pas strictement nécessaire.

IMPORTANT : uniquement les intrants de PREMIER NIVEAU (dépendances directes). Entre 2 et 8 intrants.

### PRODUITS (led_to)

Inventions que celle-ci a DIRECTEMENT permis de créer. Entre 0 et 6 produits.

## INVENTIONS EXISTANTES

Utilise EXACTEMENT ces ids pour les intrants/produits existants :
${existingNodes.map((n) => `${n.name} (${n.id})`).join('\n')}

Si un intrant/produit n'existe pas encore, mets "exists": false avec un id suggéré en slug.

## RÈGLES DE FILTRAGE — TRÈS IMPORTANT

Pour les intrants (built_upon) et les produits (led_to), ne liste QUE des inventions FONDAMENTALES et GÉNÉRIQUES.
Une invention fondamentale est :

- Un matériau de base utilisé dans de nombreuses autres inventions (ex: "Acier", "Verre", "Cuivre")
- Un outil ou procédé générique réutilisable (ex: "Four", "Fonderie", "Soudure")
- Un composant technique clé (ex: "Transistor", "Engrenage", "Lentille")
- Une machine ou un produit qui a marqué un tournant technologique (ex: "Machine à vapeur", "Automobile", "Internet")

NE PAS inclure :

- Des variantes spécifiques (pas "Brique réfractaire", juste "Brique")
- Des applications particulières (pas "Sculpture sur pierre", "Armes en bronze", "Architecture gothique")
- Des sous-types (pas "Acier inoxydable", "Brique creuse", "Verre trempé") sauf s'ils sont technologiquement majeurs
- Des marques ou modèles spécifiques
- Des œuvres ou constructions spécifiques (pas "Temple antique", "Cathédrale", "Colonne en pierre")

Pose-toi la question : "Est-ce que cette invention mérite sa propre carte dans un arbre technologique de la CIVILISATION ?" Si c'est trop spécifique ou anecdotique, ne l'inclus pas.
Vise des inventions au même niveau de généralité que : Roue, Acier, Papier, Électricité, Transistor, Béton, Vaccin, Moteur à vapeur.

## FORMAT DE RÉPONSE

Les descriptions doivent être du texte brut, sans aucune balise HTML, sans aucune balise XML, sans cite, sans index, sans crochets, sans référence. Juste du texte simple et lisible.

Réponds UNIQUEMENT avec un JSON valide, rien d'autre :

{
  "name": "Nom en français",
  "name_en": "English name",
  "description": "2-3 phrases en français.",
  "description_en": "2-3 short sentences in English.",
  "category": "...",
  "type": "...",
  "era": "...",
  "year_approx": 1886,
  "origin": "Inventeur, entreprise ou pays. Null si inconnu.",
  "dimension": "matter",
  "materialLevel": "processed",
  "origin_type": "mineral",
  "nature_type": "compose",
  "wikipedia_url": "https://fr.wikipedia.org/wiki/...",
  "tags": ["tag1", "tag2"],
  "built_upon": [
    { "id": "acier", "name": "Acier", "relation_type": "material", "exists": true }
  ],
  "led_to": [
    { "id": "camion", "name": "Camion", "exists": false }
  ]
}`;
}

async function enrichInvention(name, existingNodes) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 5,
      },
    ],
    messages: [{ role: 'user', content: buildPrompt(name, existingNodes) }],
  });

  const textContent = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  const jsonMatch = textContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Pas de JSON dans la réponse');

  const enriched = JSON.parse(jsonMatch[0]);
  if (typeof enriched.description === 'string') {
    enriched.description = cleanDescription(enriched.description);
  }
  if (typeof enriched.description_en === 'string') {
    enriched.description_en = cleanDescription(enriched.description_en);
  }
  return enriched;
}

/** Accumulation par lot ; pas d’écriture disque ici */
let pendingChanges = { nodes: [], links: [], updates: [] };

function getMergedNodes() {
  const db = readDB();
  return [...db.nodes, ...pendingChanges.nodes];
}

function getMergedLinks() {
  const db = readDB();
  return [...db.links, ...pendingChanges.links];
}

/**
 * Crée les liens manquants décrits dans enriched (built_upon / led_to).
 * @returns {{ newDependencies: string[], linksCreated: number }}
 */
function applyLinksFromEnrichment(enriched, id, nodesAfterNode, allLinks, db) {
  const newDependencies = [];
  let linksCreated = 0;

  if (enriched.built_upon) {
    for (const input of enriched.built_upon) {
      const sourceId = input.id || slugify(input.name);

      if (!nodesAfterNode.find((n) => n.id === sourceId)) {
        if (input.exists === false) {
          newDependencies.push(input.name);
        }
        continue;
      }

      const linkExists = allLinks.some(
        (l) => l.source_id === sourceId && l.target_id === id
      );
      if (!linkExists) {
        const rel = input.relation_type || 'material';
        const link = {
          id: uniqueLinkId(db.links, pendingChanges.links),
          source_id: sourceId,
          target_id: id,
          relation_type: rel,
          is_optional: false,
          notes: null,
        };
        pendingChanges.links.push(link);
        allLinks.push(link);
        linksCreated++;
        console.log(
          `   🔗 Lien créé : ${nodeNameById(nodesAfterNode, sourceId)} →[${rel}]→ ${enriched.name}`
        );
      }
    }
  }

  if (enriched.led_to) {
    for (const output of enriched.led_to) {
      const targetId = output.id || slugify(output.name);

      if (!nodesAfterNode.find((n) => n.id === targetId)) {
        if (output.exists === false) {
          newDependencies.push(output.name);
        }
        continue;
      }

      const linkExists = allLinks.some(
        (l) => l.source_id === id && l.target_id === targetId
      );
      if (!linkExists) {
        const rel = output.relation_type || 'material';
        const link = {
          id: uniqueLinkId(db.links, pendingChanges.links),
          source_id: id,
          target_id: targetId,
          relation_type: rel,
          is_optional: false,
          notes: null,
        };
        pendingChanges.links.push(link);
        allLinks.push(link);
        linksCreated++;
        console.log(
          `   🔗 Lien créé : ${enriched.name} →[${rel}]→ ${nodeNameById(nodesAfterNode, targetId)}`
        );
      }
    }
  }

  return { newDependencies, linksCreated };
}

function cloneAiArrays(enriched) {
  const builtRaw = Array.isArray(enriched.built_upon)
    ? JSON.parse(JSON.stringify(enriched.built_upon))
    : [];
  const ledRaw = Array.isArray(enriched.led_to)
    ? JSON.parse(JSON.stringify(enriched.led_to))
    : [];
  return { builtRaw, ledRaw };
}

/**
 * @param enriched
 * @param {{ allowUpdate?: boolean }} [opts]
 */
function addInventionToDB(enriched, opts = {}) {
  if (MODE_TEST) {
    console.log('📋 Réponse Claude brute :', JSON.stringify(enriched, null, 2));
  }
  const allowUpdate = opts.allowUpdate === true;
  const db = readDB();
  const id = slugify(enriched.name);
  const allNodes = getMergedNodes();
  const allLinks = getMergedLinks();

  const existing = allNodes.find((n) => n.id === id);

  const builtLed = cloneAiArrays(enriched);
  const { builtRaw, ledRaw } = builtLed;

  const year_approx = normalizeYearApprox(enriched.year_approx);

  const { dimension, materialLevel } = normalizeDimensionMaterialLevel(enriched);
  const { origin_type, nature_type } = normalizeOriginNatureTypes(enriched);
  const category = normalizeCategory(enriched.category);
  const type = normalizeTechNodeType(enriched.type);

  if (existing) {
    if (!allowUpdate) {
      return {
        added: false,
        updated: false,
        newDependencies: [],
        linksCreated: 0,
        nodeId: null,
        wikipediaUrl: null,
      };
    }

    const patch = {
      name_en: enriched.name_en || '',
      description: cleanDescription(enriched.description ?? ''),
      description_en: cleanDescription(enriched.description_en ?? ''),
      category,
      type,
      era: enriched.era,
      year_approx,
      origin: enriched.origin || null,
      wikipedia_url: enriched.wikipedia_url || null,
      tags: Array.isArray(enriched.tags) ? enriched.tags : [],
      dimension,
      materialLevel,
      origin_type,
      nature_type,
      _ai_built_upon: builtRaw,
      _ai_led_to: ledRaw,
    };

    pendingChanges.updates.push({ id, patch });

    const { newDependencies, linksCreated } = applyLinksFromEnrichment(
      enriched,
      id,
      allNodes,
      allLinks,
      db
    );

    return {
      added: false,
      updated: true,
      newDependencies,
      linksCreated,
      nodeId: id,
      wikipediaUrl: enriched.wikipedia_url || null,
    };
  }

  const node = {
    id,
    name: enriched.name,
    name_en: enriched.name_en || '',
    description: cleanDescription(enriched.description ?? ''),
    description_en: cleanDescription(enriched.description_en ?? ''),
    category,
    type,
    era: enriched.era,
    year_approx,
    origin: enriched.origin || null,
    image_url: null,
    wikipedia_url: enriched.wikipedia_url || null,
    tags: Array.isArray(enriched.tags) ? enriched.tags : [],
    complexity_depth: 0,
    dimension,
    materialLevel,
    origin_type,
    nature_type,
    _ai_built_upon: builtRaw,
    _ai_led_to: ledRaw,
  };

  pendingChanges.nodes.push(node);

  const nodesAfterNode = [...allNodes, node];

  const { newDependencies, linksCreated } = applyLinksFromEnrichment(
    enriched,
    id,
    nodesAfterNode,
    allLinks,
    db
  );

  return {
    added: true,
    updated: false,
    newDependencies,
    linksCreated,
    nodeId: id,
    wikipediaUrl: enriched.wikipedia_url || null,
  };
}

async function flushChanges(existingState, supabase) {
  const { existingNames, existingIds } = existingState;
  if (
    pendingChanges.nodes.length === 0 &&
    pendingChanges.links.length === 0 &&
    pendingChanges.updates.length === 0
  ) {
    return;
  }

  const snapshotNodes = [...pendingChanges.nodes];
  const snapshotUpdates = [...pendingChanges.updates];
  const snapshotLinks = [...pendingChanges.links];

  const db = readDB();

  for (const { id, patch } of snapshotUpdates) {
    const n = db.nodes.find((x) => x.id === id);
    if (n) {
      Object.assign(n, patch);
    }
  }

  for (const node of snapshotNodes) {
    if (!db.nodes.find((n) => n.id === node.id)) {
      db.nodes.push(node);
      existingNames.add(normalizeInventionName(node.name));
      existingIds.add(node.id);
    }
  }

  for (const link of snapshotLinks) {
    if (!db.links.find((l) => l.id === link.id)) {
      db.links.push(link);
    }
  }

  writeDB(db);

  const nodeIds = new Set([
    ...snapshotNodes.map((n) => n.id),
    ...snapshotUpdates.map((u) => u.id),
  ]);
  const nodesToSync = nodeIds.size
    ? db.nodes.filter((n) => nodeIds.has(n.id))
    : [];
  await upsertSeedNodes(supabase, nodesToSync);
  await upsertSeedLinks(supabase, snapshotLinks);

  pendingChanges = { nodes: [], links: [], updates: [] };
}

async function reconcileLinks(supabase) {
  console.log('\n🔗 Réconciliation des liens...');
  const db = readDB();
  let linksCreated = 0;
  const newLinksForSupabase = [];

  for (const node of db.nodes) {
    if (node._ai_built_upon && Array.isArray(node._ai_built_upon)) {
      for (const input of node._ai_built_upon) {
        const sourceId = input.id || slugify(input.name);
        const sourceExists = db.nodes.find((n) => n.id === sourceId);
        const linkExists = db.links.find(
          (l) => l.source_id === sourceId && l.target_id === node.id
        );

        if (sourceExists && !linkExists) {
          const rel = input.relation_type || 'material';
          const link = {
            id: uniqueLinkId(db.links, []),
            source_id: sourceId,
            target_id: node.id,
            relation_type: rel,
            is_optional: false,
            notes: null,
          };
          db.links.push(link);
          newLinksForSupabase.push(link);
          linksCreated++;
          console.log(
            `   🔗 Lien créé : ${nodeNameById(db.nodes, sourceId)} →[${rel}]→ ${node.name}`
          );
        }
      }
    }

    if (node._ai_led_to && Array.isArray(node._ai_led_to)) {
      for (const output of node._ai_led_to) {
        const targetId = output.id || slugify(output.name);
        const targetExists = db.nodes.find((n) => n.id === targetId);
        const linkExists = db.links.find(
          (l) => l.source_id === node.id && l.target_id === targetId
        );

        if (targetExists && !linkExists) {
          const rel = output.relation_type || 'material';
          const link = {
            id: uniqueLinkId(db.links, []),
            source_id: node.id,
            target_id: targetId,
            relation_type: rel,
            is_optional: false,
            notes: null,
          };
          db.links.push(link);
          newLinksForSupabase.push(link);
          linksCreated++;
          console.log(
            `   🔗 Lien créé : ${node.name} →[${rel}]→ ${nodeNameById(db.nodes, targetId)}`
          );
        }
      }
    }
  }

  if (linksCreated > 0) {
    writeDB(db);
    await upsertSeedLinks(supabase, newLinksForSupabase);
  }
  console.log(`   ✅ Réconciliation : ${linksCreated} lien(s) créé(s)`);
  return linksCreated;
}

function maxGraphDepth(db) {
  const incoming = new Map();
  for (const l of db.links) {
    if (!incoming.has(l.target_id)) incoming.set(l.target_id, []);
    incoming.get(l.target_id).push(l.source_id);
  }
  const memo = new Map();

  /** Profondeur max vers les sources ; `visiting` évite la récursion infinie si le graphe a des cycles. */
  function depth(nodeId, visiting) {
    if (memo.has(nodeId)) return memo.get(nodeId);
    if (visiting.has(nodeId)) return 0;
    visiting.add(nodeId);
    const parents = incoming.get(nodeId) || [];
    let d;
    if (parents.length === 0) {
      d = 0;
    } else {
      const depths = parents.map((p) => depth(p, visiting));
      d = 1 + Math.max(0, ...depths);
    }
    visiting.delete(nodeId);
    memo.set(nodeId, d);
    return d;
  }

  let max = 0;
  for (const n of db.nodes) {
    max = Math.max(max, depth(n.id, new Set()));
  }
  return max;
}

function topRawMaterials(db, limit = 5) {
  const raw = db.nodes.filter((n) => n.type === 'raw_material');
  const counts = raw.map((n) => ({
    name: n.name,
    count: db.links.filter((l) => l.source_id === n.id).length,
  }));
  counts.sort((a, b) => b.count - a.count);
  return counts.slice(0, limit);
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m} min ${sec}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60} min`;
}

let startTime = Date.now();

/** Temps restant estimé à partir du temps moyen réel par lot */
function estimateRemaining(remaining, batchIdx) {
  if (batchIdx === 0) return 'calcul...';
  const elapsed = (Date.now() - startTime) / 1000;
  const avgBatchWall = elapsed / batchIdx;
  const batchesRemaining = Math.max(0, Math.ceil(remaining / CONCURRENCY));
  const secondsRemaining = batchesRemaining * avgBatchWall;

  if (secondsRemaining < 60) return `~${Math.round(secondsRemaining)}s`;
  if (secondsRemaining < 3600) return `~${Math.round(secondsRemaining / 60)} min`;
  return `~${(secondsRemaining / 3600).toFixed(1)}h`;
}

async function processBatch(batch, existingNodes) {
  const promises = batch.map((name) =>
    enrichInvention(name, existingNodes)
      .then((enriched) => ({ ok: true, name, enriched }))
      .catch((error) => ({
        ok: false,
        name,
        error: error instanceof Error ? error.message : String(error),
      }))
  );
  return Promise.all(promises);
}

function countQueueNeedingApi(
  queue,
  existingNames,
  existingIds,
  skipExistingCheck
) {
  if (skipExistingCheck) return queue.length;
  let c = 0;
  for (const name of queue) {
    if (!alreadyExists(name, existingNames, existingIds)) c++;
  }
  return c;
}

function hasIncomingLink(db, nodeId) {
  return db.links.some((l) => l.target_id === nodeId);
}

function buildExpandQueue(db) {
  const q = [];
  for (const node of db.nodes) {
    const hasDescription = node.description && node.description.length > 10;
    const hasInputs = db.links.some((l) => l.target_id === node.id);
    if (!hasDescription || !hasInputs) {
      q.push(node.name);
    }
  }
  return q;
}

function buildDeepExtraNames(db) {
  const extra = [];
  const seen = new Set();
  for (const node of db.nodes) {
    const inputLinks = db.links.filter((l) => l.target_id === node.id);
    for (const link of inputLinks) {
      const sourceId = link.source_id;
      if (!hasIncomingLink(db, sourceId)) {
        const n = db.nodes.find((x) => x.id === sourceId);
        if (n) {
          const key = normalizeInventionName(n.name);
          if (!seen.has(key)) {
            seen.add(key);
            extra.push(n.name);
          }
        }
      }
    }
  }
  return extra;
}

const SEED_INVENTIONS = [
  'Eau',
  'Feu',
  'Bois',
  'Sable',
  'Argile',
  'Pierre',
  'Minerai de fer',
  'Minerai de cuivre',
  'Sel',
  'Charbon',
  'Pétrole',
  'Calcaire',
  'Soufre',
  'Salpêtre',
  'Cuivre',
  'Bronze',
  'Fer',
  'Acier',
  'Verre',
  'Ciment',
  'Béton',
  'Brique',
  'Papier',
  'Plastique',
  'Caoutchouc',
  'Aluminium',
  'Silicium',
  'Titane',
  'Charbon de bois',
  'Électricité',
  'Essence',
  'Hydrogène',
  'Énergie nucléaire',
  'Énergie solaire',
  'Four',
  'Forge',
  'Marteau',
  'Clou',
  'Vis',
  'Tour',
  'Moule',
  'Presse',
  'Scie',
  'Hache',
  'Fonderie',
  'Distillation',
  'Fermentation',
  'Soudure',
  'Photolithographie',
  'Galvanisation',
  'Pasteurisation',
  'Vulcanisation',
  'Électrolyse',
  'Engrenage',
  'Ressort',
  'Roulement à billes',
  'Transistor',
  'Circuit imprimé',
  'Lentille optique',
  'Fil de cuivre',
  'Câble électrique',
  'Pneu',
  'Boulon',
  'Roue',
  'Poulie',
  'Levier',
  'Machine à vapeur',
  'Moteur à explosion',
  'Moteur électrique',
  'Turbine',
  'Générateur électrique',
  'Pompe',
  'Encre',
  'Imprimerie',
  'Télégraphe',
  'Téléphone',
  'Radio',
  'Télévision',
  'Ordinateur',
  'Internet',
  'Smartphone',
  'Fibre optique',
  'Chariot',
  'Bateau à voile',
  'Locomotive',
  'Automobile',
  'Avion',
  'Fusée',
  'Vélo',
  'Sous-marin',
  'Charpente',
  'Pont',
  'Arche',
  'Vitre',
  'Tuyau',
  'Route bitumée',
  'Gratte-ciel',
  'Barrage',
  'Pain',
  'Fromage',
  'Vin',
  'Bière',
  'Conserve',
  'Sucre',
  'Chocolat',
  "Huile d'olive",
  'Fil de coton',
  'Tissu',
  'Teinture',
  'Soie',
  'Machine à coudre',
  'Vêtement',
  'Nylon',
  'Vaccin',
  'Antibiotique',
  'Stéthoscope',
  'Microscope',
  'Rayons X',
  'Anesthésie',
  'Prothèse',
  'Savon',
  'Poudre à canon',
  'Dynamite',
  'Engrais',
  'Acide sulfurique',
  'Ammoniac',
  'Lunettes',
  'Télescope',
  'Appareil photo',
  'Laser',
  'Batterie',
  'Ampoule électrique',
  'Microprocesseur',
  'Mémoire RAM',
  'Disque dur',
  'GPS',
  'Panneau solaire',
  'Arc',
  'Épée',
  'Arbalète',
  'Canon',
  'Fusil',
];

async function main() {
  const scriptStart = Date.now();
  serviceSupabase = createServiceSupabaseClient();
  console.log('🚀 Craftree — Peuplement automatique de la base de données\n');
  console.log(`   Modèle : ${MODEL}`);
  if (MODE_TEST) {
    console.log(`   Mode : test — une seule invention : « ${TEST_INVENTION_NAME} »\n`);
  } else if (MODE_DEEP) {
    console.log('   Mode : deep (expansion + intrants sans parents)\n');
  } else if (MODE_EXPAND) {
    console.log('   Mode : expand (fiches existantes incomplètes)\n');
  } else {
    console.log('');
  }
  if (MODE_NO_CASCADE) {
    console.log(
      '   Option : --no-cascade (dépendances manquantes loguées, non ajoutées à la file)\n'
    );
  }

  let dbInit = readDB();
  let existingState = buildExistingSets(dbInit);
  let { existingNames, existingIds } = existingState;

  const skipExistingCheck = MODE_EXPAND || MODE_DEEP || MODE_TEST;

  let queue = [];
  let totalInList = 0;
  let alreadyTreated = 0;
  let newToSearch = 0;

  if (MODE_TEST) {
    queue = [TEST_INVENTION_NAME];
    totalInList = 1;
    alreadyTreated = 0;
    newToSearch = 1;
    console.log(
      `📋 Mode test : 1 invention (« ${TEST_INVENTION_NAME} ») — traitement forcé même si déjà en base\n`
    );
  } else if (MODE_EXPAND || MODE_DEEP) {
    console.log('🔄 Mode expansion : enrichissement des fiches existantes\n');
    queue = buildExpandQueue(dbInit);
    if (MODE_DEEP) {
      const deepExtra = buildDeepExtraNames(dbInit);
      for (const n of deepExtra) {
        if (!queue.includes(n)) queue.push(n);
      }
    }
    totalInList = queue.length;
    newToSearch = totalInList;
    alreadyTreated = 0;
    console.log(
      `📋 ${totalInList} fiche(s) à enrichir (mode expansion${MODE_DEEP ? ' + deep' : ''})`
    );
  } else {
    queue = [...SEED_INVENTIONS];
    totalInList = SEED_INVENTIONS.length;
    for (const inv of SEED_INVENTIONS) {
      if (alreadyExists(inv, existingNames, existingIds)) alreadyTreated++;
    }
    newToSearch = totalInList - alreadyTreated;
    console.log(
      `📋 ${totalInList} dans la file → ${alreadyTreated} déjà traitées, ${newToSearch} nouvelles à rechercher`
    );
  }

  const roughBatches = Math.max(1, Math.ceil(newToSearch / CONCURRENCY));
  const roughSec = roughBatches * (PAUSE_BETWEEN_BATCHES_MS / 1000 + 5);
  const roughMin = Math.max(1, Math.round(roughSec / 60));
  console.log(
    `⚡ Estimation : ~${roughMin}-${roughMin + 1} min (ordre de grandeur)\n`
  );

  const processed = new Set();
  const retryCount = new Map();

  const allowUpdate = MODE_EXPAND || MODE_DEEP || MODE_TEST;

  let addedCount = 0;
  let updatedCount = 0;
  let errorCount = 0;
  let linksCreatedCount = 0;
  let skippedCount = 0;
  let dependenciesIgnoredCount = 0;
  let retrySuccessCount = 0;
  let batchIndex = 0;
  let imagesCount = 0;
  const pendingImagePromises = [];

  let pauseBetweenBatches = PAUSE_BETWEEN_BATCHES_MS;

  startTime = Date.now();

  const totalBatchesEstimated =
    Math.max(1, Math.ceil(newToSearch / CONCURRENCY)) || 1;

  while (queue.length > 0) {
    const batch = [];
    while (batch.length < CONCURRENCY && queue.length > 0) {
      const name = queue.shift();
      if (!name) continue;

      if (!skipExistingCheck && alreadyExists(name, existingNames, existingIds)) {
        skippedCount++;
        continue;
      }

      const key = normalizeInventionName(name);
      if (processed.has(key)) {
        skippedCount++;
        continue;
      }

      processed.add(key);
      batch.push(name);
    }

    if (batch.length === 0) continue;

    batchIndex++;

    const snapshot = readDB();
    const existingNodes = snapshot.nodes;

    console.log(`\n⚡ Lot ${batchIndex} (${batch.length}) : ${batch.join(', ')}`);

    const results = await processBatch(batch, existingNodes);

    let batchRateLimited = false;
    const batchImageJobs = [];

    for (const result of results) {
      if (result.ok) {
        const prevRetries = retryCount.get(result.name) || 0;
        const {
          added,
          updated,
          newDependencies,
          linksCreated,
          nodeId,
          wikipediaUrl,
        } = addInventionToDB(result.enriched, { allowUpdate });
        if (added) {
          addedCount++;
          if (prevRetries > 0) retrySuccessCount++;
          retryCount.delete(result.name);
          linksCreatedCount += linksCreated;
          const catLog = normalizeCategory(result.enriched.category);
          const typLog = normalizeTechNodeType(result.enriched.type);
          console.log(
            `   ✅ ${result.enriched.name} (${typLog} | ${catLog})`
          );
          if (nodeId && wikipediaUrl && String(wikipediaUrl).trim()) {
            batchImageJobs.push({
              nodeId,
              wikipediaUrl: String(wikipediaUrl).trim(),
              name: result.enriched.name,
            });
          }
          if (!MODE_TEST) {
            for (const dep of newDependencies) {
              const dk = normalizeInventionName(dep);
              if (processed.has(dk)) continue;
              if (
                !skipExistingCheck &&
                alreadyExists(dep, existingNames, existingIds)
              ) {
                continue;
              }
              if (isLikelyFundamental(dep)) {
                if (MODE_NO_CASCADE) {
                  console.log(
                    `   📋 --no-cascade : dépendance non ajoutée à la file : "${dep}"`
                  );
                } else {
                  queue.push(dep);
                  console.log(`   📌 Nouvelle dépendance ajoutée : "${dep}"`);
                }
              } else {
                dependenciesIgnoredCount++;
                console.log(`   ⏭️  Ignoré (trop spécifique) : "${dep}"`);
              }
            }
          }
        } else if (updated) {
          updatedCount++;
          if (prevRetries > 0) retrySuccessCount++;
          retryCount.delete(result.name);
          linksCreatedCount += linksCreated;
          const cat = normalizeCategory(result.enriched.category);
          const typ = normalizeTechNodeType(result.enriched.type);
          console.log(
            `   🔄 ${result.enriched.name} (mise à jour — ${typ} | ${cat})`
          );
          if (nodeId && wikipediaUrl && String(wikipediaUrl).trim()) {
            batchImageJobs.push({
              nodeId,
              wikipediaUrl: String(wikipediaUrl).trim(),
              name: result.enriched.name,
            });
          }
          if (!MODE_TEST) {
            for (const dep of newDependencies) {
              const dk = normalizeInventionName(dep);
              if (processed.has(dk)) continue;
              if (
                !skipExistingCheck &&
                alreadyExists(dep, existingNames, existingIds)
              ) {
                continue;
              }
              if (isLikelyFundamental(dep)) {
                if (MODE_NO_CASCADE) {
                  console.log(
                    `   📋 --no-cascade : dépendance non ajoutée à la file : "${dep}"`
                  );
                } else {
                  queue.push(dep);
                  console.log(`   📌 Nouvelle dépendance ajoutée : "${dep}"`);
                }
              } else {
                dependenciesIgnoredCount++;
                console.log(`   ⏭️  Ignoré (trop spécifique) : "${dep}"`);
              }
            }
          }
        } else {
          console.log(
            `   ⏭️  "${result.enriched.name}" existe déjà (doublon dans le lot), on passe.`
          );
        }
      } else {
        const errMsg = result.error;
        const retries = retryCount.get(result.name) || 0;
        processed.delete(normalizeInventionName(result.name));

        if (retries < 2) {
          retryCount.set(result.name, retries + 1);
          queue.push(result.name);
          console.log(`   🔄 ${result.name} : retry ${retries + 1}/2 — ${errMsg}`);
        } else {
          errorCount++;
          console.log(`   ❌ ${result.name} : abandon après 2 retries — ${errMsg}`);
        }

        if (
          errMsg.includes('429') ||
          errMsg.toLowerCase().includes('rate') ||
          errMsg.toLowerCase().includes('rate_limit')
        ) {
          batchRateLimited = true;
        }
      }
    }

    await flushChanges(existingState, serviceSupabase);

    for (const job of batchImageJobs) {
      pendingImagePromises.push(
        fetchWikipediaImageUrl(job.wikipediaUrl).then(async (url) => {
          if (url) {
            await enqueuePatchNodeImage(job.nodeId, url);
            imagesCount++;
            console.log(`   🖼️  Image URL : ${job.name}`);
          }
        })
      );
    }

    const remaining = countQueueNeedingApi(
      queue,
      existingNames,
      existingIds,
      skipExistingCheck
    );
    const eta = estimateRemaining(remaining, batchIndex);
    console.log(
      `   ⚡ Lot ${batchIndex}/${totalBatchesEstimated} — ${addedCount} ajoutées — reste ${eta}`
    );

    if (batchRateLimited) {
      console.log('   ⏳ Rate limit détecté, pause de 10s...');
      await sleep(10000);
      pauseBetweenBatches = Math.min(pauseBetweenBatches + 2000, 30000);
    }

    if (queue.length > 0) {
      await sleep(pauseBetweenBatches);
    }
  }

  await Promise.allSettled(pendingImagePromises);
  await seedWriteChain;

  const reconciled = await reconcileLinks(serviceSupabase);
  linksCreatedCount += reconciled;

  const finalDB = readDB();
  const durationMs = Date.now() - scriptStart;
  const depthMax = maxGraphDepth(finalDB);
  const topRaw = topRawMaterials(finalDB, 5);

  console.log('\n' + '═'.repeat(46));
  console.log('📊 Résumé du peuplement');
  console.log(`Durée totale        : ${formatDuration(durationMs)}`);
  console.log(`Inventions ajoutées : ${addedCount}`);
  console.log(`Fiches mises à jour : ${updatedCount}`);
  console.log(`Images récupérées   : ${imagesCount}`);
  console.log(`Liens créés         : ${linksCreatedCount}`);
  console.log(`Liens réconciliés   : ${reconciled}`);
  console.log(`Skippées            : ${skippedCount}`);
  console.log(`Erreurs             : ${errorCount}`);
  console.log(`Retries réussis     : ${retrySuccessCount}`);
  console.log(
    `Total dans la base  : ${finalDB.nodes.length} nœuds, ${finalDB.links.length} liens`
  );
  console.log(`Profondeur max      : ${depthMax} couches`);
  console.log('Top matières premières (les plus connectées) :\n');
  for (const row of topRaw) {
    console.log(`   ${row.name} (→ ${row.count} technologies)`);
  }
  if (dependenciesIgnoredCount > 0) {
    console.log(
      `\nDépendances ignorées (trop spécifiques) : ${dependenciesIgnoredCount}`
    );
  }
  console.log('═'.repeat(46));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

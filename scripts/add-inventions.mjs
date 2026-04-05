#!/usr/bin/env node
/**
 * Ajoute de nouvelles inventions (Haiku, sans web search).
 * Mode --smart : analyse seed-data.json (orphelins, catégories/ères, sauts de profondeur)
 * puis stratégie + 1 appel découverte + création par lots de 5.
 * Toutes les fiches créées ont is_draft: true (validation manuelle avant publication).
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import {
  readDB,
  writeDB,
  slugify,
  sleep,
  cleanDescription,
  normalizeYearApprox,
  normalizeCategory,
  normalizeEra,
  normalizeOriginNatureTypes,
  normalizeDimensionMaterialLevel,
  uniqueLinkId,
  idToPrettyName,
} from './seed-helpers.mjs';
import {
  createServiceSupabaseClient,
  upsertNodes,
  upsertLinks,
  updateNodeImageUrl,
  fetchExistingNodeIdentity,
} from './supabase-seed-sync.mjs';
import { fetchWikipediaImageUrl } from './wikimedia-fetch.mjs';
import { confirm, hasYesFlag } from './cli-confirm.mjs';
import { CRAFTREE_SCOPE_FOR_LLM_FR } from './craftree-prompt-scope.mjs';

config({ path: '.env.local' });
config({ path: '.env' });

const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 5;
const MAX_TOKENS = 8000;
const PAUSE_MS = 2000;

/** Aligné sur les prompts / seed (liste plate). */
const ALLOWED_CATEGORIES = new Set([
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
  'animal',
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

const ALLOWED_ERAS = new Set([
  'prehistoric',
  'ancient',
  'medieval',
  'renaissance',
  'industrial',
  'modern',
  'digital',
  'contemporary',
]);

/**
 * Fusionne le seed local avec l’identité distante (ids + noms name / name_en).
 * @param {ReturnType<typeof readDB>} db
 * @param {{ ids: Set<string>, namesLower: Set<string> }} remote
 */
function buildMergedIdentity(db, remote) {
  const nodeIds = new Set(db.nodes.map((n) => n.id));
  const nameLower = new Set();
  for (const n of db.nodes) {
    nameLower.add(n.name.toLowerCase());
    if (n.name_en?.trim()) {
      nameLower.add(String(n.name_en).trim().toLowerCase());
    }
  }
  for (const id of remote.ids) nodeIds.add(id);
  for (const name of remote.namesLower) nameLower.add(name);
  return { nodeIds, nameLower };
}

function splitCommaList(raw) {
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs() {
  const argv = process.argv.slice(2).filter((a) => a !== '--yes' && a !== '-y');
  let count = null;
  let smart = false;
  /** @type {string[] | null} */
  let categoryFilter = null;
  /** @type {string[] | null} */
  let eraFilter = null;
  let afterYear = null;
  let beforeYear = null;
  let nameArg = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--smart') {
      smart = true;
    } else if (a === '--count' && argv[i + 1]) {
      count = parseInt(argv[++i], 10);
    } else if (a === '--limit' && argv[i + 1]) {
      count = parseInt(argv[++i], 10);
    } else if (a === '--name' && argv[i + 1]) {
      nameArg = argv[++i];
    } else if (a === '--category' && argv[i + 1]) {
      categoryFilter = splitCommaList(argv[++i]);
    } else if (a.startsWith('--category=')) {
      const v = a.slice('--category='.length).trim();
      if (v) categoryFilter = splitCommaList(v);
    } else if (
      a.startsWith('--category') &&
      a.length > '--category'.length &&
      !a.startsWith('--category=')
    ) {
      const v = a.slice('--category'.length).trim();
      if (v) categoryFilter = splitCommaList(v);
    } else if (a === '--era' && argv[i + 1]) {
      eraFilter = splitCommaList(argv[++i]);
    } else if (a.startsWith('--era=')) {
      const v = a.slice('--era='.length).trim();
      if (v) eraFilter = splitCommaList(v);
    } else if (
      a.startsWith('--era') &&
      a.length > '--era'.length &&
      !a.startsWith('--era=')
    ) {
      const v = a.slice('--era'.length).trim();
      if (v) eraFilter = splitCommaList(v);
    } else if (a === '--after' && argv[i + 1]) {
      afterYear = parseInt(argv[++i], 10);
    } else if (a.startsWith('--after=')) {
      afterYear = parseInt(a.slice('--after='.length).trim(), 10);
    } else if (a === '--before' && argv[i + 1]) {
      beforeYear = parseInt(argv[++i], 10);
    } else if (a.startsWith('--before=')) {
      beforeYear = parseInt(a.slice('--before='.length).trim(), 10);
    }
  }

  // Sans « npm run add -- … », npm peut transmettre "- - N" ou "- - count N" au lieu de "--count N".
  if (
    count == null &&
    nameArg == null &&
    argv.length >= 3 &&
    argv[0] === '-' &&
    argv[1] === '-'
  ) {
    const nDirect = parseInt(argv[2], 10);
    if (Number.isFinite(nDirect) && nDirect >= 1) {
      count = nDirect;
    } else if (
      argv.length >= 4 &&
      argv[2] === 'count' &&
      Number.isFinite(parseInt(argv[3], 10)) &&
      parseInt(argv[3], 10) >= 1
    ) {
      count = parseInt(argv[3], 10);
    }
  }

  return {
    count,
    smart,
    categoryFilter,
    eraFilter,
    afterYear,
    beforeYear,
    nameArg,
  };
}

function validateSuggestFilters({
  categoryFilter,
  eraFilter,
  afterYear,
  beforeYear,
}) {
  if (categoryFilter?.length) {
    for (const c of categoryFilter) {
      if (!ALLOWED_CATEGORIES.has(c)) {
        console.error(
          `❌ Catégorie invalide : "${c}". Valeurs autorisées : ${[...ALLOWED_CATEGORIES].sort().join(', ')}`
        );
        process.exit(1);
      }
    }
  }
  if (eraFilter?.length) {
    for (const e of eraFilter) {
      if (!ALLOWED_ERAS.has(e)) {
        console.error(
          `❌ Époque invalide : "${e}". Valeurs autorisées : ${[...ALLOWED_ERAS].join(', ')}`
        );
        process.exit(1);
      }
    }
  }
  if (afterYear != null && !Number.isFinite(afterYear)) {
    console.error('❌ --after doit être un nombre valide.');
    process.exit(1);
  }
  if (beforeYear != null && !Number.isFinite(beforeYear)) {
    console.error('❌ --before doit être un nombre valide.');
    process.exit(1);
  }
  if (
    afterYear != null &&
    beforeYear != null &&
    afterYear >= beforeYear
  ) {
    console.error(
      `❌ --after (${afterYear}) doit être strictement inférieur à --before (${beforeYear}).`
    );
    process.exit(1);
  }
}

function findOrphanIds(db) {
  const ids = new Set(db.nodes.map((n) => n.id));
  const orphans = new Set();
  for (const l of db.links) {
    if (!ids.has(l.source_id)) orphans.add(l.source_id);
    if (!ids.has(l.target_id)) orphans.add(l.target_id);
  }
  return [...orphans];
}

/** Mode --smart : catégories / ères « sous-représentées » si effectif strictement inférieur à ce seuil. */
const UNDERREP_THRESHOLD = 50;

/**
 * Compte les références par id (liens + champs enrichis _ai_*).
 * @param {{ nodes: object[], links: object[] }} db
 */
function collectReferenceCounts(db) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  const bump = (id) => {
    if (!id || typeof id !== 'string') return;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  };
  for (const l of db.links) {
    bump(l.source_id);
    bump(l.target_id);
  }
  for (const n of db.nodes) {
    for (const key of ['_ai_built_upon', '_ai_led_to']) {
      const arr = n[key];
      if (!Array.isArray(arr)) continue;
      for (const e of arr) {
        if (e && typeof e.id === 'string') bump(e.id);
      }
    }
  }
  return counts;
}

/**
 * @param {ReturnType<typeof readDB>} db
 */
function analyzeGraph(db) {
  const nodeIds = new Set(db.nodes.map((n) => n.id));
  const nodeById = new Map(db.nodes.map((n) => [n.id, n]));
  const refCounts = collectReferenceCounts(db);

  /** @type {{ id: string; refs: number; pretty: string }[]} */
  const orphanList = [];
  for (const [id, refs] of refCounts) {
    if (nodeIds.has(id)) continue;
    orphanList.push({
      id,
      refs,
      pretty: idToPrettyName(id),
    });
  }
  orphanList.sort((a, b) => b.refs - a.refs);

  /** @type {Record<string, number>} */
  const categoryCounts = {};
  /** @type {Record<string, number>} */
  const eraCounts = {};
  for (const c of ALLOWED_CATEGORIES) categoryCounts[c] = 0;
  for (const e of ALLOWED_ERAS) eraCounts[e] = 0;
  for (const n of db.nodes) {
    if (n.category && ALLOWED_CATEGORIES.has(n.category)) {
      categoryCounts[n.category] = (categoryCounts[n.category] ?? 0) + 1;
    }
    if (n.era && ALLOWED_ERAS.has(n.era)) {
      eraCounts[n.era] = (eraCounts[n.era] ?? 0) + 1;
    }
  }

  const underrepresentedCategories = [...ALLOWED_CATEGORIES]
    .filter((c) => (categoryCounts[c] ?? 0) < UNDERREP_THRESHOLD)
    .sort((a, b) => (categoryCounts[a] ?? 0) - (categoryCounts[b] ?? 0));

  const underrepresentedEras = [...ALLOWED_ERAS]
    .filter((e) => (eraCounts[e] ?? 0) < UNDERREP_THRESHOLD)
    .sort((a, b) => (eraCounts[a] ?? 0) - (eraCounts[b] ?? 0));

  /** Degré = nombre de liens (source ou target). */
  const degree = new Map();
  for (const n of db.nodes) degree.set(n.id, 0);
  for (const l of db.links) {
    degree.set(l.source_id, (degree.get(l.source_id) ?? 0) + 1);
    degree.set(l.target_id, (degree.get(l.target_id) ?? 0) + 1);
  }
  const isolatedIds = db.nodes
    .filter((n) => (degree.get(n.id) ?? 0) <= 1)
    .map((n) => n.id);

  /** @type {{ source: string; target: string; sourceId: string; targetId: string; ds: number; dt: number; diff: number }[]} */
  const depthGaps = [];
  for (const l of db.links) {
    const s = nodeById.get(l.source_id);
    const t = nodeById.get(l.target_id);
    if (!s || !t) continue;
    const ds = Number(s.complexity_depth ?? 0);
    const dt = Number(t.complexity_depth ?? 0);
    const diff = Math.abs(dt - ds);
    if (diff > 5) {
      depthGaps.push({
        source: s.name,
        target: t.name,
        sourceId: l.source_id,
        targetId: l.target_id,
        ds,
        dt,
        diff,
      });
    }
  }
  depthGaps.sort((a, b) => b.diff - a.diff);

  return {
    totalNodes: db.nodes.length,
    totalLinks: db.links.length,
    orphanList,
    categoryCounts,
    eraCounts,
    underrepresentedCategories,
    underrepresentedEras,
    isolatedCount: isolatedIds.length,
    depthGaps,
  };
}

/**
 * @param {number} count
 * @param {ReturnType<typeof analyzeGraph>} diag
 * @param {string[] | null} categoryForce
 */
function allocateSmartSlots(count, diag, categoryForce) {
  const { orphanList, depthGaps, underrepresentedCategories, underrepresentedEras } =
    diag;
  const orphansAvail = orphanList.length;

  let nOrphans = 0;
  if (orphansAvail >= count * 0.3) {
    nOrphans = Math.min(
      orphansAvail,
      Math.floor(count * 0.5),
      Math.ceil(count * 0.45)
    );
  } else if (orphansAvail > 0) {
    nOrphans = Math.min(orphansAvail, Math.max(1, Math.round(count * 0.18)));
  }
  nOrphans = Math.min(nOrphans, orphansAvail, count);

  let rem = count - nOrphans;
  const skew =
    underrepresentedCategories.length + underrepresentedEras.length;
  let wCat = 0.34;
  let wEra = 0.34;
  let wBridge = 0.32;
  if (skew > 10) {
    wCat = 0.38;
    wEra = 0.38;
    wBridge = 0.24;
  }
  if (orphansAvail >= count * 0.5 && skew < 6) {
    wCat = 0.28;
    wEra = 0.28;
    wBridge = 0.24;
  }
  if (depthGaps.length === 0) {
    const s = wCat + wEra;
    wCat = wCat / s;
    wEra = wEra / s;
    wBridge = 0;
  }

  let nCat = Math.round(rem * wCat);
  let nEra = Math.round(rem * wEra);
  let nBridge = rem - nCat - nEra;
  if (nBridge < 0) {
    nBridge = 0;
    nCat = Math.max(0, Math.floor(rem / 2));
    nEra = rem - nCat;
  }

  if (categoryForce?.length) {
    nCat = Math.ceil(rem * 0.55);
    nEra = Math.floor(rem * 0.25);
    nBridge = rem - nCat - nEra;
    if (nBridge < 0) {
      nBridge = 0;
      nEra = rem - nCat;
    }
  }

  let sum = nOrphans + nCat + nEra + nBridge;
  while (sum < count) {
    if (depthGaps.length > 0) nBridge++;
    else nCat++;
    sum++;
  }
  while (sum > count) {
    if (nBridge > 0) nBridge--;
    else if (nCat > 0) nCat--;
    else if (nEra > 0) nEra--;
    else if (nOrphans > 0) nOrphans--;
    sum--;
  }

  return { nOrphans, nCat, nEra, nBridge };
}

/**
 * @param {ReturnType<typeof readDB>} db
 */
function snapshotGraphStats(db) {
  /** @type {Record<string, number>} */
  const cat = {};
  /** @type {Record<string, number>} */
  const era = {};
  for (const n of db.nodes) {
    cat[n.category] = (cat[n.category] ?? 0) + 1;
    era[n.era] = (era[n.era] ?? 0) + 1;
  }
  let minCat = null;
  let minCatN = Infinity;
  for (const c of ALLOWED_CATEGORIES) {
    const v = cat[c] ?? 0;
    if (v < minCatN) {
      minCatN = v;
      minCat = c;
    }
  }
  let minEra = null;
  let minEraN = Infinity;
  for (const e of ALLOWED_ERAS) {
    const v = era[e] ?? 0;
    if (v < minEraN) {
      minEraN = v;
      minEra = e;
    }
  }
  return {
    nodes: db.nodes.length,
    links: db.links.length,
    cat,
    era,
    minCat,
    minCatN,
    minEra,
    minEraN,
  };
}

function printSmartDiagnostic(diag, slots, count) {
  const topOrphans = diag.orphanList.slice(0, 5);
  const topCat = diag.underrepresentedCategories
    .slice(0, 8)
    .map((c) => `${c}: ${diag.categoryCounts[c] ?? 0}`)
    .join(' | ');
  const topEra = diag.underrepresentedEras
    .slice(0, 8)
    .map((e) => `${e}: ${diag.eraCounts[e] ?? 0}`)
    .join(' | ');
  const topGaps = diag.depthGaps.slice(0, 3);

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       ANALYSE INTELLIGENTE DU GRAPHE    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(
    `📊 État actuel : ${diag.totalNodes} inventions, ${diag.totalLinks} liens`
  );
  console.log('');
  console.log('🔍 Diagnostic :');
  console.log(
    `  Orphelins (référencés mais sans fiche) : ${diag.orphanList.length}`
  );
  if (topOrphans.length) {
    console.log(
      `    Top 5 : ${topOrphans
        .map((o) => `${o.pretty} (${o.refs} refs)`)
        .join(', ')}…`
    );
  }
  console.log('');
  console.log(
    `  Catégories sous-représentées (< ${UNDERREP_THRESHOLD} cartes) :`
  );
  console.log(`    ${topCat || '(aucune)'}`);
  console.log('');
  console.log(
    `  Époques sous-représentées (< ${UNDERREP_THRESHOLD} cartes) :`
  );
  console.log(`    ${topEra || '(aucune)'}`);
  console.log('');
  console.log(
    `  Cartes isolées (0-1 liens) : ${diag.isolatedCount}`
  );
  console.log('');
  console.log(
    `  Sauts de profondeur (> 5 niveaux) : ${diag.depthGaps.length}`
  );
  for (const g of topGaps) {
    const low = g.ds < g.dt ? g.source : g.target;
    const high = g.ds < g.dt ? g.target : g.source;
    const dLow = Math.min(g.ds, g.dt);
    const dHigh = Math.max(g.ds, g.dt);
    const missing = Math.max(0, g.diff - 1);
    console.log(
      `    Ex: ${low} (depth ${dLow}) → ${high} (depth ${dHigh}) — manque ~${missing} étapes`
    );
  }
  console.log('');
  console.log(`🧠 Stratégie proposée pour ${count} inventions :`);
  console.log(`  - ${slots.nOrphans} orphelins prioritaires (les plus référencés)`);
  console.log(
    `  - ${slots.nCat} inventions dans catégories sous-représentées (ou forcées)`
  );
  console.log(`  - ${slots.nEra} inventions dans époques sous-représentées`);
  console.log(`  - ${slots.nBridge} inventions pour combler les sauts de profondeur`);
  console.log('');
}

/**
 * @param {object} p
 */
function buildSmartDiscoverPrompt({
  totalNodes,
  underrepresentedCategories,
  underrepresentedEras,
  depthGaps,
  existingNames,
  countToDiscover,
  categorySuggestionCount,
  eraSuggestionCount,
  bridgeSuggestionCount,
  categoryForced,
}) {
  const gapLines = depthGaps
    .slice(0, 15)
    .map((g) => `- entre ${g.source} et ${g.target}`);
  const catLine = categoryForced?.length
    ? categoryForced.join(', ')
    : underrepresentedCategories.join(', ');
  const eraLine = underrepresentedEras.join(', ');
  const gapsStr = depthGaps
    .slice(0, 12)
    .map((g) => `${g.source} → ${g.target}`)
    .join(', ');

  return `Tu es un agent de découverte pour Craftree, un arbre technologique des inventions humaines.

${CRAFTREE_SCOPE_FOR_LLM_FR}

Voici l'état du graphe :
- ${totalNodes} inventions existantes
- Catégories sous-représentées : ${catLine || '(équilibré)'}
- Époques sous-représentées : ${eraLine || '(équilibré)'}
- Sauts de profondeur à combler : ${gapsStr || '(aucun)'}

Inventions existantes : ${existingNames}

Suggère ${countToDiscover} inventions FONDAMENTALES qui :
1. Comblent les catégories sous-représentées (${categorySuggestionCount} inventions)
2. Comblent les époques sous-représentées (${eraSuggestionCount} inventions)
3. Créent des ponts entre les inventions existantes qui ont des sauts de profondeur (${bridgeSuggestionCount} inventions)

Pour les ponts, suggère des inventions INTERMÉDIAIRES entre :
${gapLines.length ? gapLines.join('\n') : '- (aucun gap majeur — propose des inventions de liaison pertinentes)'}

Réponds uniquement avec un JSON array de noms en français.`;
}

/**
 * @param {object} filters
 * @param {string[] | null} filters.categoryFilter
 * @param {string[] | null} filters.eraFilter
 * @param {number | null} filters.afterYear
 * @param {number | null} filters.beforeYear
 */
function buildSuggestPrompt(existingNamesJoined, count, filters) {
  const { categoryFilter, eraFilter, afterYear, beforeYear } = filters;
  const lines = [];
  if (categoryFilter?.length) {
    lines.push(`Catégories ciblées : ${categoryFilter.join(', ')}`);
  }
  if (eraFilter?.length) {
    lines.push(`Époques ciblées : ${eraFilter.join(', ')}`);
  }
  if (afterYear != null) {
    lines.push(`Inventions apparues APRÈS ${afterYear}`);
  }
  if (beforeYear != null) {
    lines.push(`Inventions apparues AVANT ${beforeYear}`);
  }
  const filterBlock =
    lines.length > 0 ? `\n\n${lines.join('\n')}\n` : '\n';

  return `${CRAFTREE_SCOPE_FOR_LLM_FR}

Voici les inventions existantes dans Craftree : ${existingNamesJoined}

Suggère ${count} inventions fondamentales qui manquent et qui sont importantes pour compléter l'arbre technologique.${filterBlock}
Réponds uniquement avec un JSON array de noms : ["Dynamite", "Radar", ...]`;
}

function buildCreatePrompt(batch, existingNodes) {
  const existingList = existingNodes
    .map((n) => `${n.name} (${n.id})`)
    .join(', ');
  const lines = batch.map((b) =>
    b.preferredId
      ? `- ${b.name} (id attendu : ${b.preferredId})`
      : `- ${b.name}`
  );
  return `Tu es un agent de création pour Craftree, un arbre technologique des inventions humaines.

${CRAFTREE_SCOPE_FOR_LLM_FR}

Crée une fiche complète pour chaque invention ci-dessous.

## RÈGLES DE CLASSIFICATION

### DIMENSION (ce que c'est fondamentalement)
- "matter" : ce qui compose un objet (matières, substances, composants physiques)
- "process" : comment on transforme (procédés, techniques, méthodes)
- "tool" : avec quoi on transforme (outils, machines, usines, instruments)

### MATERIAL LEVEL (uniquement si dimension = "matter", sinon null)
Test : est-ce qu'on le MESURE (kg, litres) ou est-ce qu'on le COMPTE (unités) ?
- "raw" : extrait de la nature tel quel. Ex: minerai de fer, sable, pétrole brut, bois
- "processed" : nouvelle substance créée par transformation, on le mesure au poids. Ex: acier, silicium, plastique, farine
- "industrial" : même matériau mis en forme pour un usage spécifique. Ex: fil de cuivre, tôle d'acier, verre trempé
- "component" : pièce fonctionnelle autonome, on le compte en unités. Ex: batterie, processeur, moteur

### ORIGIN TYPE (d'où ça vient dans la nature — null si non applicable)
- "mineral" : provient du sol/roches/sous-sol. Non vivant. Ex: pierre, sable, minerais, pétrole, charbon
- "vegetal" : provient des plantes. Ex: bois, coton, caoutchouc naturel
- "animal" : provient des animaux. Ex: cuir, laine, soie

### NATURE TYPE (ce que c'est physiquement — null si non applicable)
- "element" : substance pure du tableau périodique. Ex: cuivre (Cu), fer (Fe), silicium (Si)
- "compose" : combinaison chimique avec formule. Ex: eau (H₂O), sel (NaCl)
- "materiau" : mélange/alliage défini par ses propriétés. Ex: acier, béton, verre, plastique

### CATEGORY (une seule valeur parmi) :
energy, construction, weapon, network, food, transport, software, infrastructure, textile, communication, agriculture, animal, robotics, chemistry, electronics, environment, automation, medical, optical, storage, aeronautics, space, industry, nanotechnology, biotechnology, security, home_automation

### ERA :
prehistoric (avant -3000), ancient (-3000 à 500), medieval (500 à 1500), renaissance (1500 à 1750), industrial (1750 à 1900), modern (1900 à 1970), digital (1970 à 2010), contemporary (2010+)

### DESCRIPTIONS
2-3 phrases concises en texte brut. Pas de HTML, pas de balises, pas de citations.

### TAGS
3-7 mots-clés en français utiles pour la recherche.

### ORIGIN
Inventeur principal et/ou pays. Format "Nom (Pays)" ou juste "Pays". Null si inconnu.

### YEAR_APPROX
Entier entre -10000 et 2030. Année approximative d'invention.

### BUILT_UPON / LED_TO
- built_upon : 2-6 intrants directs. Utilise UNIQUEMENT des IDs existants de la liste ci-dessous.
- led_to : 0-4 produits directs. Utilise UNIQUEMENT des IDs existants.
- relation_type pour chaque lien : material, tool, energy, knowledge, catalyst

Inventions existantes (utilise ces IDs) :
${existingList}

Inventions à créer :
${lines.join('\n')}

Réponds UNIQUEMENT avec un JSON array, rien d'autre. Chaque élément doit inclure au minimum : "name", "name_en", "dimension", "materialLevel", "origin_type", "nature_type", "category", "era", "year_approx", "origin", "description", "description_en", "wikipedia_url", "tags", "built_upon", "led_to". Utilise l'id attendu quand il est indiqué.`;
}

function parseJsonArray(text) {
  const m = text.match(/\[[\s\S]*\]/);
  if (!m) throw new Error('Pas de JSON array dans la réponse');
  return JSON.parse(m[0]);
}

async function callMessages(client, body) {
  try {
    return await client.messages.create(body);
  } catch (e) {
    const s = String(e?.message || e);
    if (s.includes('429') || s.toLowerCase().includes('rate')) {
      console.log('   ⏳ Rate limit — pause 10s…');
      await sleep(10000);
      return client.messages.create(body);
    }
    throw e;
  }
}

function nodeFromAiItem(item, preferredId) {
  const id =
    (preferredId && String(preferredId).trim()) ||
    (item.id && String(item.id).trim()) ||
    slugify(item.name);
  const { dimension, materialLevel } = normalizeDimensionMaterialLevel(item);
  const { origin_type, nature_type } = normalizeOriginNatureTypes(item);
  const built = Array.isArray(item.built_upon)
    ? JSON.parse(JSON.stringify(item.built_upon))
    : [];
  const led = Array.isArray(item.led_to)
    ? JSON.parse(JSON.stringify(item.led_to))
    : [];
  return {
    id,
    name: String(item.name || id).trim(),
    name_en: String(item.name_en || '').trim(),
    description: cleanDescription(item.description ?? ''),
    description_en: cleanDescription(item.description_en ?? ''),
    category: normalizeCategory(item.category ?? ''),
    era: normalizeEra(item.era ?? '') || 'contemporary',
    year_approx: normalizeYearApprox(item.year_approx),
    origin: item.origin ? String(item.origin).trim() || null : null,
    wikipedia_url: item.wikipedia_url
      ? String(item.wikipedia_url).trim()
      : null,
    tags: Array.isArray(item.tags) ? item.tags.map((t) => String(t).trim()) : [],
    complexity_depth: 0,
    dimension,
    materialLevel,
    origin_type,
    nature_type,
    image_url: null,
    /** Toujours brouillon : validation manuelle avant mise en ligne. */
    is_draft: true,
    _ai_built_upon: built,
    _ai_led_to: led,
  };
}

function linkKey(s, t) {
  return `${s}→${t}`;
}

function addLinksForNode(db, nodeId, item, idSet, pendingLinks, existingKeys) {
  const links = db.links;
  if (item.built_upon) {
    for (const input of item.built_upon) {
      const sid = input.id || slugify(input.name);
      if (!idSet.has(sid) || !idSet.has(nodeId)) continue;
      const k = linkKey(sid, nodeId);
      if (existingKeys.has(k)) continue;
      const link = {
        id: uniqueLinkId(links, pendingLinks),
        source_id: sid,
        target_id: nodeId,
        relation_type: input.relation_type || 'material',
        is_optional: false,
        notes: null,
      };
      pendingLinks.push(link);
      existingKeys.add(k);
    }
  }
  if (item.led_to) {
    for (const output of item.led_to) {
      const tid = output.id || slugify(output.name);
      if (!idSet.has(nodeId) || !idSet.has(tid)) continue;
      const k = linkKey(nodeId, tid);
      if (existingKeys.has(k)) continue;
      const link = {
        id: uniqueLinkId(links, pendingLinks),
        source_id: nodeId,
        target_id: tid,
        relation_type: output.relation_type || 'material',
        is_optional: false,
        notes: null,
      };
      pendingLinks.push(link);
      existingKeys.add(k);
    }
  }
}

function printAddSummary({
  nameArg,
  count,
  categoryFilter,
  eraFilter,
  afterYear,
  beforeYear,
  workList,
  needSuggest,
}) {
  const targetCount = nameArg ? workList.length : count;
  const suggestCalls = !nameArg && needSuggest > 0 ? 1 : 0;
  const createCalls = nameArg
    ? Math.ceil(workList.length / BATCH_SIZE)
    : Math.ceil(count / BATCH_SIZE);
  const totalClaude = suggestCalls + createCalls;
  const estUsd = (totalClaude * 0.01).toFixed(2);
  const pauseSec = (createCalls * PAUSE_MS) / 1000;
  const estMin = Math.max(
    1,
    Math.round((totalClaude * 30 + pauseSec) / 60)
  );

  const batchLine =
    suggestCalls > 0
      ? `📦 Lots de ${BATCH_SIZE} → ${totalClaude} appel(s) Claude (Haiku) (${suggestCalls} suggestion + ${createCalls} création)`
      : `📦 Lots de ${BATCH_SIZE} → ${totalClaude} appel(s) Claude (Haiku)`;

  const hasFilters =
    (categoryFilter?.length ?? 0) > 0 ||
    (eraFilter?.length ?? 0) > 0 ||
    afterYear != null ||
    beforeYear != null;

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║       AJOUT DE NOUVELLES INVENTIONS     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(
    '📝 Les fiches créées seront en brouillon (is_draft) jusqu’à validation.'
  );
  console.log('');
  console.log(`📋 Inventions à ajouter : ${targetCount}`);
  console.log(batchLine);
  console.log(`💰 Coût estimé : ~${estUsd}$`);
  console.log(`⏱️  Durée estimée : ~${estMin} min`);
  console.log(
    '🖼️  Images Wikimedia : récupération automatique après chaque lot'
  );
  if (nameArg) {
    console.log('');
    console.log('Inventions à créer :\n');
    for (const w of workList) {
      console.log(w.name);
    }
    console.log('');
  } else {
    console.log(`Mode : --count ${count} (découverte automatique)`);
  }
  console.log('');
  console.log('Filtres actifs :');
  if (!hasFilters) {
    console.log('  (aucun)');
  } else {
    if (categoryFilter?.length) {
      console.log(`  🏷️  Catégories : ${categoryFilter.join(', ')}`);
    }
    if (eraFilter?.length) {
      console.log(`  📅 Époque${eraFilter.length > 1 ? 's' : ''} : ${eraFilter.join(', ')}`);
    }
    if (afterYear != null) {
      console.log(`  📆 Après : ${afterYear}`);
    }
    if (beforeYear != null) {
      console.log(`  📆 Avant : ${beforeYear}`);
    }
  }
  console.log('');
}

/**
 * @param {import('@anthropic-ai/sdk').default} client
 * @param {unknown} supabase
 * @param {{ name: string, preferredId?: string, smartTag?: string }[]} workList
 * @param {{ nodeIds: Set<string>, nameLower: Set<string> }} mergedIdentity seed + Supabase
 */
async function runInventionBatches(client, supabase, workList, mergedIdentity) {
  let db = readDB();
  const nodeIds = new Set(mergedIdentity.nodeIds);
  const nameLower = new Set(mergedIdentity.nameLower);
  /** @type {Set<string>} */
  const createdIds = new Set();

  const batches = [];
  for (let i = 0; i < workList.length; i += BATCH_SIZE) {
    batches.push(workList.slice(i, i + BATCH_SIZE));
  }

  let totalLinks = 0;
  let imagesOk = 0;
  const t0 = Date.now();
  let batchNum = 0;

  for (const batch of batches) {
    batchNum++;
    console.log(
      `⚡ Lot ${batchNum}/${batches.length} : ${batch.map((b) => b.name).join(', ')}`
    );
    const existingNodes = db.nodes;
    const prompt = buildCreatePrompt(batch, existingNodes);

    let items;
    let attempt = 0;
    for (;;) {
      attempt++;
      try {
        const res = await callMessages(client, {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = res.content
          .filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('');
        items = parseJsonArray(text);
        break;
      } catch (e) {
        if (attempt >= 2) {
          console.error(`   ❌ Lot ignoré après 2 échecs : ${e.message}`);
          items = [];
          break;
        }
        console.log(`   🔄 Retry JSON / API (${e.message})`);
        await sleep(2000);
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      await sleep(PAUSE_MS);
      continue;
    }

    const prefBySlug = new Map(
      batch.map((b) => [slugify(b.name), b.preferredId])
    );
    const newNodes = [];
    const pendingLinks = [];
    const existingLinkKeys = new Set(
      db.links.map((l) => linkKey(l.source_id, l.target_id))
    );

    for (const item of items) {
      const sid = slugify(item.name || '');
      const pref = prefBySlug.get(sid);
      let node;
      try {
        node = nodeFromAiItem(item, pref);
      } catch (err) {
        console.error(`   ❌ ${item?.name || '?'} : ${err.message}`);
        continue;
      }
      if (nodeIds.has(node.id)) {
        console.log(`⏭️  ${node.name} : existe déjà (id)`);
        continue;
      }
      const nameLc = node.name.toLowerCase();
      if (nameLower.has(nameLc)) {
        console.log(`⏭️  ${node.name} : nom déjà en base`);
        continue;
      }
      const nameEnLc = node.name_en?.trim()
        ? String(node.name_en).trim().toLowerCase()
        : '';
      if (nameEnLc && nameLower.has(nameEnLc)) {
        console.log(`⏭️  ${node.name} : name_en déjà en base`);
        continue;
      }
      newNodes.push(node);
      nodeIds.add(node.id);
      nameLower.add(nameLc);
      if (nameEnLc) nameLower.add(nameEnLc);
    }

    for (const node of newNodes) {
      db.nodes.push(node);
      createdIds.add(node.id);
    }

    const addedIds = new Set(newNodes.map((n) => n.id));
    const idSet = new Set(db.nodes.map((n) => n.id));
    for (const item of items) {
      const sid = slugify(item.name || '');
      const pref = prefBySlug.get(sid);
      const nodeId =
        (item.id && String(item.id).trim()) ||
        pref ||
        slugify(item.name);
      if (!addedIds.has(nodeId)) continue;
      addLinksForNode(db, nodeId, item, idSet, pendingLinks, existingLinkKeys);
    }

    for (const l of pendingLinks) {
      db.links.push(l);
    }
    totalLinks += pendingLinks.length;

    writeDB(db);

    if (newNodes.length) {
      await upsertNodes(supabase, newNodes);
    }
    if (pendingLinks.length) {
      await upsertLinks(supabase, pendingLinks);
    }

    for (const node of newNodes) {
      const item = items.find(
        (it) =>
          slugify(it.name || '') === slugify(node.name) ||
          (it.id && it.id === node.id)
      );
      const lc = item
        ? (item.built_upon?.length || 0) + (item.led_to?.length || 0)
        : 0;
      const created = pendingLinks.filter(
        (l) => l.source_id === node.id || l.target_id === node.id
      ).length;
      console.log(
        `   ✅ ${node.name} (${node.dimension} | ${node.category}) — ${created} lien(s) créés (${lc} dans la réponse)`
      );
      let img = null;
      if (node.wikipedia_url?.trim()) {
        img = await fetchWikipediaImageUrl(String(node.wikipedia_url).trim());
      }
      if (img) {
        node.image_url = img;
        await updateNodeImageUrl(supabase, node.id, img);
        writeDB(db);
        imagesOk++;
        console.log(`   🖼️  Image : ${node.name}`);
      }
    }

    await sleep(PAUSE_MS);
    db = readDB();
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  return { totalLinks, imagesOk, createdIds, sec, workListLength: workList.length };
}

/**
 * @param {import('@anthropic-ai/sdk').default} client
 * @param {{ nodeIds: Set<string>, nameLower: Set<string> }} mergedIdentity
 */
async function buildSmartWorkList(
  client,
  db,
  diag,
  slots,
  categoryFilter,
  count,
  mergedIdentity
) {
  const nodeIds = new Set(mergedIdentity.nodeIds);
  const nameLower = new Set(mergedIdentity.nameLower);
  /** @type {{ name: string, preferredId?: string, smartTag?: string }[]} */
  const workList = [];

  for (let i = 0; i < slots.nOrphans && workList.length < count; i++) {
    const o = diag.orphanList[i];
    if (!o) break;
    if (nodeIds.has(o.id)) continue;
    if (nameLower.has(o.pretty.toLowerCase())) continue;
    workList.push({ name: o.pretty, preferredId: o.id, smartTag: 'orphan' });
    nodeIds.add(o.id);
    nameLower.add(o.pretty.toLowerCase());
  }

  const needDiscover = count - workList.length;
  if (needDiscover <= 0) return workList;

  const origSum = slots.nCat + slots.nEra + slots.nBridge;
  let nCat = slots.nCat;
  let nEra = slots.nEra;
  let nBridge = slots.nBridge;
  if (origSum > 0 && needDiscover !== origSum) {
    const s = needDiscover / origSum;
    nCat = Math.max(0, Math.round(slots.nCat * s));
    nEra = Math.max(0, Math.round(slots.nEra * s));
    nBridge = needDiscover - nCat - nEra;
    if (nBridge < 0) {
      nBridge = 0;
      nEra = Math.max(0, needDiscover - nCat);
    }
  }

  const catCats = categoryFilter?.length
    ? categoryFilter
    : diag.underrepresentedCategories;
  const catEras = diag.underrepresentedEras;
  const allNames = db.nodes.map((n) => n.name).join(', ');
  const joined =
    allNames.length > 120_000 ? allNames.slice(0, 120_000) + '…' : allNames;

  const prompt = buildSmartDiscoverPrompt({
    totalNodes: diag.totalNodes,
    underrepresentedCategories: catCats,
    underrepresentedEras: catEras,
    depthGaps: diag.depthGaps,
    existingNames: joined,
    countToDiscover: needDiscover,
    categorySuggestionCount: nCat,
    eraSuggestionCount: nEra,
    bridgeSuggestionCount: nBridge,
    categoryForced: categoryFilter ?? null,
  });

  console.log(
    `\n📡 Découverte intelligente (${needDiscover} noms) — 1 appel Claude…`
  );
  const res = await callMessages(client, {
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  let suggested = [];
  try {
    suggested = parseJsonArray(text);
  } catch (e) {
    console.error('❌ JSON découverte invalide :', e.message);
    process.exit(1);
  }
  if (!Array.isArray(suggested)) {
    console.error('❌ La découverte doit être un tableau.');
    process.exit(1);
  }

  let discoverIdx = 0;
  for (const raw of suggested) {
    if (workList.length >= count) break;
    const name = typeof raw === 'string' ? raw : raw?.name || String(raw);
    const id = slugify(name);
    if (nodeIds.has(id) || nameLower.has(name.toLowerCase())) continue;
    let tag = 'bridge';
    if (discoverIdx < nCat) tag = 'category';
    else if (discoverIdx < nCat + nEra) tag = 'era';
    discoverIdx++;
    workList.push({ name, preferredId: id, smartTag: tag });
    nodeIds.add(id);
    nameLower.add(name.toLowerCase());
  }

  return workList;
}

function printSmartFinalSummary(
  before,
  after,
  workList,
  createdIds,
  totalLinks,
  imagesOk,
  sec
) {
  const orphanNames = [];
  const catNames = [];
  const eraNames = [];
  const bridgeNames = [];
  for (const w of workList) {
    const id = w.preferredId || slugify(w.name);
    if (!createdIds.has(id)) continue;
    if (w.smartTag === 'orphan') orphanNames.push(w.name);
    else if (w.smartTag === 'category') catNames.push(w.name);
    else if (w.smartTag === 'era') eraNames.push(w.name);
    else if (w.smartTag === 'bridge') bridgeNames.push(w.name);
  }

  const nAdded = createdIds.size;
  console.log('');
  console.log('📊 Résumé intelligent :');
  console.log(`  Inventions ajoutées : ${nAdded}`);
  if (orphanNames.length) {
    console.log(
      `    - ${orphanNames.length} orphelins comblés (${orphanNames.slice(0, 8).join(', ')}${orphanNames.length > 8 ? '…' : ''})`
    );
  }
  if (catNames.length) {
    console.log(
      `    - ${catNames.length} orientées catégories sous-représentées (${catNames.slice(0, 6).join(', ')}${catNames.length > 6 ? '…' : ''})`
    );
  }
  if (eraNames.length) {
    console.log(
      `    - ${eraNames.length} orientées époques sous-représentées (${eraNames.slice(0, 6).join(', ')}${eraNames.length > 6 ? '…' : ''})`
    );
  }
  if (bridgeNames.length) {
    console.log(
      `    - ${bridgeNames.length} ponts / intermédiaires (${bridgeNames.slice(0, 6).join(', ')}${bridgeNames.length > 6 ? '…' : ''})`
    );
  }
  console.log('');
  console.log(`  Liens créés : ${totalLinks}`);
  console.log(`  Images récupérées : ${imagesOk}`);
  console.log(
    `  Statut : brouillon (is_draft) — valider dans l’éditeur ou l’explore`
  );
  console.log('');
  console.log(
    `  Nouvel état : ${after.nodes} inventions, ${after.links} liens`
  );
  console.log(
    `  Catégorie la moins représentée : ${after.minCat} (${after.minCatN})`
  );
  console.log(
    `  Époque la moins représentée : ${after.minEra} (${after.minEraN})`
  );
  console.log('');
  console.log(`  Durée : ${sec}s`);
  console.log('═'.repeat(46));
}

async function runSmartMode({ count, categoryFilter, autoYes }) {
  let db = readDB();
  const before = snapshotGraphStats(db);
  const diag = analyzeGraph(db);
  const slots = allocateSmartSlots(count, diag, categoryFilter);

  printSmartDiagnostic(diag, slots, count);

  console.log(
    '📝 Les fiches créées seront en brouillon (is_draft) jusqu’à validation.'
  );
  console.log('');

  const discoverCalls =
    slots.nCat + slots.nEra + slots.nBridge > 0 ? 1 : 0;
  const createCalls = Math.ceil(count / BATCH_SIZE);
  const totalClaude = discoverCalls + createCalls;
  const estUsd = (totalClaude * 0.01).toFixed(2);
  console.log(
    `📦 1 appel découverte + ${createCalls} lot(s) création (${BATCH_SIZE}/lot) → ${totalClaude} appel(s) Claude (Haiku)`
  );
  console.log(`💰 Coût estimé : ~${estUsd}$`);
  console.log('');

  if (!autoYes) {
    const ok = await confirm('Continuer ?');
    if (!ok) {
      console.log('❌ Annulé.');
      process.exit(0);
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY manquant (.env.local)');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });
  const supabase = createServiceSupabaseClient();

  console.log('\n📡 Lecture des nœuds existants (Supabase)…');
  const remoteIdentity = await fetchExistingNodeIdentity(supabase);
  const mergedIdentity = buildMergedIdentity(db, remoteIdentity);
  console.log(
    `   ${remoteIdentity.ids.size} nœud(s) en base — fusion avec le seed pour détecter les doublons.`
  );

  const workList = await buildSmartWorkList(
    client,
    db,
    diag,
    slots,
    categoryFilter,
    count,
    mergedIdentity
  );

  if (workList.length === 0) {
    console.log('Aucune nouvelle invention à ajouter.');
    return;
  }

  const stats = await runInventionBatches(
    client,
    supabase,
    workList,
    mergedIdentity
  );
  db = readDB();
  const after = snapshotGraphStats(db);
  printSmartFinalSummary(
    before,
    after,
    workList,
    stats.createdIds,
    stats.totalLinks,
    stats.imagesOk,
    stats.sec
  );
}

async function main() {
  const {
    count,
    smart,
    categoryFilter,
    eraFilter,
    afterYear,
    beforeYear,
    nameArg,
  } = parseArgs();
  const autoYes = hasYesFlag();

  if (smart) {
    if (nameArg) {
      console.error(
        '❌ --smart ne se combine pas avec --name (noms explicites).'
      );
      process.exit(1);
    }
    if (eraFilter?.length || afterYear != null || beforeYear != null) {
      console.error(
        '❌ --smart ne se combine pas avec --era, --after ou --before.'
      );
      process.exit(1);
    }
    if (count == null || count < 1) {
      console.error(
        'Usage : node scripts/add-inventions.mjs --smart --count N\n' +
          '        node scripts/add-inventions.mjs --smart --limit N\n' +
          'Options : --category "x,y"  --yes'
      );
      process.exit(1);
    }
    validateSuggestFilters({ categoryFilter, eraFilter: null, afterYear: null, beforeYear: null });
    await runSmartMode({ count, categoryFilter, autoYes });
    return;
  }

  validateSuggestFilters({
    categoryFilter,
    eraFilter,
    afterYear,
    beforeYear,
  });

  if (!nameArg && (count == null || count < 1)) {
    console.error(
      'Usage : node scripts/add-inventions.mjs --count N [options] | --name "A,B,C"\n' +
        '        node scripts/add-inventions.mjs --smart --count N [--category "x"] [--yes]\n' +
        'Options (combinables) :\n' +
        '  --smart                       analyse du graphe + stratégie (avec --count ou --limit)\n' +
        '  --category "energy,medical"   catégories (liste séparée par des virgules)\n' +
        '  --era "industrial,modern"     époques\n' +
        '  --after YEAR                  année min (invention)\n' +
        '  --before YEAR                 année max (invention)'
    );
    console.error(
      'Avec npm, tout doit être sur une même ligne après -- :\n' +
        '  npm run add -- --count 5 --category infrastructure\n' +
        '  npm run add -- - - count 5 --category infrastructure'
    );
    process.exit(1);
  }

  const db = readDB();
  const supabase = createServiceSupabaseClient();
  console.log('\n📡 Lecture des nœuds existants (Supabase)…');
  const remoteIdentity = await fetchExistingNodeIdentity(supabase);
  const mergedIdentity = buildMergedIdentity(db, remoteIdentity);
  console.log(
    `   ${remoteIdentity.ids.size} nœud(s) en base — fusion avec le seed pour détecter les doublons.`
  );

  const nodeIds = mergedIdentity.nodeIds;
  const nameLower = mergedIdentity.nameLower;

  /** @type {{ name: string, preferredId?: string }[]} */
  let workList = [];
  /** Noms encore à obtenir via Claude (mode --count uniquement). */
  let needSuggest = 0;

  if (nameArg) {
    const parts = nameArg.split(',').map((s) => s.trim()).filter(Boolean);
    const seenInArg = new Set();
    for (const p of parts) {
      const id = slugify(p);
      if (seenInArg.has(id)) continue;
      if (nodeIds.has(id) || nameLower.has(p.toLowerCase())) {
        console.log(`⏭️  « ${p} » existe déjà, ignoré.`);
        continue;
      }
      seenInArg.add(id);
      workList.push({ name: p, preferredId: id });
    }
  } else {
    const orphans = findOrphanIds(db);
    const fromOrphans = [];
    for (const oid of orphans) {
      if (fromOrphans.length >= count) break;
      if (nodeIds.has(oid)) continue;
      const name = idToPrettyName(oid);
      if (nameLower.has(name.toLowerCase())) continue;
      fromOrphans.push({ name, preferredId: oid });
    }
    needSuggest = Math.max(0, count - fromOrphans.length);
    workList = fromOrphans.slice(0, count);
  }

  if (nameArg && workList.length === 0) {
    console.log('Aucune nouvelle invention à ajouter.');
    return;
  }

  printAddSummary({
    nameArg,
    count,
    categoryFilter,
    eraFilter,
    afterYear,
    beforeYear,
    workList,
    needSuggest,
  });

  if (!autoYes) {
    const ok = await confirm('Continuer ?');
    if (!ok) {
      console.log('❌ Annulé.');
      process.exit(0);
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY manquant (.env.local)');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });

  if (!nameArg && needSuggest > 0) {
    const need = needSuggest;
    const allNames = db.nodes.map((n) => n.name).join(', ');
    const joined =
      allNames.length > 120_000
        ? allNames.slice(0, 120_000) + '…'
        : allNames;
    const prompt = buildSuggestPrompt(joined, need, {
      categoryFilter,
      eraFilter,
      afterYear,
      beforeYear,
    });
    console.log(`\n📡 Suggestion Claude (${need} noms manquants)…`);
    const res = await callMessages(client, {
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    let suggested = [];
    try {
      suggested = parseJsonArray(text);
    } catch (e) {
      console.error('❌ JSON suggestion invalide :', e.message);
      process.exit(1);
    }
    if (!Array.isArray(suggested)) {
      console.error('❌ La suggestion doit être un tableau.');
      process.exit(1);
    }
    for (const raw of suggested) {
      if (workList.length >= count) break;
      const name = typeof raw === 'string' ? raw : raw?.name || String(raw);
      const id = slugify(name);
      if (nodeIds.has(id) || nameLower.has(name.toLowerCase())) continue;
      const alreadyQueued = workList.some(
        (w) =>
          (w.preferredId && w.preferredId === id) ||
          slugify(w.name) === id ||
          w.name.toLowerCase() === name.toLowerCase()
      );
      if (alreadyQueued) continue;
      workList.push({ name, preferredId: id });
    }
  }

  if (workList.length === 0) {
    console.log('Aucune nouvelle invention à ajouter.');
    return;
  }

  const stats = await runInventionBatches(
    client,
    supabase,
    workList,
    mergedIdentity
  );
  const estFinal = (stats.workListLength * 0.002).toFixed(2);
  console.log('\n' + '═'.repeat(46));
  console.log('📊 Résumé — add-inventions');
  console.log(`Inventions traitées   : ${stats.workListLength}`);
  console.log(`Liens ajoutés (lot)   : ${stats.totalLinks}`);
  console.log(`Images récupérées     : ${stats.imagesOk}`);
  console.log(
    `Statut                : brouillon (is_draft) — valider dans l’éditeur ou l’explore`
  );
  console.log(`Durée                 : ${stats.sec}s`);
  console.log(`Coût estimé           : ~${estFinal}$`);
  console.log('═'.repeat(46));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

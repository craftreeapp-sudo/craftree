#!/usr/bin/env node
/**
 * Complète les fiches existantes (Haiku, sans web search, sans écraser les champs remplis).
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import {
  readDB,
  writeDB,
  sleep,
  nodeNeedsEnrichment,
  formatNodeWithMissingFields,
  enrichItemToClaudePatch,
  mergeUpdatedNodeFields,
  countEnrichmentMissingByField,
} from './seed-helpers.mjs';
import { createServiceSupabaseClient, upsertNodes } from './supabase-seed-sync.mjs';
import { confirm, hasYesFlag } from './cli-confirm.mjs';
import { CRAFTREE_SCOPE_FOR_LLM_FR } from './craftree-prompt-scope.mjs';

config({ path: '.env.local' });
config({ path: '.env' });

const MODEL = 'claude-haiku-4-5-20251001';
const BATCH_SIZE = 10;
const MAX_TOKENS = 4000;
const PAUSE_MS = 1000;

/** Valeur prête pour Supabase : plage [-10000, 2030] ; < -10000 → -10000 ; > 2030 → null. */
function normalizeYearApprox(year) {
  if (year == null) return null;
  const n = typeof year === 'number' ? year : Number(year);
  if (!Number.isFinite(n)) return null;
  if (n < -10000) return -10000;
  if (n > 2030) return null;
  return Math.round(n);
}

function parseLimit() {
  const i = process.argv.indexOf('--limit');
  if (i === -1) return null;
  const raw = process.argv[i + 1];
  if (!raw || raw.startsWith('--')) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function buildEnrichPrompt(batch) {
  const blocks = batch.map((n) => formatNodeWithMissingFields(n)).join('\n\n---\n\n');
  return `Tu es un agent de classification pour Craftree.

${CRAFTREE_SCOPE_FOR_LLM_FR}

Pour chaque invention ci-dessous, remplis UNIQUEMENT les champs marqués comme "À REMPLIR". Ne touche pas aux champs déjà remplis.

## RÈGLES DE CLASSIFICATION

### DIMENSION
- "matter" : ce qui compose un objet (matières, substances, composants physiques)
- "process" : comment on transforme (procédés, techniques, méthodes)
- "tool" : avec quoi on transforme (outils, machines, usines, instruments)

### MATERIAL LEVEL (uniquement si dimension = "matter", sinon null)
- "raw" | "processed" | "industrial" | "component"

### ORIGIN TYPE (null si non applicable) : mineral, vegetal, animal

### NATURE TYPE (null si non applicable) : element, compose, materiau

### CATEGORY
energy, construction, weapon, network, food, transport, software, infrastructure, textile, communication, agriculture, animal, robotics, chemistry, electronics, environment, automation, medical, optical, storage, aeronautics, space, industry, nanotechnology, biotechnology, security, home_automation

### TYPE :
raw_material, material, process, tool, component (jamais end_product)

### ERA :
prehistoric, ancient, medieval, renaissance, industrial, modern, digital, contemporary

### DESCRIPTIONS
Texte brut, pas de HTML.

### TAGS
3-7 mots-clés en français.

### ORIGIN
"Nom (Pays)" ou "Pays". Null si inconnu.

### YEAR_APPROX
Entier entre -10000 et 2030.

Inventions à compléter :

${blocks}

Réponds UNIQUEMENT avec un JSON array, un objet par invention, avec uniquement les champs "id" et les champs qui étaient "À REMPLIR"
Exemple :
[
  { "id": "acier", "dimension": "matter", "materialLevel": "processed" }
]`;
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

function printEnrichSummary(incomplete, total) {
  const numBatches = Math.ceil(incomplete.length / BATCH_SIZE);
  // Haiku: ~$0.01 par appel API ; Sonnet serait ~$0.03 (non utilisé ici).
  const estUsd = (numBatches * 0.01).toFixed(2);
  const pauseSec = (numBatches * PAUSE_MS) / 1000;
  const estMin = Math.max(
    1,
    Math.round((numBatches * 25 + pauseSec) / 60)
  );

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║        ENRICHISSEMENT DES FICHES        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`📋 Fiches incomplètes : ${incomplete.length} sur ${total}`);
  console.log(
    `📦 Lots de ${BATCH_SIZE} → ${numBatches} appel(s) Claude (Haiku)`
  );
  console.log(`💰 Coût estimé : ~${estUsd}$`);
  console.log(`⏱️  Durée estimée : ~${estMin} min`);
  console.log(
    '🔒 Protection : les champs déjà remplis ne seront PAS écrasés'
  );
  console.log('Champs à compléter :\n');

  const counts = countEnrichmentMissingByField(incomplete);
  const entries = [...counts.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [field, c] of entries) {
    console.log(`${field} : ${c} fiche${c > 1 ? 's' : ''}`);
  }
  if (entries.length === 0) {
    console.log('(aucun détail par champ)');
  }
  console.log('');
}

async function main() {
  const limit = parseLimit();
  const autoYes = hasYesFlag();

  let db = readDB();
  const total = db.nodes.length;
  let incomplete = db.nodes.filter((n) => nodeNeedsEnrichment(n));
  if (limit != null) {
    incomplete = incomplete.slice(0, limit);
  }

  if (incomplete.length === 0) {
    console.log('Rien à faire.');
    return;
  }

  printEnrichSummary(incomplete, total);

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

  const batches = [];
  for (let i = 0; i < incomplete.length; i += BATCH_SIZE) {
    batches.push(incomplete.slice(i, i + BATCH_SIZE));
  }

  let updated = 0;
  let fieldsTotal = 0;
  const t0 = Date.now();
  let bi = 0;

  for (const batch of batches) {
    bi++;
    console.log(
      `\n⚡ Lot ${bi}/${batches.length} : ${batch.map((n) => n.name).join(', ')}`
    );
    const prompt = buildEnrichPrompt(batch);

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
          console.error(`   ❌ Lot ignoré : ${e.message}`);
          items = [];
          break;
        }
        await sleep(1000);
      }
    }

    if (!Array.isArray(items)) {
      await sleep(PAUSE_MS);
      continue;
    }

    const toUpsert = [];
    for (const item of items) {
      const id = item.id && String(item.id).trim();
      if (!id) continue;
      const node = db.nodes.find((n) => n.id === id);
      if (!node) {
        console.warn(`   ⚠️ id inconnu : ${id}`);
        continue;
      }
      const snap = { ...node };
      const itemNormalized = { ...item };
      if (Object.prototype.hasOwnProperty.call(itemNormalized, 'year_approx')) {
        itemNormalized.year_approx = normalizeYearApprox(itemNormalized.year_approx);
      }
      const claudePatch = enrichItemToClaudePatch(itemNormalized);
      const patch = mergeUpdatedNodeFields(node, claudePatch, false);
      const changed = [];
      for (const k of Object.keys(patch)) {
        if (JSON.stringify(snap[k]) !== JSON.stringify(patch[k])) {
          changed.push(k);
        }
      }
      if (changed.length === 0) {
        console.log(`   ⏭️ ${node.name} : rien à fusionner`);
        continue;
      }
      Object.assign(node, patch);
      fieldsTotal += changed.length;
      updated++;
      toUpsert.push(node);
      console.log(
        `   🔄 ${node.name} : ${changed.length} champ(s) complété(s) (${changed.join(', ')})`
      );
    }

    writeDB(db);
    if (toUpsert.length) {
      try {
        await upsertNodes(supabase, toUpsert);
      } catch (e) {
        const msg = e?.message ?? String(e);
        console.warn(`⚠️ Erreur Supabase pour ce lot : ${msg}`);
      }
    }
    await sleep(PAUSE_MS);
    db = readDB();
  }

  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n' + '═'.repeat(46));
  console.log('📊 Résumé — enrich-inventions');
  console.log(`Fiches mises à jour : ${updated}`);
  console.log(`Champs complétés (approx.) : ${fieldsTotal}`);
  console.log(`Durée                 : ${sec}s`);
  console.log('═'.repeat(46));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

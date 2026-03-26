/**
 * Traduit description (FR) → description_en (EN) via l’API Anthropic, sans web search.
 * Ne traite que les nœuds sans description_en ou avec description_en vide.
 *
 * Prérequis : .env.local avec ANTHROPIC_API_KEY
 * Usage : node scripts/translate-descriptions.mjs
 */
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const SEED_PATH = path.join(process.cwd(), 'src/data/seed-data.json');
const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const MODEL =
  process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';

if (!apiKey) {
  console.error(
    '❌ ANTHROPIC_API_KEY manquant. Créez .env.local (voir .env.example).'
  );
  process.exit(1);
}

const client = new Anthropic({ apiKey });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateFrToEn(text) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Traduis ce texte du français vers l'anglais. Retourne UNIQUEMENT la traduction, rien d'autre : ${text}`,
      },
    ],
  });
  const parts = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text);
  return parts.join('').trim();
}

function writeSeed(data) {
  fs.writeFileSync(SEED_PATH, `${JSON.stringify(data, null, 2)}\n`);
}

const raw = fs.readFileSync(SEED_PATH, 'utf-8');
const data = JSON.parse(raw);

if (!Array.isArray(data.nodes)) {
  console.error('❌ seed-data.json : nodes invalide');
  process.exit(1);
}

const toTranslate = data.nodes.filter((n) => {
  const fr = typeof n.description === 'string' ? n.description.trim() : '';
  if (!fr) return false;
  const en = typeof n.description_en === 'string' ? n.description_en.trim() : '';
  return !en;
});

const total = toTranslate.length;
if (total === 0) {
  console.log('✅ Rien à traduire (tous les nœuds ont déjà un description_en).');
  process.exit(0);
}

console.log(`📝 ${total} nœud(s) à traduire\n`);

let done = 0;
for (const node of toTranslate) {
  const fr = String(node.description).trim();
  done++;
  console.log(`Traduit ${done}/${total} — ${node.name}`);
  try {
    const en = await translateFrToEn(fr);
    if (!en) {
      console.warn(`   ⚠️  Traduction vide, ignoré.`);
    } else {
      node.description_en = en;
      writeSeed(data);
      console.log(`   ✅ OK`);
    }
  } catch (e) {
    console.error(`   ❌ ${e instanceof Error ? e.message : e}`);
  }
  await sleep(500);
}

console.log(`\n📊 Terminé (${done} traité(s)). Fichier : ${SEED_PATH}`);

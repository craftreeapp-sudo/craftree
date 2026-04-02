#!/usr/bin/env node
/**
 * Complète image_url via Wikimedia (gratuit, pas de Claude).
 * Lit et écrit seed-data.json + met à jour Supabase.
 */
import { readDB, writeDB, sleep } from './seed-helpers.mjs';
import {
  createServiceSupabaseClient,
  updateNodeImageUrl,
} from './supabase-seed-sync.mjs';
import {
  fetchWikipediaImageUrl,
  searchWikipediaImage,
} from './wikimedia-fetch.mjs';
import { confirm, hasYesFlag } from './cli-confirm.mjs';

const PAUSE_MS = 300;

function parseLimit() {
  const i = process.argv.indexOf('--limit');
  if (i === -1) return null;
  const raw = process.argv[i + 1];
  if (!raw || raw.startsWith('--')) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function needsRemoteImageUrl(node) {
  const u = node.image_url?.trim();
  if (!u) return true;
  if (u.startsWith('/images/nodes/')) return true;
  return false;
}

async function main() {
  const limit = parseLimit();
  const autoYes = hasYesFlag();
  const db = readDB();
  const totalNodes = db.nodes.length;
  const missingCount = db.nodes.filter(needsRemoteImageUrl).length;
  let todo = db.nodes.filter(needsRemoteImageUrl);
  if (limit != null) {
    todo = todo.slice(0, limit);
  }

  if (todo.length === 0) {
    console.log(
      missingCount === 0
        ? 'Aucune image manquante.'
        : 'Rien à traiter avec ces paramètres.'
    );
    return;
  }

  const estMin = Math.max(
    1,
    Math.round((todo.length * (PAUSE_MS / 1000 + 12)) / 60)
  );

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      RÉCUPÉRATION DES IMAGES            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`📋 Images manquantes : ${missingCount} sur ${totalNodes}`);
  if (limit != null) {
    console.log(`   → ${todo.length} fiche(s) à traiter (limite --limit ${limit})`);
  }
  console.log('💰 Coût : GRATUIT (API Wikimedia)');
  console.log(`⏱️  Durée estimée : ~${estMin} min`);
  console.log('🔄 Source : Wikipedia / Wikimedia Commons');
  console.log('');

  if (!autoYes) {
    const proceed = await confirm('Continuer ?');
    if (!proceed) {
      console.log('❌ Annulé.');
      process.exit(0);
    }
  }

  const supabase = createServiceSupabaseClient();

  let ok = 0;
  let miss = 0;
  let i = 0;

  for (const node of todo) {
    i++;
    process.stdout.write(`[${i}/${todo.length}] ${node.name}… `);

    let imageUrl = null;
    if (node.wikipedia_url?.trim()) {
      imageUrl = await fetchWikipediaImageUrl(String(node.wikipedia_url).trim());
    }
    if (!imageUrl) {
      imageUrl = await searchWikipediaImage(
        node.name,
        node.name_en || node.name
      );
    }

    if (imageUrl) {
      node.image_url = imageUrl;
      writeDB(db);
      await updateNodeImageUrl(supabase, node.id, imageUrl);
      ok++;
      console.log('✅');
    } else {
      miss++;
      console.log('⏭️ aucune image');
    }

    await sleep(PAUSE_MS);
  }

  console.log(`\n📊 Résumé : ${ok} image(s) récupérée(s), ${miss} sans résultat`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

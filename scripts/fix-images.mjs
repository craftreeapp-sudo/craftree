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
  const supabase = createServiceSupabaseClient();
  const db = readDB();
  const totalNodes = db.nodes.length;
  let todo = db.nodes.filter(needsRemoteImageUrl);
  if (limit != null) {
    todo = todo.slice(0, limit);
  }

  const missingCount = db.nodes.filter(needsRemoteImageUrl).length;
  console.log(
    `🖼️  ${missingCount} images manquantes sur ${totalNodes} nœuds${
      limit != null ? ` (traitement limité à ${limit})` : ''
    }\n`
  );

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

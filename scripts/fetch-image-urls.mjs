/**
 * Met à jour image_url dans seed-data.json avec des URLs Wikimedia Commons
 * (sans téléchargement local). Pause 300 ms entre chaque nœud.
 *
 * Usage : npm run fetch:images
 */

import fs from 'fs';
import path from 'path';
import {
  fetchWikipediaImageUrl,
  searchWikipediaImage,
} from './wikimedia-fetch.mjs';

const SEED_PATH = path.join(process.cwd(), 'src/data/seed-data.json');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function needsRemoteImageUrl(node) {
  const u = node.image_url?.trim();
  if (!u) return true;
  if (u.startsWith('/images/nodes/')) return true;
  return false;
}

function readDB() {
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
}

function writeDB(data) {
  fs.writeFileSync(SEED_PATH, JSON.stringify(data, null, 2));
}

async function main() {
  const db = readDB();
  const nodes = db.nodes ?? [];
  const total = nodes.length;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `🖼️  fetch-image-urls — ${total} nœuds (URLs externes Wikimedia)\n`
  );

  let i = 0;
  for (const node of nodes) {
    i++;
    if (!needsRemoteImageUrl(node)) {
      skipped++;
      console.log(`[${i}/${total}] ⏭️  ${node.id} — déjà une URL distante`);
      continue;
    }

    process.stdout.write(`[${i}/${total}] ${node.name}… `);

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
      updated++;
      writeDB(db);
      console.log(`✅`);
    } else {
      failed++;
      console.log(`⏭️  aucune image`);
    }

    await sleep(300);
  }

  console.log(
    `\n📊 Terminé : ${updated} mis à jour, ${skipped} ignorés, ${failed} sans résultat`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

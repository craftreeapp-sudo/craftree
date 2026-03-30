#!/usr/bin/env node
/**
 * Complète image_url sur les nœuds Supabase via Wikimedia (sans Claude).
 * Lit les nodes depuis Supabase, met à jour image_url en base uniquement.
 *
 * Usage : npm run fix:images
 *
 * Prérequis : .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import {
  createServiceSupabaseClient,
  updateNodeImageUrl,
} from './supabase-seed-sync.mjs';
import {
  fetchWikipediaImageUrl,
  searchWikipediaImage,
} from './wikimedia-fetch.mjs';

const PAGE_SIZE = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function needsRemoteImageUrl(node) {
  const u = node.image_url?.trim();
  if (!u) return true;
  if (u.startsWith('/images/nodes/')) return true;
  return false;
}

async function fetchAllNodes(supabase) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('nodes')
      .select('id,name,name_en,image_url,wikipedia_url')
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error('Supabase select nodes:', error);
      process.exit(1);
    }
    if (!data?.length) break;
    out.push(...data);
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return out;
}

async function main() {
  const supabase = createServiceSupabaseClient();
  console.log('🖼️  fix-images — lecture Supabase, URLs Wikimedia\n');

  const nodes = await fetchAllNodes(supabase);
  const total = nodes.length;
  let fetched = 0;
  let skipped = 0;
  let i = 0;

  for (const node of nodes) {
    i++;
    if (!needsRemoteImageUrl(node)) {
      skipped++;
      continue;
    }

    console.log(`[${i}/${total}] ${node.name}…`);

    let imageUrl = null;
    if (node.wikipedia_url?.trim()) {
      imageUrl = await fetchWikipediaImageUrl(
        String(node.wikipedia_url).trim()
      );
    }
    if (!imageUrl) {
      imageUrl = await searchWikipediaImage(
        node.name,
        node.name_en || node.name
      );
    }

    if (imageUrl) {
      await updateNodeImageUrl(supabase, node.id, imageUrl);
      fetched++;
      console.log(`   ✅ ${imageUrl.slice(0, 72)}…`);
    } else {
      console.log(`   ⏭️  Pas d’image trouvée`);
    }

    await sleep(300);
  }

  console.log(
    `\n📊 ${fetched} image(s) mise(s) à jour, ${skipped} déjà à jour ou ignorées`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

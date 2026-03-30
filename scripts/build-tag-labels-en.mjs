/**
 * Génère src/data/tag-labels-en.json (FR → EN pour les pastilles de tags).
 * Utilise l’API publique MyMemory (sans clé) avec délai pour limiter le quota.
 *
 * Usage : node scripts/build-tag-labels-en.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TAGS_FILE = path.join(__dirname, 'all-tags-unique.txt');
const OUT = path.join(ROOT, 'src/data/tag-labels-en.json');

const DELAY_MS = 400;

async function translateOne(tag) {
  const q = encodeURIComponent(tag);
  const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=fr|en`;
  const res = await fetch(url);
  const j = await res.json();
  if (j.quotaFinished) {
    throw new Error('MyMemory quota finished');
  }
  if (j.responseStatus !== 200) {
    throw new Error(`API ${j.responseStatus}: ${JSON.stringify(j)}`);
  }
  return (j.responseData?.translatedText || tag).trim();
}

async function main() {
  const raw = fs.readFileSync(TAGS_FILE, 'utf8').trim();
  const tags = raw.split('\n').filter(Boolean);
  const out = {};
  let prev = {};
  if (fs.existsSync(OUT)) {
    try {
      prev = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    } catch {
      prev = {};
    }
  }
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    if (typeof prev[tag] === 'string' && prev[tag].length > 0) {
      out[tag] = prev[tag];
      continue;
    }
    out[tag] = await translateOne(tag);
    if ((i + 1) % 50 === 0) {
      console.error(`progress ${i + 1}/${tags.length}`);
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  fs.writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`written ${Object.keys(out).length} → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

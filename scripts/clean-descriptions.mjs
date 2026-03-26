/**
 * Nettoie rétroactivement les champs description et description_en de seed-data.json
 * (même logique que scripts/populate.mjs — cleanDescription).
 */
import fs from 'fs';
import path from 'path';

const SEED_PATH = path.join(process.cwd(), 'src/data/seed-data.json');

function cleanDescription(text) {
  if (!text) return '';
  return text
    .replace(/<cite[^>]*>/g, '')
    .replace(/<\/cite>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const raw = fs.readFileSync(SEED_PATH, 'utf-8');
const data = JSON.parse(raw);

if (!Array.isArray(data.nodes)) {
  console.error('❌ seed-data.json : propriété nodes manquante ou invalide');
  process.exit(1);
}

let nDesc = 0;
let nDescEn = 0;

for (const node of data.nodes) {
  if (Object.prototype.hasOwnProperty.call(node, 'description')) {
    node.description = cleanDescription(node.description);
    nDesc++;
  }
  if (Object.prototype.hasOwnProperty.call(node, 'description_en')) {
    node.description_en = cleanDescription(node.description_en);
    nDescEn++;
  }
}

fs.writeFileSync(SEED_PATH, `${JSON.stringify(data, null, 2)}\n`);
console.log(
  `✅ Descriptions nettoyées : ${nDesc} champ(s) description, ${nDescEn} champ(s) description_en → ${SEED_PATH}`
);

#!/usr/bin/env node
/**
 * Génère nodes-index.json, nodes-details.json et links.json depuis seed-data.json.
 * Usage : node src/scripts/split-data.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');
const seedPath = path.join(root, 'src/data/seed-data.json');
const outIndex = path.join(root, 'src/data/nodes-index.json');
const outDetails = path.join(root, 'src/data/nodes-details.json');
const outLinks = path.join(root, 'src/data/links.json');

const raw = fs.readFileSync(seedPath, 'utf8');
const data = JSON.parse(raw);

const indexNodes = [];
const detailsById = {};

for (const n of data.nodes) {
  indexNodes.push({
    id: n.id,
    name: n.name,
    category: n.category,
    type: n.type,
    era: n.era,
    year_approx: n.year_approx ?? null,
    image_url: n.image_url ?? undefined,
    complexity_depth: n.complexity_depth,
  });

  const det = {
    name_en: n.name_en ?? '',
    description: n.description ?? '',
    tags: Array.isArray(n.tags) ? n.tags : [],
    origin: n.origin,
    wikipedia_url: n.wikipedia_url,
  };
  if (n.image_url) det.image_url = n.image_url;
  if (Array.isArray(n._ai_built_upon)) det._ai_built_upon = n._ai_built_upon;
  if (Array.isArray(n._ai_led_to)) det._ai_led_to = n._ai_led_to;
  detailsById[n.id] = det;
}

fs.writeFileSync(
  outIndex,
  JSON.stringify({ nodes: indexNodes }, null, 2) + '\n'
);
fs.writeFileSync(outDetails, JSON.stringify(detailsById, null, 2) + '\n');
fs.writeFileSync(
  outLinks,
  JSON.stringify({ links: data.links }, null, 2) + '\n'
);

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(1);
console.log(
  `Wrote nodes-index.json (${kb(outIndex)} KiB), nodes-details.json (${kb(outDetails)} KiB), links.json (${kb(outLinks)} KiB)`
);

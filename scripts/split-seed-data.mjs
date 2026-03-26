#!/usr/bin/env node
/**
 * Découpe seed-data.json en graph-core.json (graphe léger) + node-details.json (sidebar / SEO).
 * Usage : node scripts/split-seed-data.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const seedPath = path.join(root, 'src/data/seed-data.json');
const outCore = path.join(root, 'src/data/graph-core.json');
const outDetails = path.join(root, 'src/data/node-details.json');

const raw = fs.readFileSync(seedPath, 'utf8');
const data = JSON.parse(raw);

const slim = [];
const byId = {};

for (const n of data.nodes) {
  slim.push({
    id: n.id,
    name: n.name,
    category: n.category,
    type: n.type,
    era: n.era,
    year_approx: n.year_approx ?? null,
    complexity_depth: n.complexity_depth,
    tags: n.tags ?? [],
  });
  const detail = {
    name_en: n.name_en ?? n.name,
    description: n.description ?? '',
  };
  if (typeof n.description_en === 'string' && n.description_en.trim() !== '') {
    detail.description_en = n.description_en.trim();
  }
  if (n.image_url) detail.image_url = n.image_url;
  if (n.wikipedia_url) detail.wikipedia_url = n.wikipedia_url;
  byId[n.id] = detail;
}

fs.writeFileSync(
  outCore,
  JSON.stringify({ nodes: slim, links: data.links }, null, 2) + '\n'
);
fs.writeFileSync(outDetails, JSON.stringify(byId, null, 2) + '\n');

const kb = (p) => (fs.statSync(p).size / 1024).toFixed(1);
console.log(`Wrote graph-core.json (${kb(outCore)} KiB), node-details.json (${kb(outDetails)} KiB)`);

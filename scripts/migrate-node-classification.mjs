/**
 * Migre les nœuds : une seule paire naturalOrigin / chemicalNature,
 * valeurs mineral|plant|animal et element|compound|material.
 * Supprime origin_type, nature_type, natural_origin, chemical_nature (snake).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function normOrigin(v) {
  if (v == null || v === '') return undefined;
  const s = String(v);
  if (s === 'vegetal') return 'plant';
  if (s === 'mineral' || s === 'plant' || s === 'animal') return s;
  return undefined;
}

function normChem(v) {
  if (v == null || v === '') return undefined;
  const s = String(v);
  if (s === 'compose') return 'compound';
  if (s === 'materiau') return 'material';
  if (s === 'element' || s === 'compound' || s === 'material') return s;
  return undefined;
}

function migrateNode(n) {
  if (!n || typeof n !== 'object') return;
  const o = normOrigin(n.naturalOrigin ?? n.origin_type ?? n.natural_origin);
  const c = normChem(n.chemicalNature ?? n.nature_type ?? n.chemical_nature);
  delete n.origin_type;
  delete n.nature_type;
  delete n.natural_origin;
  delete n.chemical_nature;
  if (o) n.naturalOrigin = o;
  else delete n.naturalOrigin;
  if (c) n.chemicalNature = c;
  else delete n.chemicalNature;
}

function run(rel) {
  const fp = path.join(root, rel);
  const raw = fs.readFileSync(fp, 'utf8');
  const data = JSON.parse(raw);
  if (data.nodes && Array.isArray(data.nodes)) {
    for (const n of data.nodes) migrateNode(n);
  }
  fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n');
  console.log('OK', rel);
}

for (const f of [
  'src/data/graph-core.json',
  'src/data/seed-data.json',
  'src/data/nodes-index.json',
]) {
  run(f);
}

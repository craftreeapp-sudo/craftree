/**
 * Lecture/écriture seed-data.json + normalisation (partagé entre add / enrich).
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const SEED_PATH = path.join(process.cwd(), 'src/data/seed-data.json');

export function readDB() {
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf-8'));
}

export function writeDB(data) {
  fs.writeFileSync(SEED_PATH, JSON.stringify(data, null, 2));
}

export function slugify(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cleanDescription(text) {
  if (text == null || text === '') return '';
  let s = String(text);
  s = s.replace(/<cite\b[^>]*>[\s\S]*?<\/cite>/gi, '');
  s = s.replace(/<cite\b[^>]*\/?>/gi, '');
  s = s.replace(/<\/cite>/gi, '');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/\[\d+\]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

const DIMENSION_VALUES = new Set(['matter', 'process', 'tool']);
const MATERIAL_LEVEL_VALUES = new Set([
  'raw',
  'processed',
  'industrial',
  'component',
]);

export const NODE_CATEGORY_VALUES = new Set([
  'energy',
  'construction',
  'weapon',
  'network',
  'food',
  'transport',
  'software',
  'infrastructure',
  'textile',
  'communication',
  'agriculture',
  'robotics',
  'chemistry',
  'electronics',
  'environment',
  'automation',
  'medical',
  'optical',
  'storage',
  'aeronautics',
  'space',
  'industry',
  'nanotechnology',
  'biotechnology',
  'security',
  'home_automation',
]);

const TECH_NODE_TYPES = new Set([
  'raw_material',
  'material',
  'process',
  'tool',
  'component',
]);

const ERA_VALUES = new Set([
  'prehistoric',
  'ancient',
  'medieval',
  'renaissance',
  'industrial',
  'modern',
  'digital',
  'contemporary',
]);

const ORIGIN_TYPE_VALUES = new Set(['mineral', 'vegetal', 'animal']);
const NATURE_TYPE_VALUES = new Set(['element', 'compose', 'materiau']);

export function normalizeCategory(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (NODE_CATEGORY_VALUES.has(s)) return s;
  return 'industry';
}

export function normalizeTechNodeType(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s === 'end_product') return 'component';
  if (TECH_NODE_TYPES.has(s)) return s;
  return 'material';
}

export function normalizeEra(raw) {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (ERA_VALUES.has(s)) return s;
  return null;
}

export function normalizeOriginNatureTypes(enriched) {
  const otRaw = enriched.origin_type ?? enriched.naturalOrigin;
  const otStr = typeof otRaw === 'string' ? otRaw.trim() : '';
  const origin_type =
    otStr && ORIGIN_TYPE_VALUES.has(otStr) ? otStr : null;

  let ntStr = enriched.nature_type ?? enriched.chemicalNature;
  if (typeof ntStr === 'string') {
    ntStr = ntStr.trim();
    if (ntStr === 'compound') ntStr = 'compose';
    if (ntStr === 'material') ntStr = 'materiau';
  } else {
    ntStr = '';
  }
  const nature_type =
    ntStr && NATURE_TYPE_VALUES.has(ntStr) ? ntStr : null;
  return { origin_type, nature_type };
}

export function normalizeDimensionMaterialLevel(enriched) {
  const dRaw = enriched.dimension;
  const dimension =
    typeof dRaw === 'string' && DIMENSION_VALUES.has(dRaw) ? dRaw : null;
  const mlRaw = enriched.materialLevel;
  let materialLevel =
    typeof mlRaw === 'string' && MATERIAL_LEVEL_VALUES.has(mlRaw)
      ? mlRaw
      : null;
  if (dimension !== 'matter') materialLevel = null;
  return { dimension, materialLevel };
}

/** Entier PostgreSQL ; borne les années aberrantes. */
export function normalizeYearApprox(year) {
  if (year == null) return null;
  const n = typeof year === 'number' ? year : Number(year);
  if (!Number.isFinite(n)) return null;
  if (n < -10000) return -10000;
  if (n > 2030) return null;
  return Math.round(n);
}

export function isEmptyForMerge(v) {
  if (v == null) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

export function mergeAiArraysPreferExisting(existingArr, incomingArr, force) {
  if (force) {
    return Array.isArray(incomingArr)
      ? JSON.parse(JSON.stringify(incomingArr))
      : [];
  }
  const base = Array.isArray(existingArr)
    ? JSON.parse(JSON.stringify(existingArr))
    : [];
  const inc = Array.isArray(incomingArr) ? incomingArr : [];
  const seen = new Set(base.map((x) => x.id || slugify(x.name)));
  for (const item of inc) {
    const k = item.id || slugify(item.name);
    if (!seen.has(k)) {
      seen.add(k);
      base.push(item);
    }
  }
  return base;
}

export function mergeUpdatedNodeFields(existing, claudePatch, force) {
  if (force) {
    const p = { ...claudePatch };
    if (p.dimension !== 'matter') p.materialLevel = null;
    return p;
  }
  const out = {};
  const keys = [
    'name_en',
    'description',
    'description_en',
    'category',
    'type',
    'era',
    'year_approx',
    'origin',
    'wikipedia_url',
    'tags',
    'dimension',
    'materialLevel',
    'origin_type',
    'nature_type',
  ];
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(claudePatch, k)) {
      out[k] = existing[k];
      continue;
    }
    const ex = existing[k];
    const inc = claudePatch[k];
    if (k === 'year_approx') {
      out[k] = ex == null ? inc : ex;
      continue;
    }
    if (k === 'tags') {
      out[k] = Array.isArray(ex) && ex.length > 0 ? ex : inc;
      continue;
    }
    out[k] = isEmptyForMerge(ex) ? inc : ex;
  }
  if (Object.prototype.hasOwnProperty.call(claudePatch, '_ai_built_upon')) {
    out._ai_built_upon = mergeAiArraysPreferExisting(
      existing._ai_built_upon,
      claudePatch._ai_built_upon,
      false
    );
  } else {
    out._ai_built_upon = existing._ai_built_upon;
  }
  if (Object.prototype.hasOwnProperty.call(claudePatch, '_ai_led_to')) {
    out._ai_led_to = mergeAiArraysPreferExisting(
      existing._ai_led_to,
      claudePatch._ai_led_to,
      false
    );
  } else {
    out._ai_led_to = existing._ai_led_to;
  }
  if (out.dimension !== 'matter') {
    out.materialLevel = null;
  }
  return out;
}

/** Patch normalisé depuis une entrée JSON Claude (enrich / classify). */
export function enrichItemToClaudePatch(item) {
  const patch = {};
  if (Object.prototype.hasOwnProperty.call(item, 'dimension')) {
    const { dimension, materialLevel } = normalizeDimensionMaterialLevel(item);
    patch.dimension = dimension;
    patch.materialLevel = materialLevel;
  } else if (Object.prototype.hasOwnProperty.call(item, 'materialLevel')) {
    const { materialLevel } = normalizeDimensionMaterialLevel({
      ...item,
      dimension: item.dimension ?? 'matter',
    });
    patch.materialLevel = materialLevel;
  }
  if (
    Object.prototype.hasOwnProperty.call(item, 'origin_type') ||
    Object.prototype.hasOwnProperty.call(item, 'nature_type')
  ) {
    const { origin_type, nature_type } = normalizeOriginNatureTypes(item);
    if (Object.prototype.hasOwnProperty.call(item, 'origin_type')) {
      patch.origin_type = origin_type;
    }
    if (Object.prototype.hasOwnProperty.call(item, 'nature_type')) {
      patch.nature_type = nature_type;
    }
  }
  if (Object.prototype.hasOwnProperty.call(item, 'category')) {
    patch.category = normalizeCategory(item.category ?? '');
  }
  if (Object.prototype.hasOwnProperty.call(item, 'type')) {
    patch.type = normalizeTechNodeType(item.type ?? '');
  }
  if (Object.prototype.hasOwnProperty.call(item, 'era')) {
    patch.era = normalizeEra(item.era ?? '');
  }
  if (Object.prototype.hasOwnProperty.call(item, 'year_approx')) {
    patch.year_approx = normalizeYearApprox(item.year_approx);
  }
  if (Object.prototype.hasOwnProperty.call(item, 'origin')) {
    patch.origin = item.origin ? String(item.origin).trim() || null : null;
  }
  if (Object.prototype.hasOwnProperty.call(item, 'description')) {
    patch.description = cleanDescription(item.description ?? '');
  }
  if (Object.prototype.hasOwnProperty.call(item, 'description_en')) {
    patch.description_en = cleanDescription(item.description_en ?? '');
  }
  if (Object.prototype.hasOwnProperty.call(item, 'wikipedia_url')) {
    const u = item.wikipedia_url;
    patch.wikipedia_url = u && String(u).trim() ? String(u).trim() : null;
  }
  if (Object.prototype.hasOwnProperty.call(item, 'tags')) {
    const t = item.tags;
    patch.tags = Array.isArray(t)
      ? t.map((x) => String(x).trim()).filter(Boolean)
      : [];
  }
  return patch;
}

export function nodeNeedsEnrichment(node) {
  if (isEmptyForMerge(node.dimension)) return true;
  if (isEmptyForMerge(node.description)) return true;
  if (isEmptyForMerge(node.description_en)) return true;
  if (isEmptyForMerge(node.category)) return true;
  if (isEmptyForMerge(node.type)) return true;
  if (isEmptyForMerge(node.era)) return true;
  if (node.year_approx == null || node.year_approx === '') return true;
  if (isEmptyForMerge(node.origin)) return true;
  if (isEmptyForMerge(node.wikipedia_url)) return true;
  if (!Array.isArray(node.tags) || node.tags.length === 0) return true;
  if (isEmptyForMerge(node.origin_type)) return true;
  if (isEmptyForMerge(node.nature_type)) return true;
  if (node.dimension === 'matter') {
    if (isEmptyForMerge(node.materialLevel)) return true;
  }
  return false;
}

export function formatNodeWithMissingFields(n) {
  const line = (label, val, filled) =>
    `${label}: ${filled ? `${JSON.stringify(val)} ✓` : 'À REMPLIR'}`;
  const lines = [
    `Nom : ${n.name} (id: ${n.id})`,
    line('category', n.category, !isEmptyForMerge(n.category)),
    line('type', n.type, !isEmptyForMerge(n.type)),
    line('dimension', n.dimension, !isEmptyForMerge(n.dimension)),
    line(
      'materialLevel',
      n.materialLevel,
      !(n.dimension === 'matter' && isEmptyForMerge(n.materialLevel))
    ),
    line('origin_type', n.origin_type, !isEmptyForMerge(n.origin_type)),
    line('nature_type', n.nature_type, !isEmptyForMerge(n.nature_type)),
    line('era', n.era, !isEmptyForMerge(n.era)),
    line('year_approx', n.year_approx, n.year_approx != null && n.year_approx !== ''),
    line('origin', n.origin, !isEmptyForMerge(n.origin)),
    line(
      'description',
      n.description
        ? `${String(n.description).slice(0, 80)}…`
        : '',
      !isEmptyForMerge(n.description)
    ),
    line(
      'description_en',
      n.description_en
        ? `${String(n.description_en).slice(0, 80)}…`
        : '',
      !isEmptyForMerge(n.description_en)
    ),
    line('wikipedia_url', n.wikipedia_url, !isEmptyForMerge(n.wikipedia_url)),
    line('tags', n.tags, Array.isArray(n.tags) && n.tags.length > 0),
  ];
  return lines.join('\n');
}

export function uniqueLinkId(dbLinks, pendingLinks) {
  const existing = new Set([
    ...dbLinks.map((l) => l.id),
    ...pendingLinks.map((l) => l.id),
  ]);
  let id;
  do {
    id = `l-${crypto.randomBytes(6).toString('hex')}`;
  } while (existing.has(id));
  return id;
}

/** id d’URL orphelin → nom lisible approximatif */
export function idToPrettyName(id) {
  return String(id)
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

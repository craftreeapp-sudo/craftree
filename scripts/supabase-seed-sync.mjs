/**
 * Client Supabase (service role) + mapping seed-data.json → colonnes PostgreSQL.
 * Utilisé par populate.mjs et fix-images.mjs.
 */
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { config } from 'dotenv';

export const SUPABASE_BATCH_SIZE = 50;

export function loadSupabaseEnv() {
  config({ path: path.join(process.cwd(), '.env.local') });
  config({ path: path.join(process.cwd(), '.env') });
}

/**
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createServiceSupabaseClient() {
  loadSupabaseEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
    );
    process.exit(1);
  }
  return createClient(url, serviceKey);
}

/** Aligné sur CHECK nodes_origin_type_check (Supabase). */
function mapSeedOriginTypeToDb(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (s === 'mineral' || s === 'vegetal' || s === 'animal') return s;
  return null;
}

/** seed legacy (chemicalNature) + populate → colonnes nature_type (compose, materiau). */
function mapSeedNatureTypeToDb(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (s === 'compound') return 'compose';
  if (s === 'material') return 'materiau';
  if (s === 'element' || s === 'compose' || s === 'materiau') return s;
  return null;
}

/**
 * Nœud tel que dans seed-data.json (camelCase materialLevel, champs _ai_* ignorés).
 */
export function mapSeedNodeToSupabaseRow(node) {
  const row = {
    id: node.id,
    name: node.name,
    name_en: node.name_en || null,
    description: node.description || null,
    description_en: node.description_en || null,
    category: node.category,
    type: node.type,
    era: node.era || null,
    year_approx: node.year_approx ?? null,
    origin: node.origin || null,
    image_url: node.image_url || null,
    wikipedia_url: node.wikipedia_url || null,
    tags: Array.isArray(node.tags) ? node.tags : [],
    complexity_depth: node.complexity_depth ?? 0,
    dimension: node.dimension ?? null,
    material_level: node.materialLevel ?? null,
    origin_type: mapSeedOriginTypeToDb(
      node.origin_type ?? node.naturalOrigin ?? null
    ),
    nature_type: mapSeedNatureTypeToDb(
      node.nature_type ?? node.chemicalNature ?? null
    ),
  };
  return row;
}

export function mapLinkToSupabaseRow(link) {
  return {
    id: link.id,
    source_id: link.source_id,
    target_id: link.target_id,
    relation_type: link.relation_type,
    is_optional: link.is_optional || false,
    notes: link.notes || null,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object[]} seedNodes
 */
export async function upsertSeedNodes(supabase, seedNodes) {
  if (seedNodes.length === 0) return;
  const rows = seedNodes.map(mapSeedNodeToSupabaseRow);
  for (let i = 0; i < rows.length; i += SUPABASE_BATCH_SIZE) {
    const batch = rows.slice(i, i + SUPABASE_BATCH_SIZE);
    const { error } = await supabase.from('nodes').upsert(batch);
    if (error) {
      console.error('Supabase upsert nodes:', error);
      process.exit(1);
    }
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object[]} seedLinks
 */
export async function upsertSeedLinks(supabase, seedLinks) {
  if (seedLinks.length === 0) return;
  const rows = seedLinks.map(mapLinkToSupabaseRow);
  for (let i = 0; i < rows.length; i += SUPABASE_BATCH_SIZE) {
    const batch = rows.slice(i, i + SUPABASE_BATCH_SIZE);
    const { error } = await supabase.from('links').upsert(batch);
    if (error) {
      console.error('Supabase upsert links:', error);
      process.exit(1);
    }
  }
}

/**
 * Mise à jour d’image seule (évite un upsert partiel qui écraserait name, etc.).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function updateNodeImageUrl(supabase, nodeId, imageUrl) {
  const { error } = await supabase
    .from('nodes')
    .update({ image_url: imageUrl })
    .eq('id', nodeId);
  if (error) {
    console.error('Supabase update node image_url:', error);
    process.exit(1);
  }
}

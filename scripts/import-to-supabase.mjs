import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const seedData = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'src/data/seed-data.json'), 'utf-8')
);

async function importData() {
  console.log(`Importing ${seedData.nodes.length} nodes...`);

  for (let i = 0; i < seedData.nodes.length; i += 50) {
    const batch = seedData.nodes.slice(i, i + 50).map((node) => ({
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
      tags: node.tags || [],
      complexity_depth: node.complexity_depth || 0,
    }));

    const { error } = await supabase.from('nodes').upsert(batch);
    if (error) console.error('Error importing nodes:', error);
    console.log(
      `  Nodes: ${Math.min(i + 50, seedData.nodes.length)}/${seedData.nodes.length}`
    );
  }

  console.log(`Importing ${seedData.links.length} links...`);

  for (let i = 0; i < seedData.links.length; i += 50) {
    const batch = seedData.links.slice(i, i + 50).map((link) => ({
      id: link.id,
      source_id: link.source_id,
      target_id: link.target_id,
      relation_type: link.relation_type,
      quantity_hint: link.quantity_hint || null,
      is_optional: link.is_optional || false,
      notes: link.notes || null,
    }));

    const { error } = await supabase.from('links').upsert(batch);
    if (error) console.error('Error importing links:', error);
    console.log(
      `  Links: ${Math.min(i + 50, seedData.links.length)}/${seedData.links.length}`
    );
  }

  console.log('Done!');
}

importData().catch((e) => {
  console.error(e);
  process.exit(1);
});

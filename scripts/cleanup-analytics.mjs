/**
 * Supprime les événements analytics de plus de 90 jours (service role).
 * Usage : npm run cleanup:analytics
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });
config({ path: join(__dirname, '..', '.env') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

const { error } = await supabase
  .from('analytics_events')
  .delete()
  .lt('created_at', cutoff);

if (error) {
  console.error(error);
  process.exit(1);
}

console.log(`cleanup-analytics: ok, removed events before ${cutoff}`);

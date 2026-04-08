-- Colonnes classification fiche (aligné supabase/schema.sql).
-- À appliquer si PostgREST : « Could not find the 'chemical_nature' column … in the schema cache ».

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS natural_origin TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS chemical_nature TEXT;

ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_natural_origin_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_natural_origin_check CHECK (
  natural_origin IS NULL OR natural_origin IN ('mineral', 'vegetal', 'animal')
);

ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_chemical_nature_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_chemical_nature_check CHECK (
  chemical_nature IS NULL OR chemical_nature IN ('element', 'compound', 'material')
);

-- Aide PostgREST à rafraîchir le cache (no-op si non supporté).
NOTIFY pgrst, 'reload schema';

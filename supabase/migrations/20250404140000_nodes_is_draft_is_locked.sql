-- Colonnes requises pour les filtres admin IA (brouillon / verrou).
-- Sans ces colonnes, « Estimer le coût » échoue avec column nodes.is_locked does not exist.
-- Aligné sur supabase/schema.sql (section brouillon / verrou).

ALTER TABLE nodes ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;

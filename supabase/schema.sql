-- Craftree — schéma PostgreSQL (Supabase)
-- Remplacez craftree.app@gmail.com par l’e-mail admin si besoin (aligné sur NEXT_PUBLIC_ADMIN_EMAIL).

-- Table des inventions
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  description TEXT,
  description_en TEXT,
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  era TEXT,
  year_approx INTEGER,
  origin TEXT,
  image_url TEXT,
  wikipedia_url TEXT,
  tags TEXT[] DEFAULT '{}',
  complexity_depth INTEGER DEFAULT 0,
  dimension TEXT,
  material_level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT nodes_dimension_check CHECK (
    dimension IS NULL OR dimension IN ('matter', 'process', 'tool')
  ),
  CONSTRAINT nodes_material_level_check CHECK (
    material_level IS NULL
    OR material_level IN ('raw', 'processed', 'industrial', 'component')
  ),
  CONSTRAINT nodes_dimension_material_level_check CHECK (
    material_level IS NULL OR dimension = 'matter'
  )
);

-- Table des liens de fabrication
CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL,
  is_optional BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des utilisateurs (profils)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'contributor',
  contributions_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des suggestions
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  suggestion_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  node_id TEXT,
  data JSONB NOT NULL,
  admin_comment TEXT,
  contributor_ip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Bases déjà créées : ajouter la colonne IP (contributions anonymes)
ALTER TABLE suggestions ADD COLUMN IF NOT EXISTS contributor_ip TEXT;

-- Dimension + niveau matière (bases existantes sans ces colonnes)
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS dimension TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS material_level TEXT;
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_dimension_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_dimension_check CHECK (
  dimension IS NULL OR dimension IN ('matter', 'process', 'tool')
);
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_material_level_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_material_level_check CHECK (
  material_level IS NULL
  OR material_level IN ('raw', 'processed', 'industrial', 'component')
);
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_dimension_material_level_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_dimension_material_level_check CHECK (
  material_level IS NULL OR dimension = 'matter'
);

-- Index
CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_id);
CREATE INDEX IF NOT EXISTS idx_nodes_category ON nodes(category);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);

-- Row Level Security
ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

-- Lecture publique nodes / links
DROP POLICY IF EXISTS "nodes_read" ON nodes;
CREATE POLICY "nodes_read" ON nodes FOR SELECT USING (true);

DROP POLICY IF EXISTS "links_read" ON links;
CREATE POLICY "links_read" ON links FOR SELECT USING (true);

-- Admin (e-mail fixe — doit correspondre au compte Google admin)
DROP POLICY IF EXISTS "nodes_admin_write" ON nodes;
CREATE POLICY "nodes_admin_write" ON nodes FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'craftree.app@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'craftree.app@gmail.com');

DROP POLICY IF EXISTS "links_admin_write" ON links;
CREATE POLICY "links_admin_write" ON links FOR ALL TO authenticated
  USING ((auth.jwt() ->> 'email') = 'craftree.app@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'craftree.app@gmail.com');

DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT USING (
  auth.uid() = id OR (auth.jwt() ->> 'email') = 'craftree.app@gmail.com'
);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "suggestions_insert" ON suggestions;
CREATE POLICY "suggestions_insert" ON suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Insertion côté client anonyme (ex. retours sans compte) — lecture / mise à jour restent restreintes
DROP POLICY IF EXISTS "suggestions_anonymous_insert" ON suggestions;
CREATE POLICY "suggestions_anonymous_insert" ON suggestions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "suggestions_read_own" ON suggestions;
CREATE POLICY "suggestions_read_own" ON suggestions FOR SELECT USING (
  auth.uid() = user_id OR (auth.jwt() ->> 'email') = 'craftree.app@gmail.com'
);

DROP POLICY IF EXISTS "suggestions_admin_update" ON suggestions;
CREATE POLICY "suggestions_admin_update" ON suggestions FOR UPDATE USING (
  (auth.jwt() ->> 'email') = 'craftree.app@gmail.com'
);

-- Profil à l'inscription
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bases existantes : supprime la colonne obsolète (quantité sur les liens)
ALTER TABLE links DROP COLUMN IF EXISTS quantity_hint;

-- Événements analytics (insertion publique, lecture admin uniquement)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  node_id TEXT,
  session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_node_id ON analytics_events(node_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON analytics_events(created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_insert_all" ON analytics_events;
CREATE POLICY "analytics_insert_all" ON analytics_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "analytics_read_admin" ON analytics_events;
CREATE POLICY "analytics_read_admin" ON analytics_events FOR SELECT USING (
  (auth.jwt() ->> 'email') = 'craftree.app@gmail.com'
);

-- Origine naturelle + nature chimique/physique (suggestions / fiches)
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

-- Classification : origine naturelle + nature chimique/physique (noms alignés seed / populate)
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS origin_type TEXT;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS nature_type TEXT;
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_origin_type_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_origin_type_check CHECK (
  origin_type IS NULL OR origin_type IN ('mineral', 'vegetal', 'animal')
);
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_nature_type_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_nature_type_check CHECK (
  nature_type IS NULL OR nature_type IN ('element', 'compose', 'materiau')
);

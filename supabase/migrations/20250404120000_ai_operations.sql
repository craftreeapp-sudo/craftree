-- Journal des opérations IA (admin — lecture via API service role)
-- À appliquer sur le projet Supabase si le message « Impossible de lire le journal » apparaît (table absente).

CREATE TABLE IF NOT EXISTS ai_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  params JSONB,
  results JSONB,
  cards_processed INT DEFAULT 0,
  cards_modified INT DEFAULT 0,
  cost_estimate NUMERIC(10, 4),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_operations_started ON ai_operations(started_at DESC);

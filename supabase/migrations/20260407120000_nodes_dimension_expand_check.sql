-- Aligner nodes_dimension_check sur NodeDimension (types.ts) : composant, energy, infrastructure.
ALTER TABLE nodes DROP CONSTRAINT IF EXISTS nodes_dimension_check;
ALTER TABLE nodes ADD CONSTRAINT nodes_dimension_check CHECK (
  dimension IS NULL
  OR dimension IN (
    'matter',
    'composant',
    'tool',
    'energy',
    'process',
    'infrastructure'
  )
);

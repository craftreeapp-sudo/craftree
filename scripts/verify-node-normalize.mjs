/**
 * Normalisation des nœuds pour verify-inventions.mjs — aligné sur src/lib/data.ts
 * (mapRowDimension / mapRowMaterialLevel) + tolérance camelCase si l’API renvoie les deux.
 */

function pickStr(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Ligne `nodes` renvoyée par PostgREST / Supabase.
 * @param {Record<string, unknown>} row
 */
export function normalizeNodeRowFromSupabase(row) {
  if (!row || typeof row !== "object") return row;
  const dimension = pickStr(row.dimension ?? row.Dimension);
  const material_level = pickStr(
    row.material_level ?? row.materialLevel ?? row.MaterialLevel
  );
  return { ...row, dimension, material_level };
}

/**
 * Entrée seed-data.json (materialLevel camelCase).
 * @param {Record<string, unknown>} n
 */
export function normalizeSeedNodeForVerify(n) {
  if (!n || typeof n !== "object") return n;
  const dimension = pickStr(n.dimension);
  const material_level = pickStr(n.materialLevel ?? n.material_level);
  return { ...n, dimension, material_level };
}

/**
 * Liens depuis seed-data.json — même forme que getLinksForInvention (Supabase).
 * @param {string} inventionId
 * @param {{ nodes: object[]; links: object[] }} seedData
 */
export function getLinksFromSeed(inventionId, seedData) {
  const nodesById = new Map(
    (seedData.nodes || []).map((node) => [node.id, node])
  );
  const builtUpon = [];
  const ledTo = [];
  for (const link of seedData.links || []) {
    if (link.target_id === inventionId) {
      const raw = nodesById.get(link.source_id);
      if (raw) {
        const n = normalizeSeedNodeForVerify(raw);
        builtUpon.push({
          id: n.id,
          name: n.name_en,
          dimension: n.dimension,
          material_level: n.material_level,
        });
      }
    }
    if (link.source_id === inventionId) {
      const raw = nodesById.get(link.target_id);
      if (raw) {
        const n = normalizeSeedNodeForVerify(raw);
        ledTo.push({
          id: n.id,
          name: n.name_en,
          dimension: n.dimension,
          material_level: n.material_level,
        });
      }
    }
  }
  return { builtUpon, ledTo };
}

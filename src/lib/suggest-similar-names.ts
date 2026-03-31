import type { TechNodeBasic } from '@/lib/types';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { normalizeInventionName } from '@/lib/utils';

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = row[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + cost);
      prev = temp;
    }
  }
  return row[n]!;
}

/**
 * Cartes dont le nom est proche de la saisie (sous-chaîne, distance d’édition, préfixe commun).
 * Les libellés affichés suivent la locale UI (nom FR / EN selon les règles du site).
 */
export function findSimilarNodeNames(
  query: string,
  nodes: TechNodeBasic[],
  locale: string,
  limit = 8
): { id: string; name: string }[] {
  const raw = query.trim();
  if (raw.length < 2) return [];
  const nq = normalizeInventionName(raw);
  if (nq.length < 2) return [];

  const scored: { id: string; name: string; score: number }[] = [];

  for (const node of nodes) {
    const nn = normalizeInventionName(node.name);
    if (nn.length === 0) continue;

    let score = 0;
    if (nn === nq) {
      score = 100;
    } else if (nn.includes(nq) || nq.includes(nn)) {
      score = 88;
    } else {
      const maxLen = Math.max(nn.length, nq.length);
      const dist = levenshtein(nn, nq);
      const maxDist = Math.max(
        1,
        Math.min(4, Math.floor(maxLen / 4) + 1)
      );
      if (dist <= maxDist && maxLen >= 3) {
        score = Math.max(0, 72 - dist * 12);
      } else {
        let common = 0;
        for (let i = 0; i < Math.min(nn.length, nq.length); i++) {
          if (nn[i] === nq[i]) common++;
          else break;
        }
        const prefixRatio = common / Math.max(nn.length, nq.length, 1);
        if (prefixRatio >= 0.35 && common >= 2) {
          score = Math.round(prefixRatio * 45);
        }
      }
    }

    if (score > 0) {
      const displayName = pickNodeDisplayName(
        locale,
        node.name,
        node.name_en
      );
      scored.push({ id: node.id, name: displayName, score });
    }
  }

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.name.localeCompare(b.name, locale, { sensitivity: 'base' })
  );

  const seen = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const s of scored) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push({ id: s.id, name: s.name });
    if (out.length >= limit) break;
  }
  return out;
}

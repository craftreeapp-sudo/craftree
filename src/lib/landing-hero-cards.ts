import type { NodeCategory } from '@/lib/types';

export type LandingHeroCard = {
  id: string;
  name: string;
  category: NodeCategory;
};

/** Ordre d’affichage des mini-cartes hero (ids dans nodes-index.json). */
export const LANDING_HERO_NODE_IDS = [
  'acier',
  'feu',
  'internet',
  'bois',
  'roue',
  'cuivre',
  'vaccin',
  'verre',
  'pain',
  'electricite',
] as const;

/** Positions (%), durée float (s), délai float (s), délai ligne (s) si la carte est l’extrémité « from » d’un lien */
export const LANDING_HERO_LAYOUT: {
  cx: number;
  cy: number;
  duration: number;
  delay: number;
}[] = [
  { cx: 10, cy: 20, duration: 5.5, delay: 0 },
  { cx: 22, cy: 48, duration: 7.2, delay: 1.1 },
  { cx: 16, cy: 78, duration: 6.1, delay: 2.4 },
  { cx: 38, cy: 14, duration: 8.4, delay: 0.3 },
  { cx: 44, cy: 42, duration: 5.8, delay: 3.2 },
  { cx: 52, cy: 72, duration: 7.8, delay: 1.6 },
  { cx: 62, cy: 18, duration: 6.4, delay: 0.8 },
  { cx: 70, cy: 46, duration: 5.2, delay: 2.9 },
  { cx: 78, cy: 76, duration: 8.1, delay: 0.2 },
  { cx: 90, cy: 38, duration: 6.7, delay: 3.8 },
];

/** Paires d’indices (cartes connectées) — lignes SVG pointillées */
export const LANDING_HERO_LINKS: [number, number][] = [
  [0, 1],
  [1, 2],
  [3, 4],
  [4, 5],
  [6, 7],
  [7, 8],
  [8, 9],
  [2, 5],
  [3, 6],
];

/** Durée (s) et délai (s) pour l’animation d’opacité de chaque ligne (même ordre que LINKS) */
export const LANDING_HERO_LINE_ANIM: { duration: number; delay: number }[] = [
  { duration: 6.5, delay: 0 },
  { duration: 8.2, delay: 0.7 },
  { duration: 7.1, delay: 1.4 },
  { duration: 6.0, delay: 2.1 },
  { duration: 9.0, delay: 0.4 },
  { duration: 7.5, delay: 1.8 },
  { duration: 8.8, delay: 2.6 },
  { duration: 6.8, delay: 3.2 },
  { duration: 10.0, delay: 0.9 },
];

type IndexNode = { id: string; name: string; category: string };

export function resolveLandingHeroCards(nodes: IndexNode[]): LandingHeroCard[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: LandingHeroCard[] = [];
  for (const id of LANDING_HERO_NODE_IDS) {
    const n = byId.get(id);
    if (n) {
      out.push({
        id: n.id,
        name: n.name,
        category: n.category as NodeCategory,
      });
    }
  }
  return out;
}

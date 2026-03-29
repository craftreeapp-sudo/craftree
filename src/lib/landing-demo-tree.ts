import nodesIndex from '@/data/nodes-index.json';
import nodesDetails from '@/data/nodes-details.json';
import type { NodeCategory } from '@/lib/types';

const DEMO_IDS = [
  'feu',
  'four',
  'sable',
  'verre',
  'lentille',
  'microscope',
] as const;

export type LandingDemoTreeNode = {
  id: string;
  name: string;
  description: string;
  category: NodeCategory;
};

/** Liens du mini-arbre (pour SVG) — types alignés sur links.json */
export type LandingDemoEdge = {
  from: (typeof DEMO_IDS)[number];
  to: (typeof DEMO_IDS)[number];
  relation: 'material' | 'tool' | 'energy';
};

export const LANDING_DEMO_EDGES: LandingDemoEdge[] = [
  { from: 'feu', to: 'four', relation: 'energy' },
  { from: 'four', to: 'verre', relation: 'tool' },
  { from: 'sable', to: 'verre', relation: 'material' },
  { from: 'verre', to: 'lentille', relation: 'material' },
  { from: 'lentille', to: 'microscope', relation: 'material' },
];

/** Positions px dans le conteneur 700×300 (cartes 60×80) */
export const LANDING_DEMO_LAYOUT: Record<
  (typeof DEMO_IDS)[number],
  { left: number; top: number }
> = {
  feu: { left: 100, top: 28 },
  four: { left: 270, top: 28 },
  sable: { left: 24, top: 188 },
  verre: { left: 200, top: 188 },
  lentille: { left: 376, top: 188 },
  microscope: { left: 536, top: 188 },
};

/** Ordre d’apparition stagger (150 ms entre chaque) */
export const LANDING_DEMO_STAGGER_ORDER = [
  'sable',
  'feu',
  'four',
  'verre',
  'lentille',
  'microscope',
] as const satisfies readonly (typeof DEMO_IDS)[number][];

export function getLandingDemoTreeNodes(locale: string): LandingDemoTreeNode[] {
  const useFr = locale === 'fr';
  const byId = new Map(
    nodesIndex.nodes.map((n) => [n.id, n] as const)
  );

  return DEMO_IDS.map((id) => {
    const basic = byId.get(id);
    const det = nodesDetails[id as keyof typeof nodesDetails] as
      | {
          name_en?: string;
          description: string;
          description_en?: string;
        }
      | undefined;

    const name =
      useFr || !det?.name_en
        ? basic?.name ?? id
        : det.name_en;
    const description =
      useFr || !det?.description_en?.trim()
        ? det?.description ?? ''
        : det.description_en.trim();

    return {
      id,
      name,
      description,
      category: (basic?.category ?? 'industry') as NodeCategory,
    };
  });
}

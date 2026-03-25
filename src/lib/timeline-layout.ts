/**
 * Layout chronologique : X = temps (year_approx), Y = catégorie
 */

import type { Edge, Node } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { NodeCategory, Era, type CraftingLink, type TechNodeBasic } from '@/lib/types';

export const LAYOUT_MIN_YEAR = -12000;
export const LAYOUT_MAX_YEAR = 2030;

const ERA_MID_YEAR: Record<Era, number> = {
  [Era.PREHISTORIC]: -8000,
  [Era.ANCIENT]: -1200,
  [Era.MEDIEVAL]: 1000,
  [Era.RENAISSANCE]: 1625,
  [Era.INDUSTRIAL]: 1825,
  [Era.MODERN]: 1935,
  [Era.DIGITAL]: 1990,
  [Era.CONTEMPORARY]: 2018,
};

/** Segments d’époque (axe global), couleurs pour bandes à faible opacité */
export const TIMELINE_ERA_SEGMENTS: {
  start: number;
  end: number;
  label: string;
  color: string;
}[] = [
  { start: -12000, end: -3000, label: 'Préhistoire', color: '#64748B' },
  { start: -3000, end: 500, label: 'Antiquité', color: '#78716C' },
  { start: 500, end: 1500, label: 'Moyen Âge', color: '#7C3AED' },
  { start: 1500, end: 1750, label: 'Renaissance', color: '#B45309' },
  { start: 1750, end: 1900, label: 'Industriel', color: '#B91C1C' },
  { start: 1900, end: 1970, label: 'Moderne', color: '#0D9488' },
  { start: 1970, end: 2010, label: 'Numérique', color: '#2563EB' },
  { start: 2010, end: 2030, label: 'Contemporain', color: '#10B981' },
];

export const NODE_W = 200;
export const ROW_HEIGHT = 100;
export const TOP_PADDING = 40;
export const BOTTOM_AXIS = 52;

const ALL_CATEGORIES = Object.values(NodeCategory) as NodeCategory[];

/** Année utilisée pour le placement sur l’axe (extrêmes plafonnés pour lisibilité) */
export function layoutYear(n: TechNodeBasic): number {
  const raw = n.year_approx ?? ERA_MID_YEAR[n.era];
  return Math.min(Math.max(raw, LAYOUT_MIN_YEAR), LAYOUT_MAX_YEAR);
}

function spreadCollisions(
  items: { id: string; category: NodeCategory; year: number }[]
): Map<string, { xOffset: number }> {
  const bucket = 35;
  const groups = new Map<string, string[]>();
  for (const it of items) {
    const b = Math.floor(it.year / bucket) * bucket;
    const key = `${it.category}:${b}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it.id);
  }
  const out = new Map<string, { xOffset: number }>();
  for (const ids of groups.values()) {
    ids.sort();
    ids.forEach((id, i) => {
      out.set(id, { xOffset: i * 24 });
    });
  }
  return out;
}

export interface BuildTimelineResult {
  nodes: Node[];
  edges: Edge[];
  worldWidth: number;
  worldHeight: number;
  minYear: number;
  maxYear: number;
}

export function buildTimelineElements(
  graphNodes: TechNodeBasic[],
  links: CraftingLink[],
  pixelsPerYear: number
): BuildTimelineResult {
  const minYear = LAYOUT_MIN_YEAR;
  const maxYear = LAYOUT_MAX_YEAR;
  const span = maxYear - minYear;

  const catsInData = new Set(graphNodes.map((n) => n.category));
  const categoryRows = ALL_CATEGORIES.filter((c) => catsInData.has(c));

  const laneArea = categoryRows.length * ROW_HEIGHT;
  const worldHeight = TOP_PADDING + laneArea + BOTTOM_AXIS;
  const worldWidth = Math.max(800, span * pixelsPerYear);

  const items = graphNodes.map((n) => ({
    id: n.id,
    category: n.category,
    year: layoutYear(n),
  }));
  const collision = spreadCollisions(items);

  const byId = new Map(graphNodes.map((n) => [n, n]));

  const flowNodes: Node[] = [];

  /** Bandes d’époque (fond) */
  for (let i = 0; i < TIMELINE_ERA_SEGMENTS.length; i++) {
    const seg = TIMELINE_ERA_SEGMENTS[i];
    const x0 = ((seg.start - minYear) / span) * worldWidth;
    const x1 = ((seg.end - minYear) / span) * worldWidth;
    flowNodes.push({
      id: `__era-band-${i}`,
      type: 'eraBand',
      position: { x: x0, y: 0 },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -2,
      data: {
        width: Math.max(1, x1 - x0),
        height: worldHeight,
        color: seg.color,
      },
    });
  }

  const idSet = new Set(graphNodes.map((n) => n.id));

  for (const n of graphNodes) {
    const yRow = categoryRows.indexOf(n.category);
    if (yRow < 0) continue;

    const y =
      TOP_PADDING +
      yRow * ROW_HEIGHT +
      ROW_HEIGHT / 2 -
      28;

    const year = layoutYear(n);
    const cx = ((year - minYear) / span) * worldWidth;
    const xOff = collision.get(n.id)?.xOffset ?? 0;
    const x = cx - NODE_W / 2 + xOff;

    const model = byId.get(n)!;
    flowNodes.push({
      id: n.id,
      type: 'tech',
      position: { x, y },
      zIndex: 1,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        name: model.name,
        category: model.category,
        era: model.era,
        type: model.type,
        complexity_depth: model.complexity_depth,
        centralityNorm: 0.2,
      },
    });
  }

  const flowEdges: Edge[] = [];
  for (const link of links) {
    if (!idSet.has(link.source_id) || !idSet.has(link.target_id)) continue;

    const s = graphNodes.find((x) => x.id === link.source_id)!;
    flowEdges.push({
      id: link.id,
      type: 'tech',
      source: link.source_id,
      target: link.target_id,
      data: {
        relationType: link.relation_type,
        sourceCategory: s.category,
      },
    });
  }

  return {
    nodes: flowNodes,
    edges: flowEdges,
    worldWidth,
    worldHeight,
    minYear,
    maxYear,
  };
}

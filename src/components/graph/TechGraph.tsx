'use client';

import {
  useId,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useState,
  memo,
} from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  useStore,
  type ReactFlowInstance,
  type NodeMouseHandler,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TechNode } from './TechNode';
import { TechEdge } from './TechEdge';
import { LayerLabelNode } from './LayerLabelNode';
import type { TechNodeData } from './TechNode';
import type { TechEdgeData } from './TechEdge';
import {
  computeExploreFocusPositions,
  sortFocusNeighborIdsByCategory,
  EXPLORE_CARD_H,
  EXPLORE_CARD_W,
  EXPLORE_LAYER_EDGE_PAD_Y,
  type DepthLayerMeta,
} from '@/lib/graph-utils';
import { getFocusClusterBounds } from '@/lib/focus-view-bounds';
import {
  getDirectPredecessors,
  getDirectSuccessors,
} from '@/lib/graph-adjacency';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore, getNodeDetails } from '@/stores/graph-store';
import { trackEvent } from '@/lib/analytics';
import { useAuthStore } from '@/stores/auth-store';
import type {
  CraftingLink,
  Era,
  NodeCategory,
  TechNodeType,
} from '@/lib/types';
import {
  areAllFiltersActive,
  nodePassesFilters,
} from '@/lib/graph-filters';
import { Legend } from '@/components/ui/Legend';
import { AddConnectionButton } from './AddConnectionButton';
import { ConnectionSearchPopup } from './ConnectionSearchPopup';
import {
  buildFocusOverlayNodes,
  stripFocusOverlayNodes,
} from './focus-overlay-nodes';
import { useFocusLinkEditStore } from '@/stores/focus-link-edit-store';
import { useExploreFocusTransitionStore } from '@/stores/explore-focus-transition-store';
import { GraphControls } from './GraphControls';
import { BatchedDimEdgesOverlay } from './BatchedDimEdgesOverlay';

const nodeTypes = {
  tech: TechNode,
  layerLabel: LayerLabelNode,
  addButton: AddConnectionButton,
  searchPopup: ConnectionSearchPopup,
};
const edgeTypes = { tech: TechEdge };

const CLICK_DELAY_MS = 280;

const FOCUS_TRANS_TOTAL_MS = 1100;
const FOCUS_TRANS_SLIDE_DELAY_MS = 200;
const FOCUS_TRANS_SLIDE_DURATION_MS = 500;
const FOCUS_TRANS_NEIGHBOR_STAGGER_MS = 30;
const FOCUS_TRANS_APPEAR_STAGGER_MS = 80;
const FOCUS_TRANS_EDGE_AFTER_CARD_MS = 200;

function mergeNodeClass(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** Retire les classes de transition vue focalisée (sinon `node-appearing` maintient opacity:0 — globals.css). */
function stripFocusTransitionNodeClassName(className?: string): string | undefined {
  if (!className?.trim()) return undefined;
  const drop = new Set([
    'node-appearing',
    'focus-incoming-visible',
    'node-sliding-to-center',
    'will-change-[transform,opacity]',
  ]);
  const next = className.split(/\s+/).filter((p) => p && !drop.has(p));
  return next.length ? next.join(' ') : undefined;
}

/** Retire `style.pointerEvents` résiduel après la transition vue focalisée (sinon survol/clic bloqués). */
function stripTechNodePointerEventsStyle(nodes: Node[]): Node[] {
  return nodes.map((n) => {
    if (n.type !== 'tech' || !n.style) return n;
    const st = n.style as Record<string, unknown>;
    if (!('pointerEvents' in st)) return n;
    const rest = { ...st };
    delete rest.pointerEvents;
    return {
      ...n,
      style: Object.keys(rest).length > 0 ? rest : undefined,
    };
  });
}

/** Ordre de disparition : centre, puis intrants (x), puis produits (x). */
function buildNeighborFadeStaggerMap(
  fromId: string,
  toId: string,
  preds: string[],
  succs: string[],
  getX: (id: string) => number
): Map<string, number> {
  const m = new Map<string, number>();
  let order = 0;
  m.set(fromId, order++);
  const op = preds
    .filter((x) => x !== toId)
    .sort((a, b) => getX(a) - getX(b));
  for (const id of op) m.set(id, order++);
  const os = succs
    .filter((x) => x !== toId)
    .sort((a, b) => getX(a) - getX(b));
  for (const id of os) m.set(id, order++);
  return m;
}

/** Intrants puis produits (même ordre que le layout focal). */
function neighborAppearOrder(
  preds: string[],
  succs: string[],
  getCategory?: (id: string) => NodeCategory | undefined
): string[] {
  if (getCategory) {
    return [
      ...sortFocusNeighborIdsByCategory(preds, getCategory),
      ...sortFocusNeighborIdsByCategory(succs, getCategory),
    ];
  }
  return [
    ...[...preds].sort((a, b) => a.localeCompare(b, 'fr')),
    ...[...succs].sort((a, b) => a.localeCompare(b, 'fr')),
  ];
}

function findLinkIdBetweenNodes(
  a: string,
  b: string,
  links: CraftingLink[]
): string | null {
  for (const e of links) {
    if (
      (e.source_id === a && e.target_id === b) ||
      (e.source_id === b && e.target_id === a)
    ) {
      return e.id;
    }
  }
  return null;
}

function baseNodeData(data: Record<string, unknown>): TechNodeData {
  const d = data as unknown as TechNodeData;
  const r = data;
  return {
    name: d.name,
    category: d.category,
    era: d.era,
    type: d.type,
    complexity_depth: d.complexity_depth,
    centralityNorm: d.centralityNorm,
    isRawMaterial: d.isRawMaterial,
    treeLayer: d.treeLayer,
    year_approx: d.year_approx,
    image_url: d.image_url,
    imageBust: d.imageBust,
    origin: d.origin,
    focusInnerClass: r.focusInnerClass as TechNodeData['focusInnerClass'],
    focusStaggerDelayMs: r.focusStaggerDelayMs as TechNodeData['focusStaggerDelayMs'],
    focusSlideBorder: r.focusSlideBorder as TechNodeData['focusSlideBorder'],
    focusSlideActive: r.focusSlideActive as TechNodeData['focusSlideActive'],
    focusWillChange: r.focusWillChange as TechNodeData['focusWillChange'],
  };
}

/** Nœuds présents dans le graphe mais sans aucun lien (ni source ni cible). */
function computeIsolatedNodeIds(
  nodeIds: string[],
  edges: CraftingLink[]
): Set<string> {
  const incident = new Set<string>();
  for (const e of edges) {
    incident.add(e.source_id);
    incident.add(e.target_id);
  }
  const out = new Set<string>();
  for (const id of nodeIds) {
    if (!incident.has(id)) out.add(id);
  }
  return out;
}

function baseEdgeData(data: Record<string, unknown> | undefined): TechEdgeData {
  const d = (data ?? {}) as unknown as TechEdgeData;
  return {
    relationType: d.relationType,
    sourceCategory: d.sourceCategory,
    targetCategory: d.targetCategory,
    focusEdgeFadeOut: d.focusEdgeFadeOut,
    focusEdgeRevealDelayMs: d.focusEdgeRevealDelayMs,
  };
}

const LAYER_LABEL_W = 220;
const LAYER_LABEL_H = 28;

function computeGraphBounds(nodes: Node[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const isLabel = n.type === 'layerLabel';
    const isPopup = n.type === 'searchPopup';
    const w = isLabel ? LAYER_LABEL_W : isPopup ? 280 : EXPLORE_CARD_W;
    const h = isLabel ? LAYER_LABEL_H : isPopup ? 320 : EXPLORE_CARD_H;
    minX = Math.min(minX, n.position.x);
    maxX = Math.max(maxX, n.position.x + w);
    minY = Math.min(minY, n.position.y);
    maxY = Math.max(maxY, n.position.y + h);
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 800, minY: 0, maxY: 600 };
  }
  return { minX, maxX, minY, maxY };
}

export function decorateNodesAndEdges(
  nds: Node[],
  eds: Edge[],
  opts: {
    craftEdges: CraftingLink[];
    hoveredNodeId: string | null;
    neighborhoodRootId: string | null;
    neighborhoodVisible: Set<string> | null;
    selectedNodeId: string | null;
    activeCategories: ReadonlySet<NodeCategory>;
    activeEras: ReadonlySet<Era>;
    activeTypes: ReadonlySet<TechNodeType>;
    /** Couches visibles (0..N) hors vue focalisée */
    progressiveMaxLayer?: number | null;
    isSidebarOpen?: boolean;
    /** Vue /explore avec sidebar : focus intrants + produits directs */
    focusLayoutActive?: boolean;
    /** Animation du tracé pour un lien nouvellement créé */
    lastAnimatedEdgeId?: string | null;
    /** Anti-cache après upload d’image */
    imageBustByNodeId?: Record<string, number>;
    /** Vue /explore globale : marquer les nœuds sans lien (badge « ! »). */
    markIsolatedNodes?: boolean;
    /**
     * Vue /explore hors panneau focalisé : pas de plafond de couche ; filtres au
     * complet = tout visible ; filtres restreints = masquage comme avant.
     */
    exploreFullVisibility?: boolean;
    /** Vue /explore globale : masquer les arêtes non reliées au nœud survolé. */
    exploreHoveredNodeId?: string | null;
    /** Pour memo TechNode : icônes édition / suggestion alignées sur le rôle. */
    isAdmin?: boolean;
  }
): { nodes: Node[]; edges: Edge[] } {
  const {
    craftEdges,
    hoveredNodeId,
    neighborhoodRootId,
    neighborhoodVisible,
    selectedNodeId,
    activeCategories,
    activeEras,
    activeTypes,
    progressiveMaxLayer = null,
    isSidebarOpen = false,
    focusLayoutActive = false,
    lastAnimatedEdgeId = null,
    imageBustByNodeId = {},
    markIsolatedNodes = false,
    exploreFullVisibility = false,
    exploreHoveredNodeId: exploreHoveredNodeIdOpt = null,
    isAdmin = false,
  } = opts;

  const nodeDataById = new Map(
    nds.map((n) => [n.id, baseNodeData(n.data as Record<string, unknown>)])
  );

  const techIdsForIsolation = nds
    .filter((n) => n.type === 'tech' || n.type === undefined)
    .map((n) => n.id);
  const isolatedIds = computeIsolatedNodeIds(techIdsForIsolation, craftEdges);

  const exploreFocus =
    focusLayoutActive === true && Boolean(selectedNodeId && isSidebarOpen);
  const directPreds = selectedNodeId
    ? getDirectPredecessors(selectedNodeId, craftEdges)
    : [];
  const directSuccs = selectedNodeId
    ? getDirectSuccessors(selectedNodeId, craftEdges)
    : [];
  const exploreFocusSet =
    exploreFocus && selectedNodeId
      ? new Set<string>([
          selectedNodeId,
          ...directPreds,
          ...directSuccs,
        ])
      : null;

  const legacyFocusMode =
    !exploreFocus &&
    Boolean(selectedNodeId && !neighborhoodRootId);
  const legacyFocusSet =
    legacyFocusMode && selectedNodeId
      ? new Set<string>([selectedNodeId, ...directPreds])
      : null;

  const showIsolatedBadge =
    markIsolatedNodes &&
    !exploreFocus &&
    !legacyFocusMode &&
    neighborhoodRootId == null;

  /** Filtres par défaut (tout actif) : pas de masquage en vue globale ; sinon comme avant. */
  const exploreFiltersNarrowed =
    exploreFullVisibility &&
    !exploreFocus &&
    !areAllFiltersActive(activeCategories, activeEras, activeTypes);

  const effectiveHoverId = hoveredNodeId ?? exploreHoveredNodeIdOpt;
  const hoverInteractionActive = !exploreFocus && Boolean(effectiveHoverId);

  const nodes: Node[] = nds.map((n) => {
    if (n.type === 'layerLabel') {
      return {
        ...n,
        hidden: focusLayoutActive,
        selectable: false,
        data: n.data as unknown as Record<string, unknown>,
      };
    }

    const base = nodeDataById.get(n.id)!;
    const failsFilter = !nodePassesFilters(
      base.category,
      base.era,
      base.type,
      activeCategories,
      activeEras,
      activeTypes
    );

    let hidden = false;
    let dimmed = false;
    let neighborHighlight = false;
    let hoverCenter = false;
    let focusSelected = false;
    let focusPred = false;

    if (neighborhoodRootId && neighborhoodVisible) {
      hidden = !neighborhoodVisible.has(n.id);
    }

    const treeLayer = base.treeLayer ?? 0;
    if (
      !hidden &&
      progressiveMaxLayer != null &&
      progressiveMaxLayer >= 0 &&
      !exploreFocus &&
      !exploreFullVisibility
    ) {
      if (treeLayer > progressiveMaxLayer) hidden = true;
    }

    let focusExploreNeighbor = false;
    let focusLinkId: string | null = null;

    if (exploreFocus && exploreFocusSet && selectedNodeId && !hidden) {
      if (!exploreFocusSet.has(n.id)) {
        hidden = true;
      } else {
        focusSelected = n.id === selectedNodeId;
        if (n.id !== selectedNodeId) {
          focusExploreNeighbor = true;
          focusLinkId = findLinkIdBetweenNodes(
            selectedNodeId,
            n.id,
            craftEdges
          );
        }
      }
    }

    if (legacyFocusMode && legacyFocusSet && selectedNodeId && !hidden) {
      focusSelected = n.id === selectedNodeId;
      focusPred = directPreds.includes(n.id);
    }

    /**
     * Filtres : vue /explore globale + filtres par défaut (tout actif) = rien à masquer.
     * Sinon : masquer hors filtre (comme avant) ; vue focalisée : garder le sous-graphe.
     */
    if (!hidden && failsFilter) {
      if (exploreFullVisibility && !exploreFocus) {
        if (exploreFiltersNarrowed) {
          hidden = true;
        }
      } else {
        const forceFocusContext =
          exploreFocus &&
          exploreFocusSet !== null &&
          exploreFocusSet.has(n.id);
        if (!forceFocusContext) hidden = true;
      }
    }

    /** Timeline : `hoveredNodeId`. /explore : `exploreHoveredNodeIdOpt`. */
    if (!hidden && !exploreFocus && effectiveHoverId) {
      const preds = getDirectPredecessors(effectiveHoverId, craftEdges);
      const succs = getDirectSuccessors(effectiveHoverId, craftEdges);
      const related = new Set<string>([
        effectiveHoverId,
        ...preds,
        ...succs,
      ]);
      dimmed = !related.has(n.id);
      neighborHighlight = related.has(n.id) && n.id !== effectiveHoverId;
      hoverCenter = n.id === effectiveHoverId;
    }

    const bust = imageBustByNodeId[n.id] ?? 0;
    const isolatedNoLinks =
      showIsolatedBadge && !hidden && isolatedIds.has(n.id);

    const data: TechNodeData = {
      ...base,
      ...(bust > 0 ? { imageBust: bust } : {}),
      ...(dimmed ? { dimmed: true } : {}),
      ...(neighborHighlight ? { neighborHighlight: true } : {}),
      ...(hoverCenter ? { hoverCenter: true } : {}),
      ...(focusSelected ? { focusSelected: true } : {}),
      ...(focusPred ? { focusPred: true } : {}),
      ...(focusExploreNeighbor && focusLinkId
        ? { focusExploreNeighbor: true, focusLinkId }
        : {}),
      ...(isolatedNoLinks ? { isolatedNoLinks: true } : {}),
      ...(hoverInteractionActive ? { hoverInteractionActive: true } : {}),
      showAdminIcons: isAdmin,
    };

    return {
      ...n,
      hidden,
      selected: selectedNodeId ? n.id === selectedNodeId : false,
      data: data as unknown as Record<string, unknown>,
    };
  });

  const hiddenIds = new Set(nodes.filter((x) => x.hidden).map((x) => x.id));

  const edges: Edge[] = eds.map((e) => {
    const base = baseEdgeData(e.data as Record<string, unknown> | undefined);
    let hidden = false;
    let dimmed = false;
    let emphasized = false;
    let focusMuted = false;

    if (neighborhoodRootId && neighborhoodVisible) {
      const sv = neighborhoodVisible.has(e.source);
      const tv = neighborhoodVisible.has(e.target);
      hidden = !sv || !tv;
    }

    if (!hidden && (hiddenIds.has(e.source) || hiddenIds.has(e.target))) {
      hidden = true;
    }

    if (
      !hidden &&
      !exploreFocus &&
      exploreHoveredNodeIdOpt &&
      neighborhoodRootId == null
    ) {
      const incident =
        e.source === exploreHoveredNodeIdOpt ||
        e.target === exploreHoveredNodeIdOpt;
      if (!incident) hidden = true;
    }

    const sMeta = nodeDataById.get(e.source);
    const tMeta = nodeDataById.get(e.target);
    const sInFocus = exploreFocus && exploreFocusSet?.has(e.source);
    const tInFocus = exploreFocus && exploreFocusSet?.has(e.target);
    const sFail =
      !sMeta ||
      !(
        sInFocus ||
        nodePassesFilters(
          sMeta.category,
          sMeta.era,
          sMeta.type,
          activeCategories,
          activeEras,
          activeTypes
        )
      );
    const tFail =
      !tMeta ||
      !(
        tInFocus ||
        nodePassesFilters(
          tMeta.category,
          tMeta.era,
          tMeta.type,
          activeCategories,
          activeEras,
          activeTypes
        )
      );
    const filterDimmedEdge = sFail || tFail;

    const incidentToSelected =
      Boolean(selectedNodeId) &&
      (e.source === selectedNodeId || e.target === selectedNodeId);

    /** Même logique que les nœuds : /explore passe hoveredNodeId null. */
    if (!hidden && !exploreFocus && hoveredNodeId) {
      emphasized = e.source === hoveredNodeId || e.target === hoveredNodeId;
      dimmed = !emphasized;
    }

    const bothEndpointsInFocus =
      exploreFocus &&
      exploreFocusSet &&
      exploreFocusSet.has(e.source) &&
      exploreFocusSet.has(e.target);

    if (exploreFocus && selectedNodeId && !hidden && !filterDimmedEdge) {
      focusMuted = false;
      emphasized = Boolean(bothEndpointsInFocus);
      dimmed = false;
    }

    const flowParticles =
      exploreFocus &&
      Boolean(selectedNodeId) &&
      !hidden &&
      !filterDimmedEdge &&
      incidentToSelected;

    const data: TechEdgeData = {
      ...base,
      ...(dimmed ? { dimmed: true } : {}),
      ...(emphasized ? { emphasized: true } : {}),
      ...(focusMuted ? { focusMuted: true } : {}),
      ...(flowParticles ? { flowParticles: true } : {}),
      ...(lastAnimatedEdgeId === e.id ? { animateDraw: true } : {}),
    };

    return {
      ...e,
      hidden,
      data: data as unknown as Record<string, unknown>,
    };
  });

  return { nodes, edges };
}

/**
 * Bandes alignées sur chaque rangée de profondeur : carte + marge haut/bas.
 * Couche affichée = profondeur + 1 (Couche 1 = matières premières).
 */
function TreeLayerChrome({
  layerMetas,
  bounds,
}: {
  layerMetas: DepthLayerMeta[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}) {
  const labelClipId = useId().replace(/:/g, '');
  const transform = useStore((s) => s.transform);
  const [tx, ty, zoom] = transform;
  const padL = 220;
  const w = bounds.maxX - bounds.minX + padL * 2;
  const maxY = bounds.maxY;

  const safeZoom = Math.max(0.08, Math.min(zoom, 4));
  /**
   * Sans plafond, 11/zoom en unités flux devient énorme au dézoom : le libellé
   * déborde vers la droite et recouvre les cartes. On borne la taille flux et on
   * clippe la colonne de texte (voir clipPath ci-dessous).
   */
  const labelFont = Math.min(11 / safeZoom, 16);
  const labelColumnWidth = 188;

  const pad = EXPLORE_LAYER_EDGE_PAD_Y;
  const sorted = [...layerMetas].sort((a, b) => a.yTop - b.yTop);
  const bands = sorted.map((m, i) => {
    const yTop = m.yTop - pad;
    const yBottom = m.yBottom + pad;
    const couche = m.depth + 1;
    return { yTop, yBottom, couche, depth: m.depth, stripe: i };
  });

  if (bands.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-visible">
      <div
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <svg
          className="absolute overflow-visible"
          style={{
            left: bounds.minX - padL,
            top: 0,
            width: w,
            height: maxY + 200,
            pointerEvents: 'none',
          }}
          aria-hidden
        >
          <defs>
            <clipPath id={labelClipId}>
              <rect x={0} y={-1e6} width={labelColumnWidth} height={2e6} />
            </clipPath>
          </defs>
          {bands.map(({ yTop, yBottom, couche, stripe, depth }) => (
            <g key={`band-${depth}-${couche}`}>
              <rect
                x={0}
                y={yTop}
                width={w}
                height={yBottom - yTop}
                fill={stripe % 2 === 0 ? '#6366F1' : '#0F172A'}
                fillOpacity={stripe % 2 === 0 ? 0.04 : 0.07}
              />
              <g clipPath={`url(#${labelClipId})`}>
                <text
                  x={12}
                  y={(yTop + yBottom) / 2}
                  dominantBaseline="middle"
                  fill="#94A3B8"
                  fontSize={labelFont}
                  fontWeight={600}
                  style={{
                    fontFamily:
                      'var(--font-inter), Inter, system-ui, sans-serif',
                  }}
                >
                  {`Couche ${couche}`}
                </text>
              </g>
            </g>
          ))}
          {bands.slice(1).map(({ yTop }) => (
            <line
              key={`sep-${yTop}`}
              x1={0}
              y1={yTop}
              x2={w}
              y2={yTop}
              stroke="#6366F1"
              strokeWidth={1}
              strokeOpacity={0.42}
              strokeDasharray="8 5"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}

function TechGraphInner() {
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const originalPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  const { navigateToNode, closeDetail } = useExploreNavigation();
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const exploreHoveredNodeId = useUIStore((s) => s.exploreHoveredNodeId);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const graphPointerLock = useUIStore((s) => s.isAnimating);
  const activeCategories = useUIStore((s) => s.activeCategories);
  const activeEras = useUIStore((s) => s.activeEras);
  const activeTypes = useUIStore((s) => s.activeTypes);

  const craftEdges = useGraphStore((s) => s.edges);
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  /** Invités : pas d’ajout de liens depuis le graphe (uniquement suggestion depuis la fiche). */
  const allowFocusAddLinks = Boolean(user);
  const graphNodes = useGraphStore((s) => s.nodes);
  const getCategoryForFocus = useCallback(
    (id: string) =>
      graphNodes.find((n) => n.id === id)?.category as NodeCategory | undefined,
    [graphNodes]
  );
  const exploreFlowNodes = useGraphStore((s) => s.exploreFlowNodes);
  const exploreFlowEdges = useGraphStore((s) => s.exploreFlowEdges);
  const layerMetas = useGraphStore((s) => s.exploreLayerMetas);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);
  const prevExploreFlowRef = useRef(exploreFlowNodes);
  /** True si le layout focalisé a été appliqué dans useLayoutEffect (ref + conteneur dispo). */
  const focusPositionsAppliedRef = useRef(false);

  const graphBounds = useMemo(
    () => computeGraphBounds(exploreFlowNodes),
    [exploreFlowNodes]
  );

  const setExploreHoveredNodeId = useUIStore((s) => s.setExploreHoveredNodeId);
  const exploreNeighborhoodFitId = useUIStore((s) => s.exploreNeighborhoodFitId);
  const clearExploreNeighborhoodFit = useUIStore(
    (s) => s.clearExploreNeighborhoodFit
  );
  const exploreFocusExitCenterId = useUIStore(
    (s) => s.exploreFocusExitCenterId
  );
  const clearExploreFocusExitCenter = useUIStore(
    (s) => s.clearExploreFocusExitCenter
  );
  /** Vue large /explore uniquement : masque les arêtes sans affecter /tree/[id]. */
  const [showConnections, setShowConnections] = useState(true);
  /** Arêtes « dimmed » rendues en un seul path SVG (voir BatchedDimEdgesOverlay). */
  const [batchedDimEdges, setBatchedDimEdges] = useState<Edge[]>([]);
  const prefetchHoverRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const focusLayoutActive = Boolean(isSidebarOpen && selectedNodeId);

  const focusViewKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusLayoutActive || !selectedNodeId) {
      focusViewKeyRef.current = null;
      return;
    }
    const k = selectedNodeId;
    if (focusViewKeyRef.current !== k) {
      focusViewKeyRef.current = k;
      trackEvent('focus_view', selectedNodeId);
    }
  }, [focusLayoutActive, selectedNodeId]);

  /** En vue focalisée, ignorer le survol pour ne pas relancer le layout (évite le recentrage au hover). */
  const graphLayoutHoverDep = focusLayoutActive ? 0 : exploreHoveredNodeId;

  const searchMode = useFocusLinkEditStore((s) => s.searchMode);
  const relationPick = useFocusLinkEditStore((s) => s.relationPick);
  const lastCreatedEdgeId = useFocusLinkEditStore((s) => s.lastCreatedEdgeId);

  const closeFocusLinkEdit = useCallback(() => {
    useFocusLinkEditStore.getState().close();
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(exploreFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(exploreFlowEdges);

  nodesRef.current = nodes;
  edgesRef.current = edges;

  useEffect(() => {
    if (!lastCreatedEdgeId) return;
    const t = window.setTimeout(() => {
      useFocusLinkEditStore.getState().setLastCreatedEdgeId(null);
    }, 500);
    return () => clearTimeout(t);
  }, [lastCreatedEdgeId]);

  /** Recherche : cadrer le voisinage direct (comme le survol). */
  useEffect(() => {
    if (!exploreNeighborhoodFitId) return;
    const id = exploreNeighborhoodFitId;
    let cancelled = false;
    let attempts = 0;
    const tryFit = () => {
      if (cancelled) return;
      const rf = reactFlowRef.current;
      if (!rf) {
        if (attempts++ < 24) window.setTimeout(tryFit, 50);
        else clearExploreNeighborhoodFit();
        return;
      }
      const ids = new Set<string>([
        id,
        ...getDirectPredecessors(id, craftEdges),
        ...getDirectSuccessors(id, craftEdges),
      ]);
      const flowNodes = rf
        .getNodes()
        .filter((n) => n.type === 'tech' && ids.has(n.id));
      if (flowNodes.length === 0) {
        clearExploreNeighborhoodFit();
        return;
      }
      rf.fitView({
        nodes: flowNodes,
        padding: 0.22,
        duration: 520,
        minZoom: 0.02,
      });
      clearExploreNeighborhoodFit();
    };
    requestAnimationFrame(() => requestAnimationFrame(tryFit));
    return () => {
      cancelled = true;
    };
  }, [exploreNeighborhoodFitId, craftEdges, clearExploreNeighborhoodFit]);

  /**
   * Après sortie de la vue focalisée (ou retour pile mobile), recentre la carte
   * sur le nœud concerné dans la vue globale avec une animation fluide.
   */
  useEffect(() => {
    if (!exploreFocusExitCenterId) return;
    if (focusLayoutActive) return;

    let cancelled = false;
    let attempts = 0;
    const id = exploreFocusExitCenterId;
    const tryFit = () => {
      if (cancelled) return;
      const rf = reactFlowRef.current;
      if (!rf?.viewportInitialized) {
        if (attempts++ < 48) requestAnimationFrame(tryFit);
        else clearExploreFocusExitCenter();
        return;
      }
      const flowNode = rf.getNode(id);
      if (!flowNode) {
        clearExploreFocusExitCenter();
        return;
      }
      void rf.fitView({
        nodes: [{ id }],
        padding: 0.2,
        duration: 640,
        minZoom: 0.02,
        maxZoom: 1.65,
      });
      clearExploreFocusExitCenter();
    };

    const t = window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(tryFit));
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [exploreFocusExitCenterId, focusLayoutActive, clearExploreFocusExitCenter]);

  const transitionFromId = useExploreFocusTransitionStore((s) => s.fromId);
  const transitionToId = useExploreFocusTransitionStore((s) => s.toId);
  const focusTransitionAnimating = useExploreFocusTransitionStore(
    (s) => s.isAnimating
  );
  const beginTransition = useExploreFocusTransitionStore(
    (s) => s.beginTransition
  );
  const resetTransition = useExploreFocusTransitionStore((s) => s.reset);

  const transitionTimersRef = useRef<number[]>([]);
  const focusTransitionStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      for (const t of transitionTimersRef.current) clearTimeout(t);
      transitionTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    return useExploreFocusTransitionStore.subscribe((state) => {
      const p = state.pendingTransition;
      if (!p) return;
      for (const t of transitionTimersRef.current) clearTimeout(t);
      transitionTimersRef.current = [];
      const { fromId, toId, openEdit, openSuggest } = p;
      beginTransition(fromId, toId);
      focusTransitionStartedAtRef.current = performance.now();

      const pushT = (id: number) => {
        transitionTimersRef.current.push(id);
      };

      const run = () => {
        const rf = reactFlowRef.current;
        const edges = useGraphStore.getState().edges;
        if (!rf?.viewportInitialized) {
          requestAnimationFrame(run);
          return;
        }
        const fromCenter = rf.getNode(fromId);
        if (!fromCenter) {
          navigateToNode(toId, {
            center: false,
            skipFocusTransition: true,
            openEdit,
            openSuggest,
          });
          focusTransitionStartedAtRef.current = null;
          resetTransition();
          return;
        }
        const endPos = { ...fromCenter.position };
        const preds = getDirectPredecessors(fromId, edges);
        const succs = getDirectSuccessors(fromId, edges);
        const focusSet = new Set<string>([fromId, ...preds, ...succs]);
        const getX = (id: string) => rf.getNode(id)?.position.x ?? 0;
        const stagger = buildNeighborFadeStaggerMap(
          fromId,
          toId,
          preds,
          succs,
          getX
        );
        setNodes((prev) =>
          prev.map((n) => {
            if (typeof n.id === 'string' && n.id.startsWith('__focus-'))
              return n;
            if (n.type !== 'tech') return n;
            const id = n.id;
            const baseData = {
              ...(n.data as Record<string, unknown>),
            } as Record<string, unknown>;
            if (id === fromId) {
              return {
                ...n,
                className: mergeNodeClass(
                  n.className,
                  'will-change-[transform,opacity]'
                ),
                data: {
                  ...baseData,
                  focusInnerClass: 'node-center-fading',
                  focusWillChange: true,
                },
                style: { ...n.style, pointerEvents: 'none' },
              };
            }
            if (id === toId) {
              return {
                ...n,
                className: mergeNodeClass(
                  n.className,
                  'will-change-[transform,opacity]'
                ),
                data: {
                  ...baseData,
                  focusSlideActive: true,
                },
                style: {
                  ...n.style,
                  transition:
                    'transform 500ms cubic-bezier(0.4, 0, 0.2, 1)',
                  zIndex: 50,
                },
              };
            }
            if (stagger.has(id)) {
              const ord = stagger.get(id)!;
              return {
                ...n,
                data: {
                  ...baseData,
                  focusInnerClass: 'node-fading-out',
                  focusStaggerDelayMs: ord * FOCUS_TRANS_NEIGHBOR_STAGGER_MS,
                  focusWillChange: true,
                },
                style: { ...n.style, pointerEvents: 'none' },
              };
            }
            return n;
          })
        );

        setEdges((prev) =>
          prev.map((e) => {
            if (!focusSet.has(e.source) || !focusSet.has(e.target)) return e;
            return {
              ...e,
              data: {
                ...(e.data as Record<string, unknown>),
                focusEdgeFadeOut: true,
              } as Record<string, unknown>,
            };
          })
        );

        pushT(
          window.setTimeout(() => {
            setNodes((prev) =>
              prev.map((n) => {
                if (n.id !== toId) return n;
                const d = {
                  ...(n.data as Record<string, unknown>),
                } as Record<string, unknown>;
                return {
                  ...n,
                  position: endPos,
                  className: mergeNodeClass(
                    n.className,
                    'node-sliding-to-center'
                  ),
                  data: {
                    ...d,
                    focusSlideBorder: true,
                  },
                };
              })
            );
          }, FOCUS_TRANS_SLIDE_DELAY_MS)
        );

        const newPreds = getDirectPredecessors(toId, edges);
        const newSuccs = getDirectSuccessors(toId, edges);
        const storeNodes = useGraphStore.getState().nodes;
        const getCat = (id: string) =>
          storeNodes.find((n) => n.id === id)?.category as
            | NodeCategory
            | undefined;
        const appearOrder = neighborAppearOrder(newPreds, newSuccs, getCat);

        pushT(
          window.setTimeout(() => {
            navigateToNode(toId, {
              center: false,
              skipFocusTransition: true,
              openEdit,
              openSuggest,
            });
            appearOrder.forEach((nid, i) => {
              pushT(
                window.setTimeout(() => {
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === nid
                        ? {
                            ...n,
                            className: mergeNodeClass(
                              n.className,
                              'focus-incoming-visible'
                            ),
                          }
                        : n
                    )
                  );
                }, 80 + i * FOCUS_TRANS_APPEAR_STAGGER_MS)
              );
            });
          }, FOCUS_TRANS_SLIDE_DELAY_MS + FOCUS_TRANS_SLIDE_DURATION_MS)
        );

        const firstAppearDelay = 80;
        const lastCardMs =
          appearOrder.length > 0
            ? firstAppearDelay +
              (appearOrder.length - 1) * FOCUS_TRANS_APPEAR_STAGGER_MS
            : 0;
        const lastEdgeMs =
          lastCardMs + FOCUS_TRANS_EDGE_AFTER_CARD_MS;
        const endMs = Math.max(
          FOCUS_TRANS_TOTAL_MS,
          FOCUS_TRANS_SLIDE_DELAY_MS +
            FOCUS_TRANS_SLIDE_DURATION_MS +
            lastEdgeMs +
            120
        );

        pushT(
          window.setTimeout(() => {
            focusTransitionStartedAtRef.current = null;
            resetTransition();
            const rf2 = reactFlowRef.current;
            if (!rf2?.viewportInitialized) return;
            const np = getDirectPredecessors(toId, edges);
            const ns = getDirectSuccessors(toId, edges);
            const focusIds = new Set<string>([toId, ...np, ...ns]);
            const flowNodes = rf2
              .getNodes()
              .filter(
                (n) =>
                  (n.type === 'tech' && focusIds.has(n.id)) ||
                  (typeof n.id === 'string' && n.id.startsWith('__focus-'))
              );
            if (flowNodes.length === 0) return;
            const bounds = getFocusClusterBounds(flowNodes);
            if (bounds) {
              void rf2.fitBounds(bounds, { padding: 0.14, duration: 420 });
            } else {
              void rf2.fitView({
                nodes: flowNodes,
                padding: 0.14,
                duration: 420,
                minZoom: 0.08,
                maxZoom: 1.65,
              });
            }
          }, endMs)
        );
      };

      requestAnimationFrame(() => requestAnimationFrame(run));
    });
  }, [beginTransition, navigateToNode, resetTransition, setNodes, setEdges]);

  useLayoutEffect(() => {
    const tf = useExploreFocusTransitionStore.getState();
    const outgoingAnim =
      tf.isAnimating &&
      tf.fromId &&
      tf.toId &&
      selectedNodeId === tf.fromId;

    const exploreUpdated = prevExploreFlowRef.current !== exploreFlowNodes;
    prevExploreFlowRef.current = exploreFlowNodes;

    const rawBase = outgoingAnim
      ? stripFocusOverlayNodes(nodesRef.current)
      : !focusLayoutActive || exploreUpdated
        ? exploreFlowNodes
        : nodesRef.current;
    const baseNodes = stripFocusOverlayNodes(rawBase);
    let baseEdges =
      outgoingAnim
        ? edgesRef.current
        : !focusLayoutActive || exploreUpdated
          ? exploreFlowEdges
          : edgesRef.current;

    /**
     * Masquer les liens fait setEdges([]) : edgesRef devient vide. En vue focalisée on
     * réutilisait ce ref vide comme base → les liens ne réapparaissaient pas au réaffichage.
     */
    if (
      !outgoingAnim &&
      baseEdges.length === 0 &&
      exploreFlowEdges.length > 0
    ) {
      baseEdges = exploreFlowEdges;
    }

    if (!focusLayoutActive || exploreUpdated) {
      const m = originalPositionsRef.current;
      m.clear();
      for (const n of exploreFlowNodes) {
        m.set(n.id, { x: n.position.x, y: n.position.y });
      }
    }

    const { nodes: nextNodes, edges: nextEdges } = decorateNodesAndEdges(
      baseNodes,
      baseEdges,
      {
        craftEdges,
        hoveredNodeId: null,
        exploreHoveredNodeId: focusLayoutActive ? null : exploreHoveredNodeId,
        neighborhoodRootId: null,
        neighborhoodVisible: null,
        selectedNodeId,
        activeCategories,
        activeEras,
        activeTypes,
        progressiveMaxLayer: null,
        isSidebarOpen,
        focusLayoutActive,
        lastAnimatedEdgeId: lastCreatedEdgeId,
        imageBustByNodeId,
        markIsolatedNodes: true,
        exploreFullVisibility: !focusLayoutActive,
        isAdmin,
      }
    );

    let rfEdges = nextEdges;
    if (!focusLayoutActive && showConnections && nextEdges.length > 300) {
      const dim: Edge[] = [];
      const rest: Edge[] = [];
      for (const e of nextEdges) {
        const ed = e.data as unknown as TechEdgeData | undefined;
        if (ed?.dimmed && !ed?.emphasized) dim.push(e);
        else rest.push(e);
      }
      if (dim.length >= 40) {
        rfEdges = rest;
        setBatchedDimEdges(dim);
      } else {
        setBatchedDimEdges([]);
      }
    } else {
      setBatchedDimEdges([]);
    }

    const edgesForFlow = focusLayoutActive ? nextEdges : rfEdges;

    let mergedNodes = nextNodes;
    focusPositionsAppliedRef.current = false;
    if (focusLayoutActive && selectedNodeId) {
      const rf = reactFlowRef.current;
      const wrap = graphContainerRef.current;
      let base = stripFocusOverlayNodes(mergedNodes);
      if (rf && wrap) {
        const rect = wrap.getBoundingClientRect();
        const center = rf.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
        const preds = getDirectPredecessors(selectedNodeId, craftEdges);
        const succs = getDirectSuccessors(selectedNodeId, craftEdges);
        const posMap = computeExploreFocusPositions(
          selectedNodeId,
          preds,
          succs,
          center,
          { getCategory: getCategoryForFocus }
        );
        const incomingReveal =
          tf.isAnimating &&
          tf.toId === selectedNodeId &&
          Boolean(tf.fromId);

        const outgoingPreserve =
          outgoingAnim &&
          tf.fromId === selectedNodeId &&
          tf.toId;
        const oldPreds = outgoingPreserve
          ? getDirectPredecessors(tf.fromId!, craftEdges)
          : [];
        const oldSuccs = outgoingPreserve
          ? getDirectSuccessors(tf.fromId!, craftEdges)
          : [];
        const oldFocusSet = outgoingPreserve
          ? new Set<string>([tf.fromId!, ...oldPreds, ...oldSuccs])
          : null;

        base = base.map((n) => {
          if (n.type !== 'tech') return n;
          if (oldFocusSet?.has(n.id)) {
            const live = nodesRef.current.find((l) => l.id === n.id);
            const decorated = nextNodes.find((x) => x.id === n.id);
            if (live) {
              const cleanedLiveClass = stripFocusTransitionNodeClassName(
                live.className
              );
              return {
                ...n,
                position: live.position,
                className:
                  incomingReveal && n.id !== selectedNodeId
                    ? live.className
                    : cleanedLiveClass,
                style: live.style,
                data: {
                  ...((decorated?.data ?? n.data) as Record<string, unknown>),
                  ...(live.data as Record<string, unknown>),
                } as Record<string, unknown>,
              };
            }
          }
          const p = posMap.get(n.id);
          const nextPos = p ?? {
            x: n.position.x,
            y: n.position.y,
          };
          const cleanedClass = stripFocusTransitionNodeClassName(n.className);
          if (incomingReveal && n.id !== selectedNodeId) {
            return {
              ...n,
              position: nextPos,
              className: mergeNodeClass(cleanedClass, 'node-appearing'),
            };
          }
          return { ...n, position: nextPos, className: cleanedClass };
        });
        focusPositionsAppliedRef.current = true;
      }
      const sel = base.find(
        (n) => n.id === selectedNodeId && n.type === 'tech'
      );
      if (sel) {
        mergedNodes = [
          ...base,
          ...buildFocusOverlayNodes(sel, searchMode, relationPick, {
            allowAddLinks: allowFocusAddLinks,
          }),
        ];
      } else {
        mergedNodes = base;
      }
    }

    let outEdges: Edge[];
    if (!showConnections) {
      outEdges = [];
    } else {
      outEdges = edgesForFlow.map((e) => ({
        ...e,
        hidden: Boolean(e.hidden),
      }));
    }

    const tf2 = useExploreFocusTransitionStore.getState();
    if (
      focusLayoutActive &&
      selectedNodeId &&
      tf2.isAnimating &&
      tf2.toId === selectedNodeId &&
      tf2.fromId
    ) {
      const preds = getDirectPredecessors(selectedNodeId, craftEdges);
      const succs = getDirectSuccessors(selectedNodeId, craftEdges);
      const order = neighborAppearOrder(preds, succs, getCategoryForFocus);
      const started = focusTransitionStartedAtRef.current;
      const elapsed = started != null ? performance.now() - started : 0;
      outEdges = outEdges.map((e) => {
        const d = (e.data ?? {}) as Record<string, unknown>;
        if (d.focusEdgeFadeOut === true) return e;
        const other =
          e.source === selectedNodeId
            ? e.target
            : e.target === selectedNodeId
              ? e.source
              : null;
        if (!other || other === selectedNodeId) return e;
        const idx = order.indexOf(other);
        if (idx < 0) return e;
        const revealAt =
          FOCUS_TRANS_SLIDE_DELAY_MS +
          FOCUS_TRANS_SLIDE_DURATION_MS +
          80 +
          idx * FOCUS_TRANS_APPEAR_STAGGER_MS +
          FOCUS_TRANS_EDGE_AFTER_CARD_MS;
        const delayMs = Math.max(0, revealAt - elapsed);
        return {
          ...e,
          data: {
            ...d,
            focusEdgeRevealDelayMs: delayMs,
          } as Record<string, unknown>,
        };
      });
    }

    const uiAnim = useUIStore.getState().isAnimating;
    const tfState = useExploreFocusTransitionStore.getState();
    const nodesToCommit =
      focusLayoutActive &&
      selectedNodeId &&
      !uiAnim &&
      !tfState.isAnimating
        ? stripTechNodePointerEventsStyle(mergedNodes)
        : mergedNodes;

    setNodes(nodesToCommit);
    setEdges(outEdges);
  }, [
    selectedNodeId,
    graphLayoutHoverDep,
    exploreHoveredNodeId,
    activeCategories,
    activeEras,
    activeTypes,
    craftEdges,
    isSidebarOpen,
    focusLayoutActive,
    showConnections,
    exploreFlowNodes,
    exploreFlowEdges,
    setNodes,
    setEdges,
    searchMode,
    relationPick,
    lastCreatedEdgeId,
    imageBustByNodeId,
    focusTransitionAnimating,
    transitionFromId,
    transitionToId,
    getCategoryForFocus,
    allowFocusAddLinks,
    isAdmin,
  ]);

  /**
   * Cadrage vue focalisée : les positions sont appliquées dans useLayoutEffect quand la ref
   * React Flow est prête ; ici on ne repositionne que si ce n’était pas le cas, puis fitView
   * après micro-tâches / frames pour que les mesures de nœuds soient à jour.
   */
  useEffect(() => {
    if (!focusLayoutActive || !selectedNodeId) return;
    if (focusTransitionAnimating) return;

    let cancelled = false;
    let fitTimeout: number | undefined;

    const fitFocusedSubgraph = () => {
      if (cancelled) return;
      const rf2 = reactFlowRef.current;
      if (!rf2) return;
      if (!rf2.viewportInitialized) return;
      const preds = getDirectPredecessors(selectedNodeId, craftEdges);
      const succs = getDirectSuccessors(selectedNodeId, craftEdges);
      const focusIds = new Set<string>([
        selectedNodeId,
        ...preds,
        ...succs,
      ]);
      const flowNodes = rf2.getNodes().filter(
        (n) =>
          (n.type === 'tech' && focusIds.has(n.id)) ||
          (typeof n.id === 'string' && n.id.startsWith('__focus-'))
      );
      if (flowNodes.length === 0) return;
      /** Bornes explicites : fitView sur nœuds sans mesure DOM utilisait width/height ~0 → zoom illisible. */
      const bounds = getFocusClusterBounds(flowNodes);
      if (bounds) {
        void rf2.fitBounds(bounds, {
          padding: 0.14,
          duration: 420,
        });
      } else {
        void rf2.fitView({
          nodes: flowNodes,
          padding: 0.14,
          duration: 420,
          minZoom: 0.08,
          maxZoom: 1.65,
        });
      }
    };

    /** Tant que le viewport n’est pas prêt, réessayer (évite fitBounds no-op). */
    const fitWithViewportRetry = (attempt = 0) => {
      if (cancelled) return;
      const rf2 = reactFlowRef.current;
      if (!rf2) return;
      if (!rf2.viewportInitialized && attempt < 40) {
        requestAnimationFrame(() => fitWithViewportRetry(attempt + 1));
        return;
      }
      fitFocusedSubgraph();
    };

    /** Retourne true si setNodes a été appelé (attendre un peu avant fitView). */
    const runFallbackPositioning = (): boolean => {
      if (cancelled) return false;
      if (focusPositionsAppliedRef.current) return false;
      const rf = reactFlowRef.current;
      const wrap = graphContainerRef.current;
      if (!rf || !wrap) return false;
      const rect = wrap.getBoundingClientRect();
      const center = rf.screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      const preds = getDirectPredecessors(selectedNodeId, craftEdges);
      const succs = getDirectSuccessors(selectedNodeId, craftEdges);
      const posMap = computeExploreFocusPositions(
        selectedNodeId,
        preds,
        succs,
        center,
        { getCategory: getCategoryForFocus }
      );
      const stripped = stripFocusOverlayNodes(nodesRef.current);
      const moved = stripped.map((n) => {
        const p = posMap.get(n.id);
        if (p) return { ...n, position: p };
        const orig = originalPositionsRef.current.get(n.id);
        return {
          ...n,
          position: orig ? { ...orig } : n.position,
        };
      });
      const sel = moved.find(
        (n) => n.id === selectedNodeId && n.type === 'tech'
      );
      if (!sel) return false;
      setNodes([
        ...moved,
        ...buildFocusOverlayNodes(
          sel,
          useFocusLinkEditStore.getState().searchMode,
          useFocusLinkEditStore.getState().relationPick,
          { allowAddLinks: allowFocusAddLinks }
        ),
      ]);
      focusPositionsAppliedRef.current = true;
      return true;
    };

    const scheduleFit = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          queueMicrotask(() => {
            requestAnimationFrame(() => {
              if (!cancelled) fitWithViewportRetry();
            });
          });
        });
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const fallbackJustApplied = runFallbackPositioning();
        fitTimeout = window.setTimeout(
          () => scheduleFit(),
          fallbackJustApplied ? 48 : 0
        );
      });
    });

    return () => {
      cancelled = true;
      if (fitTimeout !== undefined) clearTimeout(fitTimeout);
    };
  }, [
    focusLayoutActive,
    selectedNodeId,
    craftEdges,
    setNodes,
    searchMode,
    relationPick,
    focusTransitionAnimating,
    getCategoryForFocus,
    allowFocusAddLinks,
  ]);

  /** Invité : fermer une éventuelle recherche de lien ouverte (plus de boutons « + »). */
  useEffect(() => {
    if (user) return;
    if (!focusLayoutActive) return;
    closeFocusLinkEdit();
  }, [user, focusLayoutActive, closeFocusLinkEdit]);

  useEffect(() => {
    if (focusLayoutActive) return;
    setNodes((prev) =>
      prev.map((n) => {
        const orig = originalPositionsRef.current.get(n.id);
        if (!orig) return n;
        return { ...n, position: { ...orig } };
      })
    );
  }, [focusLayoutActive, setNodes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const le = useFocusLinkEditStore.getState();
      if (le.searchMode || le.relationPick) {
        le.close();
        return;
      }
      if (focusLayoutActive) return;
      closeDetail();
      setExploreHoveredNodeId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    closeDetail,
    setExploreHoveredNodeId,
    focusLayoutActive,
  ]);

  const scheduleSingleClick = useCallback(
    (nodeId: string, nodeType?: string) => {
      if (useExploreFocusTransitionStore.getState().isAnimating) return;
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        if (nodeType === 'tech') {
          trackEvent('node_click', nodeId);
        }
        navigateToNode(nodeId, { center: false });
      }, CLICK_DELAY_MS);
    },
    [navigateToNode]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (e, node) => {
      if (node.type === 'addButton' || node.type === 'searchPopup') {
        e.stopPropagation();
        return;
      }
      scheduleSingleClick(node.id, node.type ?? undefined);
    },
    [scheduleSingleClick]
  );

  const onNodeMouseEnter: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type === 'layerLabel') return;
      if (focusLayoutActive) return;
      setExploreHoveredNodeId(node.id);
      if (node.type === 'tech' && node.id) {
        if (prefetchHoverRef.current) clearTimeout(prefetchHoverRef.current);
        prefetchHoverRef.current = setTimeout(() => {
          prefetchHoverRef.current = null;
          void getNodeDetails(node.id);
        }, 200);
      }
    },
    [focusLayoutActive, setExploreHoveredNodeId]
  );

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    if (prefetchHoverRef.current) {
      clearTimeout(prefetchHoverRef.current);
      prefetchHoverRef.current = null;
    }
    setExploreHoveredNodeId(null);
  }, [setExploreHoveredNodeId]);

  useEffect(() => {
    return () => {
      if (prefetchHoverRef.current) clearTimeout(prefetchHoverRef.current);
    };
  }, []);

  const onPaneClick = useCallback(() => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    closeFocusLinkEdit();
    if (!focusLayoutActive) {
      closeDetail();
    }
    setExploreHoveredNodeId(null);
  }, [
    closeDetail,
    closeFocusLinkEdit,
    setExploreHoveredNodeId,
    focusLayoutActive,
  ]);

  return (
    <div
      ref={graphContainerRef}
      className="explore-flow-graph relative flex h-full min-h-0 w-full flex-1 flex-col"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        onInit={(instance) => {
          reactFlowRef.current = instance;
          requestAnimationFrame(() => {
            instance.fitView({
              padding: 0.18,
              duration: 500,
              minZoom: 0.04,
            });
          });
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        className={mergeNodeClass(
          'h-full min-h-0 flex-1 bg-transparent',
          graphPointerLock ? 'pointer-events-none' : ''
        )}
        proOptions={{ hideAttribution: true }}
        minZoom={0.02}
        maxZoom={1.8}
        onlyRenderVisibleElements
      >
        {!focusLayoutActive ? (
          <TreeLayerChrome layerMetas={layerMetas} bounds={graphBounds} />
        ) : null}
        <Background color="var(--graph-bg-dot)" gap={16} size={1} />
        {showConnections && batchedDimEdges.length > 0 ? (
          <BatchedDimEdgesOverlay edges={batchedDimEdges} nodes={nodes} />
        ) : null}
        <GraphControls
          showConnections={showConnections}
          onToggleConnections={() => setShowConnections((v) => !v)}
          graphContainerRef={graphContainerRef}
        />
      </ReactFlow>
      <Legend />
    </div>
  );
}

export const TechGraph = memo(TechGraphInner);
TechGraph.displayName = 'TechGraph';

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getBezierPath,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { getCategoryColor } from '@/lib/colors';
import { RelationType, type NodeCategory } from '@/lib/types';
import { useUIStore } from '@/stores/ui-store';

export interface TechEdgeData {
  relationType: RelationType;
  sourceCategory?: NodeCategory;
  /** Couleur du lien MATERIAL (couleur de la cible) */
  targetCategory?: NodeCategory;
  /** Filtres UI : arête touchant un nœud filtré */
  filterDimmed?: boolean;
  dimmed?: boolean;
  emphasized?: boolean;
  /** Vue explosion : 0 avant révélation, 1 après */
  explosionOpacity?: number;
  /** Chargement /explore : fade-in des liens après les nœuds */
  introOpacity?: number;
  /** Particules le long du lien (nœud sélectionné) */
  flowParticles?: boolean;
  /** Vue focalisée /explore : arête hors du focus (opacité très basse) */
  focusMuted?: boolean;
  /** Dézoom transition : arête hors cluster focal */
  globalRevealEdgeMuted?: boolean;
  /** Dessin animé une fois (nouveau lien) */
  animateDraw?: boolean;
  /** Transition focus : sortie des liens */
  focusEdgeFadeOut?: boolean;
  /** ms avant introOpacity → 1 après navigation */
  focusEdgeRevealDelayMs?: number;
}

const EDGE_STYLES: Record<
  RelationType,
  { stroke: string; strokeWidth: number; strokeDasharray?: string; opacity: number }
> = {
  material: {
    stroke: '#94A3B8',
    strokeWidth: 1.5,
    opacity: 0.5,
  },
  tool: {
    stroke: '#A78BFA',
    strokeWidth: 1.5,
    strokeDasharray: '4 3',
    opacity: 1,
  },
  energy: {
    stroke: '#EF4444',
    strokeWidth: 1.5,
    strokeDasharray: '8 4',
    opacity: 1,
  },
  knowledge: {
    stroke: '#38BDF8',
    strokeWidth: 1,
    strokeDasharray: '4 4',
    opacity: 0.9,
  },
  catalyst: {
    stroke: '#8B95A8',
    strokeWidth: 0.75,
    opacity: 0.3,
  },
};

function resolveEdgeStyleKey(
  rt: RelationType | string | undefined
): keyof typeof EDGE_STYLES {
  if (rt != null && rt !== '' && rt in EDGE_STYLES) {
    return rt as keyof typeof EDGE_STYLES;
  }
  return RelationType.MATERIAL;
}

function TechEdgeComponent({
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const edgeData = data as TechEdgeData | undefined;
  const targetCategory = edgeData?.targetCategory;
  const relationKey = resolveEdgeStyleKey(edgeData?.relationType);
  const style = EDGE_STYLES[relationKey];

  const exploreHoveredNodeId = useUIStore((s) => s.exploreHoveredNodeId);
  const exploreFocusLayout = useUIStore(
    (s) => Boolean(s.isSidebarOpen && s.selectedNodeId)
  );
  const edgeStyle = useUIStore((s) => s.edgeStyle);
  const focusTransitionAnimating = useUIStore((s) => s.isAnimating);

  const strokeColor =
    relationKey === 'material' && targetCategory
      ? getCategoryColor(targetCategory)
      : style.stroke;

  const filterDimmed = edgeData?.filterDimmed === true;
  const hoverEdge = useMemo(() => {
    if (exploreFocusLayout || !exploreHoveredNodeId) return null;
    const em =
      source === exploreHoveredNodeId || target === exploreHoveredNodeId;
    return { dimmed: !em, emphasized: em };
  }, [exploreFocusLayout, exploreHoveredNodeId, source, target]);

  const dimmed =
    hoverEdge !== null ? hoverEdge.dimmed : edgeData?.dimmed === true;
  const emphasized =
    hoverEdge !== null ? hoverEdge.emphasized : edgeData?.emphasized === true;
  const focusMuted = edgeData?.focusMuted === true;
  const globalRevealEdgeMuted = edgeData?.globalRevealEdgeMuted === true;
  const strokeW = style.strokeWidth + (emphasized ? 0.5 : 0);
  const explosionOpacity = edgeData?.explosionOpacity ?? 1;
  const introOpacityRaw = edgeData?.introOpacity ?? 1;
  const flowParticles = edgeData?.flowParticles === true;
  /** Arête mise en avant au survol : ne pas appliquer le grisage filtre (sinon liens presque invisibles). */
  const dimFactor =
    hoverEdge !== null && hoverEdge.emphasized
      ? 1
      : filterDimmed
        ? 0.32
        : globalRevealEdgeMuted
          ? 0.3
          : focusMuted
            ? 0.03
            : dimmed
              ? 0.15
              : 1;

  const focusEdgeFadeOut = edgeData?.focusEdgeFadeOut === true;
  const focusEdgeRevealDelayMs = edgeData?.focusEdgeRevealDelayMs;

  const [focusFadeMul, setFocusFadeMul] = useState(1);
  const [focusRevealMul, setFocusRevealMul] = useState(1);

  useEffect(() => {
    if (!focusEdgeFadeOut) {
      setFocusFadeMul(1);
      return;
    }
    setFocusFadeMul(0.6);
    const t = window.setTimeout(() => setFocusFadeMul(0), 200);
    return () => clearTimeout(t);
  }, [focusEdgeFadeOut]);

  useEffect(() => {
    if (focusEdgeRevealDelayMs == null) {
      setFocusRevealMul(1);
      return;
    }
    setFocusRevealMul(0);
    const t = window.setTimeout(
      () => setFocusRevealMul(1),
      focusEdgeRevealDelayMs
    );
    return () => clearTimeout(t);
  }, [focusEdgeRevealDelayMs]);

  const introOpacity =
    focusEdgeRevealDelayMs != null
      ? introOpacityRaw * focusRevealMul
      : introOpacityRaw;

  const opacity =
    dimFactor *
    style.opacity *
    explosionOpacity *
    introOpacity *
    focusFadeMul;

  /** angular : segments orthogonaux (angles droits). smooth : courbe de Bézier. */
  const edgePath = useMemo(() => {
    if (edgeStyle === 'angular') {
      const [path] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: 0,
      });
      return path;
    }
    const [path] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    return path;
  }, [
    edgeStyle,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  ]);

  const pathRef = useRef<SVGPathElement>(null);
  const animateDraw = edgeData?.animateDraw === true;

  useEffect(() => {
    if (!animateDraw || !pathRef.current) return;
    const len = pathRef.current.getTotalLength();
    const el = pathRef.current;
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    el.getBoundingClientRect();
    el.style.transition = 'stroke-dashoffset 400ms ease-out';
    el.style.strokeDashoffset = '0';
    const t = window.setTimeout(() => {
      el.style.strokeDasharray = '';
      el.style.strokeDashoffset = '';
      el.style.transition = '';
    }, 450);
    return () => clearTimeout(t);
  }, [animateDraw, edgePath]);

  return (
    <g className="react-flow__edge">
      <path
        ref={pathRef}
        fill="none"
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: strokeW,
          strokeDasharray: style.strokeDasharray,
          opacity,
          transition: focusEdgeFadeOut
            ? 'opacity 200ms ease-out'
            : focusEdgeRevealDelayMs != null
              ? 'opacity 300ms ease-out'
              : globalRevealEdgeMuted
                ? 'opacity 300ms ease-in-out'
                : 'opacity 400ms ease-out',
        }}
      />
      {flowParticles &&
        !filterDimmed &&
        introOpacity > 0.02 &&
        !focusTransitionAnimating && (
        <>
          <circle r={3} fill="#E8ECF4" opacity={Math.min(1, 0.95 * opacity)}>
            <animateMotion
              dur="2.2s"
              repeatCount="indefinite"
              path={edgePath}
              rotate="auto"
            />
          </circle>
          <circle r={2.5} fill="#3B82F6" opacity={Math.min(1, 0.85 * opacity)}>
            <animateMotion
              dur="2.2s"
              repeatCount="indefinite"
              begin="0.75s"
              path={edgePath}
              rotate="auto"
            />
          </circle>
        </>
      )}
    </g>
  );
}

export const TechEdge = TechEdgeComponent;

import type { Node } from '@xyflow/react';
import {
  EXPLORE_LAYOUT_NODE_H,
  EXPLORE_LAYOUT_NODE_W,
} from '@/lib/graph-utils';

/** Popup recherche (aligné sur computeGraphBounds dans TechGraph). */
const SEARCH_POPUP_W = 280;
const SEARCH_POPUP_H = 320;

const LAYER_LABEL_W = 220;
const LAYER_LABEL_H = 28;

/** Bouton « + » : position = coin haut-gauche du carré 32px. */
const ADD_BTN = 32;

/**
 * Rectangle englobant les nœuds visibles du cluster focalisé, avec largeurs/hauteurs
 * connues (sans attendre la mesure DOM — évite fitView avec bornes ~0).
 */
export function getFocusClusterBounds(nodes: Node[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const expand = (left: number, top: number, w: number, h: number) => {
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + w);
    maxY = Math.max(maxY, top + h);
  };

  for (const n of nodes) {
    if (n.hidden) continue;
    const t = n.type;

    if (t === 'tech') {
      expand(
        n.position.x,
        n.position.y,
        EXPLORE_LAYOUT_NODE_W,
        EXPLORE_LAYOUT_NODE_H
      );
      continue;
    }
    if (t === 'addButton') {
      expand(n.position.x, n.position.y, ADD_BTN, ADD_BTN);
      continue;
    }
    if (t === 'searchPopup') {
      expand(n.position.x, n.position.y, SEARCH_POPUP_W, SEARCH_POPUP_H);
      continue;
    }
    if (t === 'layerLabel') {
      expand(n.position.x, n.position.y, LAYER_LABEL_W, LAYER_LABEL_H);
    }
  }

  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

import type { Node } from '@xyflow/react';
import {
  EXPLORE_CARD_H,
  EXPLORE_LAYOUT_NODE_H,
  EXPLORE_LAYOUT_NODE_W,
  FOCUS_VERT_GAP,
} from '@/lib/graph-utils';
import type { FocusLinkSearchMode } from '@/stores/focus-link-edit-store';

/** Taille des boutons « + » (alignée avec les actions sur les cartes voisines). */
export const FOCUS_ADD_BTN_PX = 40;

export type BuildFocusOverlayOptions = {
  /** Sans compte : pas de « + » ni popup — contribution via « Suggérer une correction » uniquement. */
  allowAddLinks?: boolean;
};

/**
 * Boutons « + » et popup de recherche en vue focalisée /explore.
 */
export function buildFocusOverlayNodes(
  selected: Node,
  searchMode: FocusLinkSearchMode | null,
  relationPick: { mode: FocusLinkSearchMode; otherNodeId: string } | null,
  options?: BuildFocusOverlayOptions
): Node[] {
  if (options?.allowAddLinks === false) {
    return [];
  }
  /** Centre horizontal de la carte = centre de la boîte nœud (170×240), pas seulement 150px. */
  const cardCenterX = selected.position.x + EXPLORE_LAYOUT_NODE_W / 2;
  const iy = selected.position.y;
  /** Bords verticaux de la carte visible (150×228) centrée dans la boîte 170×240. */
  const padY = (EXPLORE_LAYOUT_NODE_H - EXPLORE_CARD_H) / 2;
  const visualTop = iy + padY;
  const visualBottom = visualTop + EXPLORE_CARD_H;
  /** Mi-chemin dans l’espace vide entre bord haut carte et ligne « a conduit à ». */
  const yAddOutputs = visualTop - FOCUS_VERT_GAP / 2;
  /** Mi-chemin entre bord bas carte et ligne « obtenu grâce à ». */
  const yAddInputs = visualBottom + FOCUS_VERT_GAP / 2;
  const half = FOCUS_ADD_BTN_PX / 2;
  /** Coin haut-gauche du bouton (aligné sur le centre horizontal de la carte). */
  const nodes: Node[] = [
    {
      id: '__focus-add-inputs',
      type: 'addButton',
      position: { x: cardCenterX - half, y: yAddInputs - half },
      width: FOCUS_ADD_BTN_PX,
      height: FOCUS_ADD_BTN_PX,
      data: { variant: 'inputs' },
      draggable: false,
      selectable: false,
      focusable: false,
      style: { zIndex: 110 },
    },
    {
      id: '__focus-add-outputs',
      type: 'addButton',
      position: { x: cardCenterX - half, y: yAddOutputs - half },
      width: FOCUS_ADD_BTN_PX,
      height: FOCUS_ADD_BTN_PX,
      data: { variant: 'outputs' },
      draggable: false,
      selectable: false,
      focusable: false,
      style: { zIndex: 110 },
    },
  ];

  const searchOpen = searchMode !== null || relationPick !== null;
  if (!searchOpen) return nodes;

  const mode = searchMode ?? relationPick?.mode ?? 'inputs';
  const popupY = mode === 'inputs' ? yAddInputs : yAddOutputs;
  nodes.push({
    id: '__focus-search-popup',
    type: 'searchPopup',
    position: {
      x: cardCenterX + 16 + 20,
      y: popupY - 40,
    },
    width: 280,
    height: 320,
    data: {},
    draggable: false,
    selectable: false,
    focusable: false,
    style: { zIndex: 130 },
  });

  return nodes;
}

export function stripFocusOverlayNodes(nodes: Node[]): Node[] {
  return nodes.filter((n) => !n.id.startsWith('__focus-'));
}

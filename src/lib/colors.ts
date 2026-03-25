/**
 * Palette CivTree et mapping catégories → couleurs
 * @see BRIEF.md Section 5 — Design & Direction artistique
 */

import { NodeCategory } from './types';

// ─── Couleurs des catégories de nœuds (Section 5.3) ──────────────────────────

export const NODE_CATEGORY_COLORS: Record<NodeCategory, string> = {
  [NodeCategory.MINERAL]: '#94A3B8',       // Gris acier
  [NodeCategory.VEGETAL]: '#22C55E',       // Vert vif
  [NodeCategory.ANIMAL]: '#F97316',        // Orange
  [NodeCategory.ELEMENT]: '#06B6D4',       // Cyan
  [NodeCategory.ENERGY]: '#EF4444',        // Rouge
  [NodeCategory.MATERIAL]: '#6366F1',      // Indigo
  [NodeCategory.TOOL]: '#A78BFA',          // Violet clair
  [NodeCategory.PROCESS]: '#EC4899',       // Rose
  [NodeCategory.MACHINE]: '#8B5CF6',       // Violet
  [NodeCategory.ELECTRONICS]: '#3B82F6',   // Bleu
  [NodeCategory.CHEMISTRY]: '#14B8A6',     // Teal
  [NodeCategory.CONSTRUCTION]: '#78716C',  // Stone
  [NodeCategory.TRANSPORT]: '#F59E0B',     // Ambre
  [NodeCategory.COMMUNICATION]: '#06B6D4', // Cyan
  [NodeCategory.FOOD]: '#84CC16',          // Lime
  [NodeCategory.TEXTILE]: '#E879F9',       // Fuchsia
  [NodeCategory.MEDICAL]: '#F43F5E',       // Rose-rouge
  [NodeCategory.WEAPON]: '#DC2626',        // Rouge foncé
  [NodeCategory.OPTICAL]: '#38BDF8',       // Sky
  [NodeCategory.SOFTWARE]: '#818CF8',      // Bleu-violet
};

// ─── Palette générale (Section 5.2) ──────────────────────────────────────────

export const PALETTE = {
  // Fonds
  background: {
    main: '#0A0E17',
    secondary: '#111827',
    card: '#1A1F2E',
  },
  // Bordures
  border: '#2A3042',
  // Texte
  text: {
    primary: '#E8ECF4',
    secondary: '#8B95A8',
  },
  // Accents
  accent: {
    primary: '#3B82F6',
    secondary: '#10B981',
    tertiary: '#F59E0B',
    danger: '#EF4444',
  },
} as const;

/**
 * Retourne la couleur associée à une catégorie de nœud
 */
export function getCategoryColor(category: NodeCategory): string {
  return NODE_CATEGORY_COLORS[category];
}

/** Convertit une couleur hex (#RRGGBB) en rgba pour bordures / fonds semi-transparents. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

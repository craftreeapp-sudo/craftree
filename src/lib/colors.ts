/**
 * Palette CivTree et mapping catégories → couleurs
 * @see BRIEF.md Section 5 — Design & Direction artistique
 */

import { NodeCategory } from './types';

// ─── Couleurs des catégories de nœuds (Section 5.3) ──────────────────────────

export const NODE_CATEGORY_COLORS: Record<NodeCategory, string> = {
  [NodeCategory.ENERGY]: '#EF4444',
  [NodeCategory.CONSTRUCTION]: '#78716C',
  [NodeCategory.WEAPON]: '#DC2626',
  [NodeCategory.NETWORK]: '#0EA5E9',
  [NodeCategory.FOOD]: '#84CC16',
  [NodeCategory.TRANSPORT]: '#F59E0B',
  [NodeCategory.SOFTWARE]: '#818CF8',
  [NodeCategory.INFRASTRUCTURE]: '#64748B',
  [NodeCategory.TEXTILE]: '#E879F9',
  [NodeCategory.COMMUNICATION]: '#06B6D4',
  [NodeCategory.AGRICULTURE]: '#65A30D',
  [NodeCategory.ANIMAL]: '#C2410C',
  [NodeCategory.ROBOTICS]: '#7C3AED',
  [NodeCategory.CHEMISTRY]: '#14B8A6',
  [NodeCategory.ELECTRONICS]: '#3B82F6',
  [NodeCategory.ENVIRONMENT]: '#059669',
  [NodeCategory.AUTOMATION]: '#D946EF',
  [NodeCategory.MEDICAL]: '#F43F5E',
  [NodeCategory.OPTICAL]: '#38BDF8',
  [NodeCategory.STORAGE]: '#475569',
  [NodeCategory.AERONAUTICS]: '#0284C7',
  [NodeCategory.SPACE]: '#4C1D95',
  [NodeCategory.INDUSTRY]: '#92400E',
  [NodeCategory.NANOTECHNOLOGY]: '#0891B2',
  [NodeCategory.BIOTECHNOLOGY]: '#BE185D',
  [NodeCategory.SECURITY]: '#B91C1C',
  [NodeCategory.HOME_AUTOMATION]: '#CA8A04',
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

const FALLBACK_CATEGORY_HEX = NODE_CATEGORY_COLORS[NodeCategory.INDUSTRY];

/**
 * Retourne la couleur associée à une catégorie de nœud
 */
export function getCategoryColor(category: NodeCategory): string {
  return NODE_CATEGORY_COLORS[category] ?? FALLBACK_CATEGORY_HEX;
}

/** Convertit une couleur hex (#RRGGBB) en rgba pour bordures / fonds semi-transparents. */
export function hexToRgba(hex: string, alpha: number): string {
  const effectiveHex =
    typeof hex === 'string' && hex.length > 0 ? hex : FALLBACK_CATEGORY_HEX;
  const h = effectiveHex.replace('#', '');
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

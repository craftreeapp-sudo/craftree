import { getCategoryColor } from '@/lib/colors';
import { Era as EraEnum } from '@/lib/types';
import type { Era, NodeCategory } from '@/lib/types';

/**
 * Comparaison de noms d inventions (insensible à la casse et aux accents).
 */
export function normalizeInventionName(s: string): string {
  return s
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * Ère à partir d'une année (ou défaut moderne si absente).
 */
export function getEraFromYear(year: number | null): Era {
  if (year === null) return EraEnum.MODERN;
  if (year < -3000) return EraEnum.PREHISTORIC;
  if (year <= 500) return EraEnum.ANCIENT;
  if (year <= 1500) return EraEnum.MEDIEVAL;
  if (year <= 1750) return EraEnum.RENAISSANCE;
  if (year <= 1900) return EraEnum.INDUSTRIAL;
  if (year <= 1970) return EraEnum.MODERN;
  if (year <= 2010) return EraEnum.DIGITAL;
  return EraEnum.CONTEMPORARY;
}

/**
 * Identifiant URL-safe depuis un libellé (éditeur / API).
 */
export function slugify(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const nfd = trimmed.normalize('NFD');
  const noDiacritics = nfd.replace(/\p{M}/gu, '');
  const lower = noDiacritics.toLowerCase();
  const dashed = lower.replace(/[^a-z0-9]+/g, '-');
  const collapsed = dashed.replace(/-+/g, '-');
  return collapsed.replace(/^-+|-+$/g, '');
}

/**
 * Année affichée partout (nombre seul ; négatif = avant notre ère, ex. -3000).
 */
export function formatYear(year: number | undefined | null): string {
  if (year === undefined || year === null) return '';
  return String(year);
}

/**
 * Image placeholder par catégorie (placehold.co) — remplaçable par `image_url` réel.
 */
export function getPlaceholderImage(category: NodeCategory, label?: string): string {
  const hex = getCategoryColor(category).replace('#', '');
  const text = encodeURIComponent(
    (label ?? String(category)).replace(/_/g, ' ').slice(0, 18)
  );
  return `https://placehold.co/300x200/${hex}/ffffff?text=${text}`;
}

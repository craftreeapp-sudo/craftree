'use client';

import { useTranslations } from 'next-intl';
import { hexToRgba } from '@/lib/colors';

type Props = {
  categoryColor: string;
  /** Conteneur pleine largeur (carte), vignette barre de recherche (32×32), etc. */
  variant?: 'card' | 'panel' | 'compact' | 'search';
  className?: string;
};

/**
 * Illustration neutre lorsque `image_url` est absent (pas seulement l’initiale).
 */
export function CardImagePlaceholder({
  categoryColor,
  variant = 'card',
  className = '',
}: Props) {
  const tExplore = useTranslations('explore');
  const aria = tExplore('cardNoImageAria');

  const size =
    variant === 'search'
      ? 'h-full w-full min-h-0'
      : variant === 'compact'
        ? 'h-[52px] w-full sm:h-[60px]'
        : variant === 'panel'
          ? 'min-h-[120px] w-full sm:min-h-[140px]'
          : 'h-full min-h-0 w-full';

  const decorative = variant === 'search';

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${
        variant === 'search' ? 'rounded-md' : 'rounded-lg'
      } ${size} ${className}`}
      style={{ backgroundColor: hexToRgba(categoryColor, 0.22) }}
      {...(decorative
        ? { 'aria-hidden': true as const }
        : { role: 'img' as const, 'aria-label': aria })}
    >
      <svg
        className={`pointer-events-none text-muted-foreground/55 ${
          variant === 'search'
            ? 'h-[70%] w-[70%] max-h-[22px] max-w-[22px]'
            : 'w-[42%] max-w-[6.5rem]'
        }`}
        viewBox="0 0 120 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <rect
          x="10"
          y="14"
          width="100"
          height="60"
          rx="10"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <circle cx="38" cy="42" r="9" fill="currentColor" opacity="0.35" />
        <path
          d="M18 62 L40 48 L56 58 L74 40 L102 56"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.55"
        />
        <path
          d="M78 26 L88 20 L98 26"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        />
      </svg>
    </div>
  );
}

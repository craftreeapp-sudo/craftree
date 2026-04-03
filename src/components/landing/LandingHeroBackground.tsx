'use client';

import { useTranslations } from 'next-intl';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';
import { getCategoryColor } from '@/lib/colors';
import type { NodeCategory } from '@/lib/types';
import {
  LANDING_HERO_LAYOUT,
  LANDING_HERO_LINE_ANIM,
  LANDING_HERO_LINKS,
  type LandingHeroCard,
} from '@/lib/landing-hero-cards';
import { safeCategoryLabel } from '@/lib/safe-category-label';

type Props = {
  cards: LandingHeroCard[];
};

function MiniCraftCard({
  name,
  category,
  categoryLabel,
  compact,
}: {
  name: string;
  category: NodeCategory;
  categoryLabel: string;
  compact: boolean;
}) {
  const color = getCategoryColor(category);

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-[10px] border-[0.5px] border-border ${
        compact ? 'h-[98px] w-[78px]' : 'h-[130px] w-[104px]'
      }`}
    >
      <div
        className="flex h-1/2 items-center justify-center px-0.5"
        style={{ backgroundColor: color }}
      >
        <span
          className={`text-center font-bold leading-tight text-white ${
            compact ? 'text-[9px]' : 'text-[12px]'
          }`}
        >
          {name}
        </span>
      </div>
      <div className="flex h-1/2 flex-col items-center justify-center gap-0.5 bg-[#1E2432] px-0.5">
        <span
          className={`line-clamp-2 text-center font-normal leading-tight text-muted-foreground ${
            compact ? 'text-[8px]' : 'text-[10px]'
          }`}
        >
          {name}
        </span>
        <span
          className={`max-w-full truncate text-center font-medium uppercase tracking-wide text-muted-foreground ${
            compact ? 'text-[6px]' : 'text-[8px]'
          }`}
        >
          {categoryLabel}
        </span>
      </div>
    </div>
  );
}

export function LandingHeroBackground({ cards }: Props) {
  const tCat = useTranslations('categories');
  const isMobile = useIsMobileBreakpoint();
  const count = isMobile ? 5 : Math.min(10, cards.length);
  const visible = cards.slice(0, count);
  const layout = LANDING_HERO_LAYOUT.slice(0, count);

  const linkIndices = LANDING_HERO_LINKS.map((pair, i) => ({ pair, anim: LANDING_HERO_LINE_ANIM[i] }))
    .filter(
      ({ pair: [a, b] }) =>
        a < visible.length && b < visible.length
    );

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 opacity-[0.12]">
        {visible.map((card, i) => {
          const L = layout[i];
          if (!L) return null;
          return (
            <div
              key={card.id}
              className="landing-hero-card absolute"
              style={{
                left: `${L.cx}%`,
                top: `${L.cy}%`,
                animationDuration: `${L.duration}s`,
                animationDelay: `${L.delay}s`,
              }}
            >
              <MiniCraftCard
                name={card.name}
                category={card.category}
                categoryLabel={safeCategoryLabel(
                  tCat,
                  String(card.category)
                )}
                compact={isMobile}
              />
            </div>
          );
        })}
      </div>

      <svg
        className="absolute inset-0 h-full w-full opacity-[0.08]"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {linkIndices.map(({ pair: [a, b], anim }, idx) => {
          const ca = LANDING_HERO_LAYOUT[a];
          const cb = LANDING_HERO_LAYOUT[b];
          if (!ca || !cb) return null;
          return (
            <line
              key={`${a}-${b}-${idx}`}
              x1={ca.cx}
              y1={ca.cy}
              x2={cb.cx}
              y2={cb.cy}
              stroke="#3B82F6"
              strokeWidth={0.5}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              className="landing-hero-line"
              style={{
                animationDuration: `${anim.duration}s`,
                animationDelay: `${anim.delay}s`,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

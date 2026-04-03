'use client';

import type { MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { TechNodeBasic } from '@/lib/types';

type DecadeGroup = { decade: number | 'none'; nodes: TechNodeBasic[] };

export function eraDecadeSectionId(decade: number | 'none'): string {
  return decade === 'none' ? 'era-dec-none' : `era-dec-${decade}`;
}

function scrollToDecadeAnchor(
  decade: number | 'none',
  e: MouseEvent<HTMLAnchorElement>
) {
  e.preventDefault();
  const id = eraDecadeSectionId(decade);
  const el = document.getElementById(id);
  if (!el) return;

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  el.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  });

  const hash = `#${id}`;
  if (typeof window !== 'undefined' && window.history.replaceState) {
    window.history.replaceState(null, '', hash);
  }

  const section = el.closest('section');
  const flashAfterMs = reduceMotion ? 0 : 480;

  window.setTimeout(() => {
    if (!section || reduceMotion) return;
    section.classList.add('era-category-anchor-flash');
    window.setTimeout(() => {
      section.classList.remove('era-category-anchor-flash');
    }, 720);
  }, flashAfterMs);
}

type Props = {
  groups: DecadeGroup[];
};

/**
 * Liens d’ancrage vers les sections « par décennie » sur une page époque (tri par date).
 */
export function EraDecadeAnchorSidebar({ groups }: Props) {
  const tPage = useTranslations('categoriesPage');

  if (groups.length === 0) return null;

  return (
    <nav
      aria-label={tPage('eraDecadeAnchorsAria')}
      className="w-full shrink-0 lg:z-30 lg:w-56 lg:self-start lg:sticky lg:top-14 xl:w-60"
    >
      <div className="rounded-xl glass-card p-3 lg:max-h-[min(70vh,calc(100dvh-5rem))] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {tPage('eraDecadeAnchorsHeading')}
        </p>
        <ul className="flex flex-row gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {groups.map(({ decade, nodes }) => {
            const id = eraDecadeSectionId(decade);
            const label =
              decade === 'none' ? tPage('eraDecadeUnknown') : String(decade);
            return (
              <li key={id} className="shrink-0 lg:shrink">
                <a
                  href={`#${id}`}
                  onClick={(e) => scrollToDecadeAnchor(decade, e)}
                  className="block whitespace-nowrap rounded-lg border-l-[3px] border-solid border-accent/35 bg-transparent py-2 pl-2.5 pr-3 text-left text-xs text-muted-foreground transition-[transform,background-color,border-color] duration-200 ease-out hover:border-accent/60 hover:bg-surface-elevated/70 hover:text-foreground active:scale-[0.98] lg:text-sm"
                >
                  <span className="font-medium tabular-nums text-foreground">
                    {label}
                  </span>
                  <span
                    className="ml-1.5 tabular-nums text-[11px] text-muted-foreground"
                    aria-hidden
                  >
                    ({nodes.length})
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

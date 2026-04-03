'use client';

import type { MouseEvent } from 'react';
import { useTranslations } from 'next-intl';
import { getCategoryColor } from '@/lib/colors';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import type { NodeCategory, TechNodeBasic } from '@/lib/types';

type Props = {
  groups: { category: NodeCategory; nodes: TechNodeBasic[] }[];
};

function scrollToCategoryAnchor(
  cat: NodeCategory,
  e: MouseEvent<HTMLAnchorElement>
) {
  e.preventDefault();
  const id = `era-cat-${cat}`;
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

/**
 * Liens d’ancrage vers les sections « par catégorie » sur une page époque.
 */
export function EraCategoryAnchorSidebar({ groups }: Props) {
  const tCat = useTranslations('categories');
  const tPage = useTranslations('categoriesPage');

  if (groups.length === 0) return null;

  return (
    <nav
      aria-label={tPage('eraCategoryAnchorsAria')}
      className="w-full shrink-0 lg:z-30 lg:w-56 lg:self-start lg:sticky lg:top-14 xl:w-60"
    >
      <div className="rounded-xl glass-card p-3 lg:max-h-[min(70vh,calc(100dvh-5rem))] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {tPage('eraCategoryAnchorsHeading')}
        </p>
        <ul className="flex flex-row gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {groups.map(({ category: cat, nodes }) => {
            const color = getCategoryColor(cat);
            return (
              <li key={cat} className="shrink-0 lg:shrink">
                <a
                  href={`#era-cat-${cat}`}
                  onClick={(e) => scrollToCategoryAnchor(cat, e)}
                  className="block whitespace-nowrap rounded-lg border-l-[3px] border-solid border-transparent py-2 pl-2.5 pr-3 text-left text-xs text-muted-foreground transition-[transform,background-color,border-color] duration-200 ease-out hover:border-border hover:bg-surface-elevated/70 hover:text-foreground active:scale-[0.98] lg:text-sm"
                  style={{ borderLeftColor: `${color}99` }}
                >
                  <span className="font-medium text-foreground">
                    {safeCategoryLabel(tCat, cat)}
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

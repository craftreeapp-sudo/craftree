'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getCategoryColor } from '@/lib/colors';
import { NODE_CATEGORY_ORDER } from '@/lib/node-labels';
import type { NodeCategory } from '@/lib/types';

type Props = {
  activeId: NodeCategory;
};

export function CategoryFilterSidebar({ activeId }: Props) {
  const tCat = useTranslations('categories');
  const tPage = useTranslations('categoriesPage');

  return (
    <nav
      aria-label={tPage('categorySidebarHeading')}
      className="w-full shrink-0 lg:w-56 xl:w-60"
    >
      <div className="rounded-xl glass-card p-3 lg:sticky lg:top-28 lg:max-h-[min(70vh,calc(100dvh-8rem))] lg:overflow-y-auto lg:pr-1">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {tPage('categorySidebarHeading')}
        </p>
        {/* Mobile: défilement horizontal */}
        <ul className="flex flex-row gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {NODE_CATEGORY_ORDER.map((cat) => {
            const isActive = cat === activeId;
            const color = getCategoryColor(cat);
            const href = `/categories/category/${encodeURIComponent(cat)}`;
            return (
              <li key={cat} className="shrink-0 lg:shrink">
                <Link
                  href={href}
                  className={[
                    'block whitespace-nowrap rounded-lg border-l-[3px] border-solid border-transparent py-2 pl-2.5 pr-3 text-left text-xs transition-colors lg:text-sm',
                    isActive
                      ? 'bg-surface-elevated font-semibold text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-surface-elevated/70 hover:text-foreground',
                  ].join(' ')}
                  style={
                    isActive ? { borderLeftColor: color } : undefined
                  }
                >
                  {tCat(cat)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

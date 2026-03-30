'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { AppContentShell } from '@/components/layout/AppContentShell';
import { NODE_CATEGORY_ORDER } from '@/lib/node-labels';
import { PICKER_IMAGE_CATEGORY } from '@/lib/explore-picker-images';
import { NodeCategory } from '@/lib/types';
import { CATEGORY_LIST_GRID_CLASS } from '@/components/categories/category-list-card-layout';
import {
  CategoryListCardLayoutSwitcher,
  useCategoryListCardLayout,
} from '@/components/categories/CategoryListCardLayoutSwitcher';

export function CategoriesPickerClient() {
  const router = useRouter();
  const tPage = useTranslations('categoriesPage');
  const tCat = useTranslations('categories');
  const nodes = useGraphStore((s) => s.nodes);
  const refreshData = useGraphStore((s) => s.refreshData);

  useEffect(() => {
    if (nodes.length === 0) void refreshData();
  }, [nodes.length, refreshData]);

  const onPickCategory = (c: NodeCategory) => {
    router.push(`/categories/category/${encodeURIComponent(c)}`);
  };

  const [cardLayout, setCardLayout] = useCategoryListCardLayout();

  return (
    <AppContentShell
      as="main"
      variant="wide"
      className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col"
    >
      <header className="mb-8 text-center md:mb-10">
        <h1
          className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          {tPage('title')}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          {tPage('intro')}
        </p>
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <CategoryListCardLayoutSwitcher
          layout={cardLayout}
          onChange={setCardLayout}
        />
      </div>

      <div
        className={CATEGORY_LIST_GRID_CLASS[cardLayout]}
        role="list"
        suppressHydrationWarning
      >
        {NODE_CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            role="listitem"
            onClick={() => onPickCategory(cat)}
            className="group relative overflow-hidden rounded-xl border border-border bg-surface-elevated text-left shadow-lg transition-transform hover:-translate-y-0.5 hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={PICKER_IMAGE_CATEGORY[cat]}
                alt=""
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E17] via-[#0A0E17]/50 to-transparent" />
              <span className="absolute bottom-0 left-0 right-0 p-3 text-sm font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] md:p-4 md:text-base">
                {tCat(cat)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </AppContentShell>
  );
}

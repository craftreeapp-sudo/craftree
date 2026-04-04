'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { AppContentShell } from '@/components/layout/AppContentShell';
import { ERA_ORDER, NODE_CATEGORY_ORDER } from '@/lib/node-labels';
import { PICKER_IMAGE_CATEGORY, PICKER_IMAGE_ERA } from '@/lib/explore-picker-images';
import { Era, NodeCategory } from '@/lib/types';
import { CATEGORY_LIST_GRID_CLASS } from '@/components/categories/category-list-card-layout';
import {
  CategoryListCardLayoutSwitcher,
  useCategoryListCardLayout,
} from '@/components/categories/CategoryListCardLayoutSwitcher';

export function CategoriesPickerClient() {
  const router = useRouter();
  const tPage = useTranslations('categoriesPage');
  const tCat = useTranslations('categories');
  const tEra = useTranslations('eras');
  const nodes = useGraphStore((s) => s.nodes);
  const refreshData = useGraphStore((s) => s.refreshData);
  const [pickerTab, setPickerTab] = useState<'category' | 'era'>('category');

  useEffect(() => {
    if (nodes.length === 0) void refreshData();
  }, [nodes.length, refreshData]);

  const onPickCategory = (c: NodeCategory) => {
    router.push(`/categories/category/${encodeURIComponent(c)}`);
  };

  const onPickEra = (e: Era) => {
    router.push(`/categories/era/${encodeURIComponent(e)}`);
  };

  const [cardLayout, setCardLayout] = useCategoryListCardLayout();
  const reduceMotion = useReducedMotion();

  const { listVariants, cardVariants } = useMemo(() => {
    if (reduceMotion) {
      return {
        listVariants: {
          hidden: {},
          show: {},
        },
        cardVariants: {
          hidden: { opacity: 1 },
          show: { opacity: 1 },
        },
      };
    }
    return {
      listVariants: {
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.065,
            delayChildren: 0.06,
          },
        },
      },
      cardVariants: {
        hidden: { opacity: 0, y: 18 },
        show: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.42,
            ease: [0.22, 1, 0.36, 1] as const,
          },
        },
      },
    };
  }, [reduceMotion]);

  return (
    <AppContentShell
      as="main"
      variant="wide"
      className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col"
    >
      <header className="mb-8 text-center md:mb-10">
        <h1 className="sr-only">{tPage('pickerAccessibleTitle')}</h1>
        <div
          className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
          role="tablist"
          aria-label={tPage('tabPickerAriaLabel')}
        >
          <button
            type="button"
            role="tab"
            aria-selected={pickerTab === 'category'}
            id="categories-tab-category"
            onClick={() => setPickerTab('category')}
            className={
              pickerTab === 'category'
                ? 'rounded-xl border border-accent/40 bg-accent/15 px-5 py-2.5 text-base font-semibold text-foreground shadow-sm ring-1 ring-accent/30 md:text-lg'
                : 'rounded-xl border border-transparent px-5 py-2.5 text-base font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground md:text-lg'
            }
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            }}
          >
            {tPage('tabCategories')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={pickerTab === 'era'}
            id="categories-tab-era"
            onClick={() => setPickerTab('era')}
            className={
              pickerTab === 'era'
                ? 'rounded-xl border border-accent/40 bg-accent/15 px-5 py-2.5 text-base font-semibold text-foreground shadow-sm ring-1 ring-accent/30 md:text-lg'
                : 'rounded-xl border border-transparent px-5 py-2.5 text-base font-semibold text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground md:text-lg'
            }
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            }}
          >
            {tPage('tabEras')}
          </button>
        </div>
        <p
          className="mt-4 text-sm text-muted-foreground md:mt-5 md:text-base"
          role="tabpanel"
          aria-labelledby={
            pickerTab === 'category' ? 'categories-tab-category' : 'categories-tab-era'
          }
        >
          {pickerTab === 'category' ? tPage('intro') : tPage('introEra')}
        </p>
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <CategoryListCardLayoutSwitcher
          layout={cardLayout}
          onChange={setCardLayout}
        />
      </div>

      <motion.div
        key={pickerTab}
        className={CATEGORY_LIST_GRID_CLASS[cardLayout]}
        role="list"
        variants={listVariants}
        initial="hidden"
        animate="show"
        suppressHydrationWarning
      >
        {pickerTab === 'category'
          ? NODE_CATEGORY_ORDER.map((cat) => (
              <motion.button
                key={cat}
                type="button"
                role="listitem"
                variants={cardVariants}
                onClick={() => onPickCategory(cat)}
                className="group relative overflow-hidden rounded-xl glass-card text-left shadow-lg transition-transform hover:-translate-y-0.5 hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={PICKER_IMAGE_CATEGORY[cat]}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E17] via-[#0A0E17]/50 to-transparent" />
                  <span className="absolute bottom-0 left-0 right-0 p-3 text-sm font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] md:p-4 md:text-base">
                    {tCat(cat)}
                  </span>
                </div>
              </motion.button>
            ))
          : ERA_ORDER.map((era) => (
              <motion.button
                key={era}
                type="button"
                role="listitem"
                variants={cardVariants}
                onClick={() => onPickEra(era)}
                className="group relative overflow-hidden rounded-xl glass-card text-left shadow-lg transition-transform hover:-translate-y-0.5 hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden">
                  <Image
                    src={PICKER_IMAGE_ERA[era]}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    loading="eager"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E17] via-[#0A0E17]/50 to-transparent" />
                  <span className="absolute bottom-0 left-0 right-0 p-3 text-sm font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] md:p-4 md:text-base">
                    {tEra(era)}
                  </span>
                </div>
              </motion.button>
            ))}
      </motion.div>
    </AppContentShell>
  );
}

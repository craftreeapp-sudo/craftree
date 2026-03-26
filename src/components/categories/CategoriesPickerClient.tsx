'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ERA_LABELS_FR,
  ERA_ORDER,
  NODE_CATEGORY_LABELS_FR,
  NODE_CATEGORY_ORDER,
  TECH_NODE_TYPE_LABELS_FR,
  TECH_NODE_TYPE_ORDER,
} from '@/lib/node-labels';
import {
  PICKER_IMAGE_CATEGORY,
  PICKER_IMAGE_ERA,
  PICKER_IMAGE_TYPE,
} from '@/lib/explore-picker-images';
import type { Era, TechNodeType } from '@/lib/types';
import { NodeCategory } from '@/lib/types';

type TabId = 'categories' | 'eras' | 'types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'categories', label: 'Catégories' },
  { id: 'eras', label: 'Époques' },
  { id: 'types', label: 'Types' },
];

export function CategoriesPickerClient() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('categories');

  const onPickCategory = (c: NodeCategory) => {
    router.push(`/categories/category/${encodeURIComponent(c)}`);
  };

  const onPickEra = (e: Era) => {
    router.push(`/categories/era/${encodeURIComponent(e)}`);
  };

  const onPickType = (t: TechNodeType) => {
    router.push(`/categories/type/${encodeURIComponent(t)}`);
  };

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-1 flex-col px-4 pb-16 pt-20 md:px-6 md:pt-24">
      <header className="mb-8 text-center md:mb-10">
        <h1
          className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          Explorer le Tree
        </h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Choisissez une catégorie, une époque ou un type pour voir les technologies
          associées, puis ouvrez le Tree filtré si vous le souhaitez.
        </p>
      </header>

      <div
        className="mb-10 flex justify-center px-1"
        role="tablist"
        aria-label="Type de filtre"
      >
        <div className="inline-flex w-full max-w-xl flex-wrap gap-1 rounded-xl border border-border bg-surface/90 p-1 shadow-inner sm:flex-nowrap">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={active}
                aria-controls={`panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => setTab(t.id)}
                className={`min-h-[44px] flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:px-5 sm:text-base ${
                  active
                    ? 'bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/25'
                    : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'categories' ? (
        <div
          id="panel-categories"
          role="tabpanel"
          aria-labelledby="tab-categories"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {NODE_CATEGORY_ORDER.map((cat) => (
            <button
              key={cat}
              type="button"
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
                <span className="absolute bottom-0 left-0 right-0 p-3 text-sm font-semibold leading-tight text-foreground md:p-4 md:text-base">
                  {NODE_CATEGORY_LABELS_FR[cat]}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'eras' ? (
        <div
          id="panel-eras"
          role="tabpanel"
          aria-labelledby="tab-eras"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {ERA_ORDER.map((era) => (
            <button
              key={era}
              type="button"
              onClick={() => onPickEra(era)}
              className="group relative overflow-hidden rounded-xl border border-border bg-surface-elevated text-left shadow-lg transition-transform hover:-translate-y-0.5 hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image
                  src={PICKER_IMAGE_ERA[era]}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E17] via-[#0A0E17]/50 to-transparent" />
                <span className="absolute bottom-0 left-0 right-0 p-3 text-sm font-semibold leading-tight text-foreground md:p-4 md:text-base">
                  {ERA_LABELS_FR[era]}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'types' ? (
        <div
          id="panel-types"
          role="tabpanel"
          aria-labelledby="tab-types"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
        >
          {TECH_NODE_TYPE_ORDER.map((tp) => (
            <button
              key={tp}
              type="button"
              onClick={() => onPickType(tp)}
              className="group relative overflow-hidden rounded-xl border border-border bg-surface-elevated text-left shadow-lg transition-transform hover:-translate-y-0.5 hover:border-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image
                  src={PICKER_IMAGE_TYPE[tp]}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 20vw"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0E17] via-[#0A0E17]/50 to-transparent" />
                <span className="absolute bottom-0 left-0 right-0 p-3 text-center text-sm font-semibold leading-tight text-foreground md:p-4 md:text-base">
                  {TECH_NODE_TYPE_LABELS_FR[tp]}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </main>
  );
}

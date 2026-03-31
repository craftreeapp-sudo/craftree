'use client';

import { Suspense, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { SearchBar } from '@/components/ui/SearchBar';
import { useGraphStore } from '@/stores/graph-store';
import {
  LandingFloatingCards,
  type LandingFloatingNode,
} from '@/components/landing/LandingFloatingCards';

type Props = {
  floatingPool: LandingFloatingNode[];
};

export function LandingPage({ floatingPool }: Props) {
  const t = useTranslations('landing');
  const refreshData = useGraphStore((s) => s.refreshData);

  useEffect(() => {
    if (useGraphStore.getState().nodes.length > 0) return;
    void refreshData();
  }, [refreshData]);

  return (
    <main className="relative flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-[#050508] pt-14 text-white">
      <LandingFloatingCards pool={floatingPool} />
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-4 pb-10">
        <div className="flex max-w-4xl flex-col items-center text-center">
          <h1
            className="font-bold leading-[1.1] tracking-tight text-white"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              fontSize: 'clamp(1.85rem, 6vw, 3rem)',
            }}
          >
            {t('title')}
          </h1>
          <p className="mt-5 max-w-2xl text-[1.1rem] leading-relaxed text-white/55">
            {t('subtitle')}
          </p>
        </div>
        <Suspense
          fallback={
            <div className="h-14 w-full max-w-2xl animate-pulse rounded-xl glass-landing" />
          }
        >
          <SearchBar
            variant="landing"
            placeholder={t('searchPlaceholder')}
            landingCtaLabel={t('cta')}
          />
        </Suspense>
      </div>
    </main>
  );
}

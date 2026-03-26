'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { SearchBar } from '@/components/ui/SearchBar';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useUIStore } from '@/stores/ui-store';

export function ExploreWireframeHeader() {
  const t = useTranslations('nav');

  const toggleFilterDrawer = useUIStore((s) => s.toggleFilterDrawer);

  return (
    <header
      className="fixed left-0 right-0 top-0 z-[100] flex h-14 shrink-0 items-center gap-2 border-b border-[#2A3042]/60 bg-[#0A0E17]/95 px-3 backdrop-blur-md md:gap-3 md:px-4"
      style={{ backgroundColor: 'rgba(10, 14, 23, 0.95)' }}
    >
      <button
        type="button"
        onClick={toggleFilterDrawer}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#2A3042] bg-[#1A1F2E] text-lg text-[#E8ECF4] transition-colors hover:bg-[#2A3042]"
        aria-label={t('openFilters')}
      >
        ☰
      </button>

      <Link
        href="/"
        className="shrink-0 font-bold tracking-tight text-[#E8ECF4]"
        style={{
          fontFamily:
            'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          fontSize: '1.15rem',
        }}
      >
        Craft<span className="text-[#3B82F6]">ree</span>
      </Link>

      <div className="flex min-w-0 flex-1 justify-center px-2">
        <div className="w-full max-w-xl">
          <SearchBar />
        </div>
      </div>

      <div className="shrink-0">
        <LanguageSwitcher align="end" />
      </div>
    </header>
  );
}

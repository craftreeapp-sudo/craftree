'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import nodesIndexJson from '@/data/nodes-index.json';
import { SearchBar } from '@/components/ui/SearchBar';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useUIStore } from '@/stores/ui-store';

const INVENTION_COUNT = nodesIndexJson.nodes.length;

export function ExploreWireframeHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const toggleFilterDrawer = useUIStore((s) => s.toggleFilterDrawer);

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 flex h-14 shrink-0 items-center gap-2 border-b border-[#2A3042]/60 bg-[#0A0E17]/95 px-3 backdrop-blur-md md:gap-3 md:px-4"
      style={{ backgroundColor: 'rgba(10, 14, 23, 0.95)' }}
    >
      <LanguageSwitcher align="start" />
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

      <div className="min-w-0 flex-1">
        <SearchBar />
      </div>

      <Link
        href="/editor"
        className="shrink-0 rounded-lg border border-[#2A3042] bg-transparent px-3 py-2 text-sm text-[#8B95A8] transition-colors hover:border-[#3B82F6] hover:text-white"
        aria-label={`${tc('allInventions')} (${INVENTION_COUNT})`}
      >
        {tc('allInventions')} ({INVENTION_COUNT})
      </Link>
    </header>
  );
}

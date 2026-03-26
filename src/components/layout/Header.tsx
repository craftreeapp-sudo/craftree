'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SearchBar } from '@/components/ui/SearchBar';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { ExploreWireframeHeader } from '@/components/explore/ExploreWireframeHeader';
import { ExploreFilterDrawer } from '@/components/explore/ExploreFilterDrawer';

export function Header() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');

  const NAV_TABS = [
    {
      href: '/explore',
      label: tNav('tree'),
      match: (p: string) => p === '/explore',
    },
  ] as const;

  if (pathname === '/editor') {
    return null;
  }

  if (pathname === '/explore') {
    return (
      <>
        <ExploreWireframeHeader />
        <ExploreFilterDrawer />
      </>
    );
  }

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between gap-2 px-3 backdrop-blur-md md:gap-4 md:px-4 xl:px-6"
      style={{
        height: '56px',
        backgroundColor: 'rgba(10, 14, 23, 0.9)',
      }}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-3 md:gap-6">
        <Link
          href="/"
          className="shrink-0 font-bold tracking-tight"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            color: '#E8ECF4',
            fontSize: '1.25rem',
          }}
        >
          Craft<span style={{ color: '#3B82F6' }}>ree</span>
        </Link>
        <nav
          className="hidden max-w-[42vw] items-center gap-0.5 overflow-x-auto sm:flex md:max-w-none md:gap-1"
          aria-label="Vues principales"
        >
          {NAV_TABS.map((tab) => {
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative shrink-0 border-b-2 px-1.5 py-1 text-xs font-medium transition-colors md:px-2.5 md:text-sm ${
                  active
                    ? 'border-[#3B82F6] text-[#E8ECF4]'
                    : 'border-transparent text-[#8B95A8] hover:text-[#E8ECF4]/90'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="absolute left-1/2 flex w-full max-w-xl -translate-x-1/2 justify-center px-4">
        <SearchBar />
      </div>

      <div className="hidden min-w-0 shrink-0 items-center justify-end gap-2 md:flex">
        <FilterPanel />
        <LanguageSwitcher align="end" />
      </div>
    </header>
  );
}

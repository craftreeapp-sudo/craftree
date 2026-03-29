'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SearchBar } from '@/components/ui/SearchBar';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ExploreFilterDrawer } from '@/components/explore/ExploreFilterDrawer';
import { HeaderAuth } from '@/components/layout/HeaderAuth';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useUIStore } from '@/stores/ui-store';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';

export function Header() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const toggleFilterDrawer = useUIStore((s) => s.toggleFilterDrawer);
  const { closeDetail } = useExploreNavigation();

  if (pathname === '/editor') {
    return null;
  }

  const hideHeaderSearch = pathname === '/';
  const isLanding = pathname === '/';

  return (
    <>
      <header
        className={`fixed left-0 right-0 top-0 z-[100] flex h-14 shrink-0 items-center gap-2 px-3 backdrop-blur-md md:gap-3 md:px-4 xl:px-6 ${
          isLanding
            ? 'border-b border-white/10 bg-black/45'
            : 'border-b border-border/60 bg-header-bg'
        }`}
        style={{ height: '56px' }}
      >
        <button
          type="button"
          onClick={toggleFilterDrawer}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-lg transition-colors ${
            isLanding
              ? 'border-white/15 bg-white/5 text-white hover:bg-white/10'
              : 'border-border bg-surface-elevated text-foreground hover:bg-surface'
          }`}
          aria-label={tNav('openFilters')}
        >
          ☰
        </button>

        {pathname?.startsWith('/tree/') ? (
          <button
            type="button"
            onClick={closeDetail}
            className="shrink-0 cursor-pointer border-0 bg-transparent p-0 text-start font-bold tracking-tight text-foreground"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              fontSize: '1.15rem',
            }}
            aria-label={tNav('logoGlobalView')}
          >
            Craft<span className="text-accent">ree</span>
          </button>
        ) : (
          <Link
            href="/"
            className={`shrink-0 font-bold tracking-tight ${
              isLanding ? 'text-white' : 'text-foreground'
            }`}
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              fontSize: '1.15rem',
            }}
          >
            Craft
            <span className={isLanding ? 'text-[#7c9cff]' : 'text-accent'}>
              ree
            </span>
          </Link>
        )}

        <div className="flex min-w-0 flex-1 justify-center px-2">
          {!hideHeaderSearch ? (
            <div className="w-full max-w-xl">
              <SearchBar />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeSwitcher align="end" />
          <LanguageSwitcher align="end" />
          <HeaderAuth />
        </div>
      </header>
      <ExploreFilterDrawer />
    </>
  );
}

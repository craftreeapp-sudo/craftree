'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SearchBar } from '@/components/ui/SearchBar';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { HeaderAuth } from '@/components/layout/HeaderAuth';
import { HeaderNavDrawer } from '@/components/layout/HeaderNavDrawer';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { useUIStore } from '@/stores/ui-store';

export function Header() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const closeSidebar = useUIStore((s) => s.closeSidebar);

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
            ? 'border-b border-border/60 bg-header-bg'
            : 'border-b border-border/60 bg-header-bg'
        }`}
        style={{ height: '56px' }}
      >
        <HeaderNavDrawer />
        {pathname?.startsWith('/tree/') ? (
          <Link
            href="/"
            onClick={() => closeSidebar()}
            className="shrink-0 font-bold tracking-tight text-foreground"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              fontSize: '1.15rem',
            }}
            aria-label={tNav('logoHome')}
          >
            Craft<span className="text-accent">ree</span>
          </Link>
        ) : (
          <Link
            href="/"
            className="shrink-0 font-bold tracking-tight text-foreground"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              fontSize: '1.15rem',
            }}
          >
            Craft
            <span className="text-accent">ree</span>
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
    </>
  );
}

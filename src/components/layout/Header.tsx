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
import {
  HEADER_COMPACT_TEXT_BUTTON,
  HEADER_ICON_BUTTON,
  HEADER_ICON_IN_BUTTON,
} from '@/components/layout/header-controls';

function IconCategoriesGrid({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const setAddCardModalOpen = useUIStore((s) => s.setAddCardModalOpen);

  const hideHeaderSearch = pathname === '/';
  const isLanding = pathname === '/';

  return (
    <>
      <header
        className={`fixed left-0 right-0 top-0 z-[100] flex h-14 shrink-0 items-center justify-between gap-x-2 px-3 backdrop-blur-md md:gap-x-3 md:px-4 xl:px-6 ${
          isLanding
            ? 'border-b border-border/60 bg-header-bg'
            : 'border-b border-border/60 bg-header-bg'
        }`}
        style={{ height: '56px' }}
      >
        <div className="relative z-[12] flex min-w-0 items-center gap-2">
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
        </div>

        {!hideHeaderSearch ? (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[11] w-[min(calc(100%-1.5rem),calc(31.2rem+60px))] max-w-[min(100%,calc(31.2rem+60px))] -translate-x-1/2 -translate-y-1/2 md:w-[min(calc(100%-2rem),calc(31.2rem+60px))]">
            <div className="pointer-events-auto w-full min-w-0">
              <SearchBar />
            </div>
          </div>
        ) : null}

        <div className="relative z-[12] flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setAddCardModalOpen(true)}
            className={`${HEADER_COMPACT_TEXT_BUTTON} max-w-[min(100vw-8rem,11rem)] truncate whitespace-nowrap sm:max-w-none`}
            title={tNav('addCard')}
          >
            {tNav('addCard')}
          </button>
          <Link
            href="/categories"
            className={HEADER_ICON_BUTTON}
            aria-label={tNav('categories')}
            title={tNav('categories')}
          >
            <IconCategoriesGrid className={HEADER_ICON_IN_BUTTON} />
          </Link>
          <ThemeSwitcher align="end" />
          <LanguageSwitcher align="end" />
          <HeaderAuth />
        </div>
      </header>
    </>
  );
}

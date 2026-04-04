'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
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
import { IconCategoriesGrid } from '@/components/layout/nav-icons';

export function Header() {
  const pathname = usePathname();
  const locale = useLocale();
  const tNav = useTranslations('nav');
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const setAddCardModalOpen = useUIStore((s) => s.setAddCardModalOpen);
  const inventionCount = useGraphStore((s) => s.nodes.length);
  const refreshGraph = useGraphStore((s) => s.refreshData);
  const graphPrefetchDone = useRef(false);
  useEffect(() => {
    if (graphPrefetchDone.current) return;
    graphPrefetchDone.current = true;
    if (useGraphStore.getState().nodes.length === 0) {
      void refreshGraph();
    }
  }, [refreshGraph]);
  const inventionCountFormatted = useMemo(
    () => new Intl.NumberFormat(locale).format(inventionCount),
    [locale, inventionCount]
  );

  const hideHeaderSearch = pathname === '/';

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-[100] flex h-14 shrink-0 items-center justify-between gap-x-2 px-3 md:gap-x-3 md:px-4 xl:px-6 glass-app-header"
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
          <span
            role="status"
            className="hidden min-[480px]:inline-flex items-center rounded-md border border-border/70 bg-surface-elevated/90 px-2 py-1 text-xs font-semibold tabular-nums text-foreground shadow-sm"
            title={tNav('inventionCountTitle', {
              count: inventionCount,
            })}
            aria-label={tNav('inventionCountTitle', {
              count: inventionCount,
            })}
          >
            {inventionCountFormatted}
          </span>
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

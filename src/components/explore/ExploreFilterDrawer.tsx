'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { getCategoryColor } from '@/lib/colors';
import { isRtlLocale } from '@/lib/i18n-config';
import {
  ERA_DATE_RANGES,
  ERA_ORDER,
  NODE_CATEGORY_ORDER,
} from '@/lib/node-labels';
import type { NodeCategory } from '@/lib/types';

const CATEGORY_PREVIEW_COUNT = 5;

/** Contact mail for dev suggestions from the explore drawer (mailto). */
const DEVS_SUGGESTIONS_EMAIL = 'craftree.app@gmail.com';

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.17 6.839 9.493.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.113-4.555-4.951 0-1.094.39-1.988 1.029-2.687-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.699 1.028 1.593 1.028 2.687 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12c0-5.523-4.477-10-10-10z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
    </svg>
  );
}

export function ExploreFilterDrawer() {
  const pathname = usePathname();
  const isExplore = Boolean(pathname?.startsWith('/tree/'));
  const locale = useLocale();
  const isRtl = isRtlLocale(locale);
  const tNav = useTranslations('nav');
  const t = useTranslations('filters');
  const tc = useTranslations('common');
  const tCat = useTranslations('categories');
  const tEra = useTranslations('eras');
  const tFooter = useTranslations('footer');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const open = useUIStore((s) => s.filterDrawerOpen);
  const setOpen = useUIStore((s) => s.setFilterDrawerOpen);
  const activeCategories = useUIStore((s) => s.activeCategories);
  const activeEras = useUIStore((s) => s.activeEras);
  const toggleCategory = useUIStore((s) => s.toggleCategory);
  const toggleEra = useUIStore((s) => s.toggleEra);
  const setAllCategories = useUIStore((s) => s.setAllCategories);
  const setAllEras = useUIStore((s) => s.setAllEras);

  return (
    <>
      <button
        type="button"
        aria-hidden={!open}
        className={`fixed inset-0 top-14 z-[45] bg-black/50 transition-opacity md:top-14 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setOpen(false)}
      />
      <aside
        className={`fixed top-14 z-[50] flex w-[280px] flex-col border-border bg-surface shadow-xl transition-transform duration-300 ease-out ${
          isExplore
            ? 'h-[calc(100dvh-3.5rem)]'
            : 'max-h-[calc(100dvh-3.5rem)] min-h-0'
        } ${
          isRtl
            ? `right-0 border-l ${open ? 'translate-x-0' : 'translate-x-full'}`
            : `left-0 border-r ${open ? 'translate-x-0' : '-translate-x-full'}`
        }`}
        aria-hidden={!open}
      >
        <div className="shrink-0 border-b border-border px-4 py-3">
          <nav
            className="flex flex-col gap-0.5"
            aria-label={tNav('drawerNavigation')}
          >
            <Link
              href="/about"
              className="rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-surface-elevated hover:text-accent"
              onClick={() => setOpen(false)}
            >
              {tc('about')}
            </Link>
            <a
              href="https://github.com/craftreeapp-sudo/craftree"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-foreground transition-colors hover:bg-surface-elevated hover:text-accent"
              onClick={() => setOpen(false)}
            >
              <GitHubMark className="h-4 w-4 shrink-0 opacity-90" />
              {tFooter('github')}
            </a>
            <a
              href={`mailto:${DEVS_SUGGESTIONS_EMAIL}`}
              aria-label={tNav('devsSuggestionsAria')}
              className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-500/45 bg-amber-950/40 px-4 py-2.5 text-sm font-medium text-amber-200 shadow-sm transition-colors hover:border-amber-400/55 hover:bg-amber-950/55 active:scale-[0.99]"
            >
              <MailIcon className="h-[18px] w-[18px] shrink-0" />
              <span>{tNav('devsSuggestions')}</span>
            </a>
          </nav>
        </div>
        {isExplore ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
              <section className="mb-8">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('categories')}
                  </h3>
                  {NODE_CATEGORY_ORDER.length > CATEGORY_PREVIEW_COUNT ? (
                    <button
                      type="button"
                      onClick={() => setShowAllCategories((v) => !v)}
                      className="flex shrink-0 items-center gap-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
                      aria-expanded={showAllCategories}
                      aria-label={
                        showAllCategories ? t('showLess') : t('showMore')
                      }
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`shrink-0 transition-transform duration-200 ${
                          showAllCategories ? 'rotate-180' : ''
                        }`}
                        aria-hidden
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                      <span className="text-[11px] font-medium tabular-nums">
                        {NODE_CATEGORY_ORDER.length}
                      </span>
                    </button>
                  ) : null}
                </div>
                <div className="mb-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-surface-elevated px-2 py-1 text-[11px] text-foreground hover:bg-border"
                    onClick={() => setAllCategories(true)}
                  >
                    {tc('all')}
                  </button>
                  <button
                    type="button"
                    className="rounded bg-surface-elevated px-2 py-1 text-[11px] text-foreground hover:bg-border"
                    onClick={() => setAllCategories(false)}
                  >
                    {tc('none')}
                  </button>
                </div>
                <ul className="space-y-1">
                  {(showAllCategories
                    ? NODE_CATEGORY_ORDER
                    : NODE_CATEGORY_ORDER.slice(0, CATEGORY_PREVIEW_COUNT)
                  ).map((cat) => {
                    const active = activeCategories.has(cat);
                    const color = getCategoryColor(cat);
                    return (
                      <li key={cat}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-elevated/80">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleCategory(cat)}
                            className="h-4 w-4 shrink-0 cursor-pointer rounded border-border bg-page accent-[color:var(--accent)] ring-offset-page focus-visible:ring-2 focus-visible:ring-ring-focus"
                          />
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: color }}
                          />
                          <span
                            className={
                              active ? 'text-foreground' : 'text-muted-foreground'
                            }
                          >
                            {tCat(cat as NodeCategory)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('eras')}
                </h3>
                <div className="mb-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-surface-elevated px-2 py-1 text-[11px] text-foreground hover:bg-border"
                    onClick={() => setAllEras(true)}
                  >
                    {tc('all')}
                  </button>
                  <button
                    type="button"
                    className="rounded bg-surface-elevated px-2 py-1 text-[11px] text-foreground hover:bg-border"
                    onClick={() => setAllEras(false)}
                  >
                    {tc('none')}
                  </button>
                </div>
                <ul className="space-y-1">
                  {ERA_ORDER.map((era) => {
                    const active = activeEras.has(era);
                    return (
                      <li key={era}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-elevated/80">
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleEra(era)}
                            className="h-4 w-4 shrink-0 cursor-pointer rounded border-border bg-page accent-[color:var(--accent)] ring-offset-page focus-visible:ring-2 focus-visible:ring-ring-focus"
                          />
                          <span
                            className={
                              active ? 'text-foreground' : 'text-muted-foreground'
                            }
                          >
                            {tEra(era)}{' '}
                            <span className="text-[11px] text-muted-foreground/90">
                              ({ERA_DATE_RANGES[era]})
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}

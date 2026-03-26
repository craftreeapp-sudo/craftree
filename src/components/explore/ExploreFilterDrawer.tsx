'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import nodesIndexJson from '@/data/nodes-index.json';
import { useUIStore } from '@/stores/ui-store';
import { useAuthStore } from '@/stores/auth-store';
import { getCategoryColor } from '@/lib/colors';
import { isRtlLocale } from '@/lib/i18n-config';
import {
  ERA_DATE_RANGES,
  ERA_ORDER,
  NODE_CATEGORY_ORDER,
} from '@/lib/node-labels';
import type { NodeCategory } from '@/lib/types';

const CATEGORY_PREVIEW_COUNT = 5;

const INVENTION_COUNT = nodesIndexJson.nodes.length;

export function ExploreFilterDrawer() {
  const locale = useLocale();
  const isRtl = isRtlLocale(locale);
  const tAdmin = useTranslations('admin');
  const tNav = useTranslations('nav');
  const t = useTranslations('filters');
  const tc = useTranslations('common');
  const tCat = useTranslations('categories');
  const tEra = useTranslations('eras');
  const tAuth = useTranslations('auth');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const open = useUIStore((s) => s.filterDrawerOpen);
  const setOpen = useUIStore((s) => s.setFilterDrawerOpen);
  const activeCategories = useUIStore((s) => s.activeCategories);
  const activeEras = useUIStore((s) => s.activeEras);
  const toggleCategory = useUIStore((s) => s.toggleCategory);
  const toggleEra = useUIStore((s) => s.toggleEra);
  const setAllCategories = useUIStore((s) => s.setAllCategories);
  const setAllEras = useUIStore((s) => s.setAllEras);
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);

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
        className={`fixed top-14 z-[50] flex h-[calc(100dvh-3.5rem)] w-[280px] flex-col border-[#2A3042] bg-[#111827] shadow-xl transition-transform duration-300 ease-out ${
          isRtl
            ? `right-0 border-l ${open ? 'translate-x-0' : 'translate-x-full'}`
            : `left-0 border-r ${open ? 'translate-x-0' : '-translate-x-full'}`
        }`}
        aria-hidden={!open}
      >
        <div className="shrink-0 border-b border-[#2A3042] px-4 py-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8B95A8]">
            {tNav('drawerNavigation')}
          </h3>
          <nav
            className="flex flex-col gap-0.5"
            aria-label={tNav('drawerNavigation')}
          >
            <Link
              href="/explore"
              className="rounded-md px-2 py-2 text-sm text-[#E8ECF4] transition-colors hover:bg-[#1A1F2E] hover:text-[#3B82F6]"
              onClick={() => setOpen(false)}
            >
              {tc('explore')}
            </Link>
            {user ? (
              <Link
                href="/profile"
                className="rounded-md px-2 py-2 text-sm text-[#E8ECF4] transition-colors hover:bg-[#1A1F2E] hover:text-[#3B82F6]"
                onClick={() => setOpen(false)}
              >
                {tAuth('myProfile')}
              </Link>
            ) : null}
            {user ? (
              <Link
                href="/editor"
                className="rounded-md px-2 py-2 text-sm text-[#E8ECF4] transition-colors hover:bg-[#1A1F2E] hover:text-[#3B82F6]"
                onClick={() => setOpen(false)}
              >
                {tc('allInventions')} ({INVENTION_COUNT})
              </Link>
            ) : null}
            <Link
              href="/about"
              className="rounded-md px-2 py-2 text-sm text-[#E8ECF4] transition-colors hover:bg-[#1A1F2E] hover:text-[#3B82F6]"
              onClick={() => setOpen(false)}
            >
              {tc('about')}
            </Link>
            {isAdmin ? (
              <>
                <div className="my-2 border-t border-[#2A3042]" />
                <Link
                  href="/admin"
                  className="rounded-md px-2 py-2 text-sm text-[#EF4444] transition-colors hover:bg-[#1A1F2E] hover:underline"
                  onClick={() => setOpen(false)}
                >
                  {tAdmin('navLink')}
                </Link>
              </>
            ) : null}
          </nav>
        </div>
        <div className="flex shrink-0 items-center justify-between border-b border-[#2A3042] px-4 py-3">
          <h2 className="text-sm font-semibold text-[#E8ECF4]">{tc('filters')}</h2>
          <button
            type="button"
            className="rounded p-1 text-[#8B95A8] hover:bg-[#1A1F2E] hover:text-[#E8ECF4]"
            aria-label={t('closeFilters')}
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <section className="mb-8">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B95A8]">
              {t('categories')}
            </h3>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                className="rounded bg-[#1A1F2E] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#2A3042]"
                onClick={() => setAllCategories(true)}
              >
                {tc('all')}
              </button>
              <button
                type="button"
                className="rounded bg-[#1A1F2E] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#2A3042]"
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
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#1A1F2E]/80">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleCategory(cat)}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#2A3042] bg-[#0A0E17] accent-[#3B82F6] ring-offset-[#0A0E17] focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                      />
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className={active ? 'text-[#E8ECF4]' : 'text-[#8B95A8]'}>
                        {tCat(cat as NodeCategory)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {NODE_CATEGORY_ORDER.length > CATEGORY_PREVIEW_COUNT ? (
              <button
                type="button"
                className="mt-2 w-full rounded-md border border-[#2A3042] bg-[#1A1F2E] py-2 text-xs font-medium text-[#3B82F6] transition-colors hover:bg-[#2A3042]"
                onClick={() => setShowAllCategories((v) => !v)}
              >
                {showAllCategories ? t('showLess') : t('showMore')}
              </button>
            ) : null}
          </section>

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B95A8]">
              {t('eras')}
            </h3>
            <div className="mb-2 flex gap-2">
              <button
                type="button"
                className="rounded bg-[#1A1F2E] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#2A3042]"
                onClick={() => setAllEras(true)}
              >
                {tc('all')}
              </button>
              <button
                type="button"
                className="rounded bg-[#1A1F2E] px-2 py-1 text-[11px] text-[#E8ECF4] hover:bg-[#2A3042]"
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
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[#1A1F2E]/80">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleEra(era)}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded border-[#2A3042] bg-[#0A0E17] accent-[#3B82F6] ring-offset-[#0A0E17] focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
                      />
                      <span className={active ? 'text-[#E8ECF4]' : 'text-[#8B95A8]'}>
                        {tEra(era)}{' '}
                        <span className="text-[11px] text-[#6B7280]">
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
      </aside>
    </>
  );
}

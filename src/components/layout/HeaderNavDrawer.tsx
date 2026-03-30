'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  HEADER_ICON_BUTTON,
  HEADER_ICON_IN_BUTTON,
} from '@/components/layout/header-controls';

const GITHUB_URL = 'https://github.com/craftreeapp-sudo/craftree';

/** Icône menu (lignes + repères) — distincte de l’ancien « hamburger » à trois barres pleines. */
function IconNavMenu({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="6" cy="6" r="1.5" fill="currentColor" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="6" cy="18" r="1.5" fill="currentColor" />
      <path
        d="M10.5 6H21M10.5 12H21M10.5 18H21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HeaderNavDrawer() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const tFooter = useTranslations('footer');
  const tNav = useTranslations('nav');
  const tContact = useTranslations('contactPage');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const drawer = open ? (
    <>
      <button
        type="button"
        className="fixed inset-x-0 bottom-0 top-14 z-[200] bg-black/60 backdrop-blur-[2px]"
        aria-label={tNav('closeMenu')}
        onClick={() => setOpen(false)}
      />
      <nav
        id="header-nav-drawer"
        className="fixed bottom-0 left-0 top-14 z-[201] flex w-[min(100%,280px)] flex-col gap-1 overflow-y-auto border-r border-white/15 bg-[#14141c] px-4 pb-8 pt-4 text-foreground shadow-2xl"
        aria-label={tNav('drawerNavigation')}
      >
        <Link
          href="/categories"
          className="rounded-lg px-3 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          onClick={() => setOpen(false)}
        >
          {tNav('categories')}
        </Link>
        <Link
          href="/about"
          className="rounded-lg px-3 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          onClick={() => setOpen(false)}
        >
          {tFooter('about')}
        </Link>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg px-3 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          onClick={() => setOpen(false)}
        >
          {tFooter('github')}
        </a>
        <Link
          href="/contact"
          className="rounded-lg px-3 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
          onClick={() => setOpen(false)}
        >
          {tContact('title')}
        </Link>
      </nav>
    </>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`relative z-[102] ${HEADER_ICON_BUTTON} text-foreground`}
        aria-expanded={open}
        aria-controls="header-nav-drawer"
        aria-haspopup="dialog"
        aria-label={open ? tNav('closeMenu') : tNav('openMenu')}
      >
        <IconNavMenu className={`${HEADER_ICON_IN_BUTTON} text-muted-foreground`} />
      </button>

      {mounted && drawer ? createPortal(drawer, document.body) : null}
    </>
  );
}

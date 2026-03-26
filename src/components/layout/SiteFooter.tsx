'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

type Variant = 'default' | 'landing';

/**
 * Pied de page — page d’accueil et shell app (navigation secondaire).
 */
export function SiteFooter({ variant = 'default' }: { variant?: Variant }) {
  const t = useTranslations('footer');
  const tn = useTranslations('nav');

  if (variant === 'landing') {
    return (
      <footer className="mt-auto border-t-[0.5px] border-[#1A1F2E] bg-[#0A0E17] px-4 py-6 md:px-6">
        <div className="mx-auto flex max-w-[960px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <p className="text-center text-[12px] leading-relaxed text-[#5A6175] md:text-start">
            {t('brandLine')}
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-[12px] text-[#5A6175] md:justify-end"
            aria-label={tn('footerNav')}
          >
            <Link
              href="/about"
              className="transition-colors hover:text-[#3B82F6]"
            >
              {t('about')}
            </Link>
            <span className="px-1 text-[#2A3042]" aria-hidden>
              ·
            </span>
            <a
              href="https://github.com/craftreeapp-sudo/craftree"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-[#3B82F6]"
            >
              {t('github')}
            </a>
            <span className="px-1 text-[#2A3042]" aria-hidden>
              ·
            </span>
            <Link
              href="/contact"
              className="transition-colors hover:text-[#3B82F6]"
            >
              {t('contact')}
            </Link>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="mt-auto border-t border-[#2A3042] bg-[#0A0E17]/90 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 text-center sm:flex-row sm:text-left">
        <p
          className="text-sm text-[#8B95A8]"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          {t('brandLine')}
        </p>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm sm:justify-end"
          aria-label={tn('footerNav')}
        >
          <Link
            href="/about"
            className="text-[#8B95A8] transition-colors hover:text-[#3B82F6]"
          >
            {t('about')}
          </Link>
          <a
            href="https://github.com/craftreeapp-sudo/craftree"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8B95A8] transition-colors hover:text-[#3B82F6]"
          >
            {t('github')}
          </a>
          <Link
            href="/contact"
            className="text-[#8B95A8] transition-colors hover:text-[#3B82F6]"
          >
            {t('contact')}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

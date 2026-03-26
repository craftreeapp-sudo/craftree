'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * Pied de page — page d’accueil et shell app (navigation secondaire).
 */
export function SiteFooter() {
  const t = useTranslations('footer');
  const tn = useTranslations('nav');

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

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

const FOOTER_LINKS: {
  href: string;
  labelKey: 'timeline' | 'stats' | 'categories' | 'about' | 'github' | 'contact';
  external?: boolean;
}[] = [
  { href: '/timeline', labelKey: 'timeline' },
  { href: '/stats', labelKey: 'stats' },
  { href: '/categories', labelKey: 'categories' },
  { href: '/about', labelKey: 'about' },
  {
    href: 'https://github.com/craftreeapp-sudo/craftree',
    labelKey: 'github',
    external: true,
  },
  { href: '/contact', labelKey: 'contact' },
];

/**
 * Pied de page — page d’accueil et shell app (navigation secondaire).
 */
export function SiteFooter() {
  const t = useTranslations('footer');
  const tn = useTranslations('nav');

  return (
    <footer className="mt-auto border-t border-[#2A3042] bg-[#0A0E17]/90 px-4 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <p
            className="text-base font-bold text-[#E8ECF4]"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            }}
          >
            Craftree
          </p>
          <p className="mt-1 max-w-xs text-sm text-[#8B95A8]">{t('tagline')}</p>
        </div>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm"
          aria-label={tn('footerNav')}
        >
          {FOOTER_LINKS.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8B95A8] transition-colors hover:text-[#3B82F6]"
              >
                {t(item.labelKey)}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className="text-[#8B95A8] transition-colors hover:text-[#3B82F6]"
              >
                {t(item.labelKey)}
              </Link>
            )
          )}
        </nav>
      </div>
    </footer>
  );
}

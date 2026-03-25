import Link from 'next/link';

const FOOTER_LINKS: {
  href: string;
  label: string;
  external?: boolean;
}[] = [
  { href: '/timeline', label: 'Timeline' },
  { href: '/stats', label: 'Stats' },
  { href: '/categories', label: 'Catégories' },
  { href: '/about', label: 'À propos' },
  {
    href: 'https://github.com/julien-beljio/civtree',
    label: 'GitHub',
    external: true,
  },
  { href: '/contact', label: 'Contact' },
];

/**
 * Pied de page — page d’accueil et shell app (navigation secondaire).
 */
export function SiteFooter() {
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
          <p className="mt-1 max-w-xs text-sm text-[#8B95A8]">
            Les recettes matérielles de la civilisation.
          </p>
        </div>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm"
          aria-label="Pied de page"
        >
          {FOOTER_LINKS.map((item) =>
            item.external ? (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8B95A8] transition-colors hover:text-[#3B82F6]"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className="text-[#8B95A8] transition-colors hover:text-[#3B82F6]"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>
      </div>
    </footer>
  );
}

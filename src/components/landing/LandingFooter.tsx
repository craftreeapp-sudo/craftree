import Link from 'next/link';

const LINKS: {
  href: string;
  label: string;
  external?: boolean;
}[] = [
  { href: '/about', label: 'À propos' },
  { href: 'https://github.com/civtree/civtree', label: 'GitHub', external: true },
  { href: '/contact', label: 'Contact' },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-[#2A3042] bg-[#111827] px-6 py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-10 text-center md:flex-row md:justify-between md:text-left">
        <div>
          <p
            className="text-lg font-bold text-[#E8ECF4]"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            }}
          >
            Craftree
          </p>
          <p className="mt-2 text-sm text-[#8B95A8]">
            Un projet open source — carte des dépendances matérielles de la
            civilisation.
          </p>
        </div>
        <nav
          className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm"
          aria-label="Liens de pied de page"
        >
          {LINKS.map((item) =>
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

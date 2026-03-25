'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SearchBar } from '@/components/ui/SearchBar';

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0A0E17]">
      <nav
        className="absolute left-0 right-0 top-0 z-20 flex items-center px-4 py-3 md:px-6 md:py-4"
        aria-label="Navigation principale"
      >
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-[#E8ECF4]"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          Craft<span className="text-[#3B82F6]">ree</span>
        </Link>
      </nav>

      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-20 pt-28 text-center md:px-6">
        <motion.h1
          className="max-w-3xl font-bold leading-[1.08] tracking-tight text-[#E8ECF4]"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.25rem)',
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          De quoi est faite la civilisation ?
        </motion.h1>

        <motion.p
          className="mt-6 max-w-2xl text-lg leading-relaxed text-[#8B95A8] md:text-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Explorez l&apos;arbre complet des technologies humaines, de la matière
          première au produit final.
        </motion.p>

        <motion.div
          className="mt-10 w-full max-w-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <SearchBar />
        </motion.div>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.35 }}
        >
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-10 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#3B82F6]/25 transition-colors hover:bg-[#60A5FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0E17]"
          >
            Explore
            <span aria-hidden>→</span>
          </Link>
        </motion.div>
      </div>

      <SiteFooter />
    </div>
  );
}

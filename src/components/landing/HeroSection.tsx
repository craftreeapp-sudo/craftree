'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';
import { HeroGraphBackground } from './HeroGraphBackground';

const titleVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.65,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export function HeroSection() {
  return (
    <section className="relative min-h-[min(88vh,820px)] overflow-hidden bg-page md:min-h-[min(92vh,880px)]">
      <div className="hidden md:block">
        <HeroGraphBackground />
      </div>

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-5 pb-16 pt-24 text-center md:px-6 md:pb-24 md:pt-36">
        <motion.h1
          className="max-w-3xl font-bold leading-[1.08] tracking-tight text-foreground"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          }}
          variants={titleVariants}
          initial="hidden"
          animate="visible"
        >
          De quoi est faite la civilisation ?
        </motion.h1>

        <motion.p
          className="mt-6 max-w-2xl text-[20px] leading-relaxed text-muted-foreground"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          Explorez l&apos;arbre complet des technologies humaines, de la matière
          première au produit final.
        </motion.p>

        <motion.div
          className="mt-8 w-full max-w-sm md:mt-10 md:max-w-none"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={treeInventionPath(getDefaultTreeNodeId())}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#3B82F6] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#3B82F6]/25 transition-colors hover:bg-[#60A5FA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#93C5FD] focus-visible:ring-offset-2 focus-visible:ring-offset-page md:inline-flex md:w-auto"
          >
            Explorer
            <span aria-hidden>→</span>
          </Link>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-page to-transparent" />
    </section>
  );
}

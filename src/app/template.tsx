'use client';

import { motion } from 'framer-motion';

/**
 * Transition légère entre routes (alignée sur les animations explore).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0.94, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
      className="flex min-h-screen min-h-[100dvh] flex-1 flex-col bg-page"
    >
      {children}
    </motion.div>
  );
}

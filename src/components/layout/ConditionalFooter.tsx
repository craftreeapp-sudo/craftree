'use client';

import { usePathname } from 'next/navigation';
import { SiteFooter } from '@/components/layout/SiteFooter';

/** Masque le pied de page sur la vue /explore (global + focus). */
export function ConditionalFooter() {
  const pathname = usePathname();
  if (pathname === '/explore') return null;
  return <SiteFooter />;
}

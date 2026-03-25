'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirection client vers /explore?node= après rendu (HTML contient JSON-LD pour les crawlers). */
export function InventionRedirect({ to }: { to: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return null;
}

'use client';

import { useEffect, useState } from 'react';

/**
 * @param query Media query, ex. `(max-width: 767px)` pour mobile (BRIEF §5.9)
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    queueMicrotask(() => {
      setMatches(m.matches);
    });
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** < 768px — vue liste mobile sur /explore */
export function useIsMobileBreakpoint() {
  return useMediaQuery('(max-width: 767px)');
}

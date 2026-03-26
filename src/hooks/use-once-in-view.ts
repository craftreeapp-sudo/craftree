'use client';

import { useEffect, useState } from 'react';

/**
 * `isVisible` passe à true une seule fois quand l’élément intersecte le viewport
 * avec un ratio ≥ threshold (défaut 0.3).
 * Utilise un callback ref pour que l’observation démarre dès que le nœud DOM existe.
 */
export function useOnceInView(threshold = 0.3) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!node || isVisible) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        if (e.isIntersecting && e.intersectionRatio >= threshold) {
          setIsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: [threshold] }
    );

    obs.observe(node);
    return () => obs.disconnect();
  }, [node, isVisible, threshold]);

  return { ref: setNode, isVisible } as const;
}

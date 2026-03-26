'use client';

import { useEffect, useRef, useState } from 'react';

const EASE = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Compte de 0 à `target` en `durationMs` quand `isActive` devient true.
 * Easing ease-out cubique, entiers. Une fois l’animation menée à terme, ne se rejoue pas
 * (si React Strict Mode annule avant la fin, une nouvelle tentative peut avoir lieu).
 */
export function useCountUp(
  target: number,
  durationMs: number,
  isActive: boolean
): number {
  const [value, setValue] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!isActive || completedRef.current) return;

    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = EASE(t);
      setValue(Math.round(target * eased));
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setValue(target);
        completedRef.current = true;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isActive, target, durationMs]);

  return value;
}

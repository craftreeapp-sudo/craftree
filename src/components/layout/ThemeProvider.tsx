'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useThemeStore, applyThemeToDocument } from '@/stores/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  /** Ne pas écraser `data-theme` du bootstrap inline avant réhydratation persist (évite flash / thème faux). */
  const [themeHydrated, setThemeHydrated] = useState(false);

  useEffect(() => {
    if (useThemeStore.persist.hasHydrated()) {
      setThemeHydrated(true);
    }
    const unsub = useThemeStore.persist.onFinishHydration(() => {
      setThemeHydrated(true);
    });
    return unsub;
  }, []);

  useLayoutEffect(() => {
    if (!themeHydrated) return;
    applyThemeToDocument(theme);
  }, [theme, themeHydrated]);

  return children;
}

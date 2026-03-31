'use client';

import { useLayoutEffect } from 'react';
import { useThemeStore, applyThemeToDocument } from '@/stores/theme-store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useLayoutEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  return children;
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { THEME_STORAGE_KEY, type ThemeMode } from '@/lib/theme-constants';

export type { ThemeMode };

export function applyThemeToDocument(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

function normalizeStoredTheme(raw: unknown): ThemeMode {
  if (raw === 'light') return 'light';
  return 'dark';
}

export const useThemeStore = create<{
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => {
        set({ theme });
        applyThemeToDocument(theme);
      },
    }),
    {
      name: THEME_STORAGE_KEY,
      partialize: (s) => ({ theme: s.theme }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const next = normalizeStoredTheme(state.theme);
        if (next !== state.theme) {
          state.theme = next;
        }
        applyThemeToDocument(state.theme);
      },
    }
  )
);

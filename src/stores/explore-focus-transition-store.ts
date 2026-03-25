import { create } from 'zustand';
import { useUIStore } from '@/stores/ui-store';

/**
 * Animation vue focalisée : clic sur un voisin direct (intrant / produit).
 * isAnimating bloque les interactions jusqu’à ~1100 ms.
 */
interface ExploreFocusTransitionStore {
  isAnimating: boolean;
  fromId: string | null;
  toId: string | null;
  /** File depuis navigateToNode — consommée par TechGraph */
  pendingTransition: {
    fromId: string;
    toId: string;
    /** Ouvrir l’éditeur après la transition (ex. crayon sur une carte voisine). */
    openEdit: boolean;
  } | null;
  requestTransition: (
    fromId: string,
    toId: string,
    opts?: { openEdit?: boolean }
  ) => void;
  clearPendingTransition: () => void;
  beginTransition: (fromId: string, toId: string) => void;
  reset: () => void;
}

export const useExploreFocusTransitionStore =
  create<ExploreFocusTransitionStore>((set) => ({
    isAnimating: false,
    fromId: null,
    toId: null,
    pendingTransition: null,

    requestTransition: (fromId, toId, opts) =>
      set({
        pendingTransition: {
          fromId,
          toId,
          openEdit: opts?.openEdit === true,
        },
      }),

    clearPendingTransition: () => set({ pendingTransition: null }),

    beginTransition: (fromId, toId) => {
      useUIStore.getState().setIsAnimating(true);
      set({
        isAnimating: true,
        fromId,
        toId,
        pendingTransition: null,
      });
    },

    reset: () => {
      useUIStore.getState().setIsAnimating(false);
      set({
        isAnimating: false,
        fromId: null,
        toId: null,
        pendingTransition: null,
      });
    },
  }));

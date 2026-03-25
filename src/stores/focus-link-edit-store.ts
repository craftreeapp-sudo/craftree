import { create } from 'zustand';

export type FocusLinkSearchMode = 'inputs' | 'outputs';

/** Édition de liens en vue focalisée /explore (recherche + type de relation). */
interface FocusLinkEditStore {
  /** Barre de recherche ouverte pour ce mode (intrants / produits). */
  searchMode: FocusLinkSearchMode | null;
  /** Après choix d’une invention : choix du type de relation avant POST. */
  relationPick: null | {
    mode: FocusLinkSearchMode;
    otherNodeId: string;
  };

  openSearch: (mode: FocusLinkSearchMode) => void;
  /** L’utilisateur a choisi une invention dans la liste. */
  pickNodeForRelation: (otherNodeId: string) => void;
  /** Fermer recherche / sélecteur sans créer de lien. */
  close: () => void;
  /** Après POST réussi ou annulation du picker. */
  clearRelationPick: () => void;

  /** Pour animer le tracé du nouveau lien (id temporaire). */
  lastCreatedEdgeId: string | null;
  setLastCreatedEdgeId: (id: string | null) => void;
}

export const useFocusLinkEditStore = create<FocusLinkEditStore>((set) => ({
  searchMode: null,
  relationPick: null,
  lastCreatedEdgeId: null,

  setLastCreatedEdgeId: (id) => set({ lastCreatedEdgeId: id }),

  openSearch: (mode) =>
    set({ searchMode: mode, relationPick: null }),

  pickNodeForRelation: (otherNodeId) =>
    set((s) => ({
      relationPick:
        s.searchMode === null
          ? null
          : { mode: s.searchMode, otherNodeId },
      searchMode: null,
    })),

  close: () => set({ searchMode: null, relationPick: null }),

  clearRelationPick: () => set({ relationPick: null }),
}));

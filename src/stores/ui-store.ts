import { create } from 'zustand';
import type { NodeCategory, Era, TechNodeType } from '@/lib/types';
import { NodeCategory as NC, Era as EraEnum } from '@/lib/types';

export interface SelectNodeOptions {
  /** Centrer la vue sur le nœud (ex. navigation depuis la sidebar ou la recherche) */
  center?: boolean;
  /** Mobile /explore : pile d’exploration séquentielle */
  exploreMode?: 'root' | 'push';
  /** /explore : ouvrir directement le formulaire d’édition dans la sidebar */
  openEdit?: boolean;
}

const ALL_CATEGORIES = new Set(Object.values(NC) as NodeCategory[]);
const ALL_ERAS = new Set(Object.values(EraEnum) as Era[]);
const ALL_TYPES = new Set<TechNodeType>([
  'raw_material',
  'material',
  'process',
  'tool',
  'component',
  'end_product',
]);

export type EdgeStyle = 'angular' | 'smooth';

interface UIStore {
  selectedNodeId: string | null;
  isSidebarOpen: boolean;
  /** Verrouillage pendant la transition vue focalisée (clic voisin) ~1,1 s */
  isAnimating: boolean;
  setIsAnimating: (v: boolean) => void;
  /** /explore : survol sans remplacer les nœuds React Flow (évite le clignotement) */
  exploreHoveredNodeId: string | null;
  setExploreHoveredNodeId: (id: string | null) => void;
  /** Consommé par TechGraph pour fitView, puis remis à null */
  centerOnNodeId: string | null;
  /** Un coup : ajuster la vue sur le voisinage direct (recherche / arbre). */
  exploreNeighborhoodFitId: string | null;
  requestExploreNeighborhoodFit: (nodeId: string) => void;
  clearExploreNeighborhoodFit: () => void;
  /** Mobile /explore : fil d’Ariane pour retour arrière */
  exploreStack: string[];

  /** /explore : consommé par NodeDetailSidebar pour ouvrir le mode édition une fois */
  pendingExploreEdit: boolean;
  clearPendingExploreEdit: () => void;

  /** Panneau filtres gauche (vue /explore wireframe) */
  filterDrawerOpen: boolean;
  setFilterDrawerOpen: (open: boolean) => void;
  toggleFilterDrawer: () => void;

  /** Filtres visuels : sous-ensembles actifs (tout activé par défaut) */
  activeCategories: Set<NodeCategory>;
  activeEras: Set<Era>;
  activeTypes: Set<TechNodeType>;

  selectNode: (id: string, options?: SelectNodeOptions) => void;
  closeSidebar: () => void;
  /** Ferme la fiche sans effacer le surlignage voisinage /explore (sync ?node= absent). */
  closeSidebarKeepGraphHover: () => void;
  /** Mobile explore : un niveau de retour dans la pile */
  popExploreStack: () => void;
  clearCenterTarget: () => void;

  toggleCategory: (category: NodeCategory) => void;
  toggleEra: (era: Era) => void;
  toggleType: (type: TechNodeType) => void;
  setAllCategories: (active: boolean) => void;
  setAllEras: (active: boolean) => void;
  setAllTypes: (active: boolean) => void;

  /** Page picker : un seul critère actif, les autres dimensions restent « tout ». */
  setOnlyCategory: (category: NodeCategory) => void;
  setOnlyEra: (era: Era) => void;
  setOnlyType: (type: TechNodeType) => void;

  /** /explore : liens orthogonaux (angles droits) ou courbes de Bézier */
  edgeStyle: EdgeStyle;
  toggleEdgeStyle: () => void;

  /** Vue focalisée /explore : panneau gauche « même catégorie » (✕ masque, bouton rouvre) */
  categoryPanelOpen: boolean;
  setCategoryPanelOpen: (open: boolean) => void;

  /** Modal « connectez-vous pour contribuer » */
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedNodeId: null,
  isSidebarOpen: false,
  isAnimating: false,
  setIsAnimating: (v) => set({ isAnimating: v }),
  exploreHoveredNodeId: null,
  setExploreHoveredNodeId: (id) => set({ exploreHoveredNodeId: id }),
  centerOnNodeId: null,
  exploreNeighborhoodFitId: null,

  requestExploreNeighborhoodFit: (nodeId) =>
    set({ exploreNeighborhoodFitId: nodeId }),

  clearExploreNeighborhoodFit: () => set({ exploreNeighborhoodFitId: null }),

  exploreStack: [],

  pendingExploreEdit: false,
  clearPendingExploreEdit: () => set({ pendingExploreEdit: false }),

  filterDrawerOpen: false,
  setFilterDrawerOpen: (open) => set({ filterDrawerOpen: open }),
  toggleFilterDrawer: () =>
    set((s) => ({ filterDrawerOpen: !s.filterDrawerOpen })),

  activeCategories: new Set(ALL_CATEGORIES),
  activeEras: new Set(ALL_ERAS),
  activeTypes: new Set(ALL_TYPES),

  selectNode: (id, options) =>
    set((s) => {
      let nextStack = s.exploreStack;
      if (options?.exploreMode === 'root') {
        nextStack = [id];
      } else if (options?.exploreMode === 'push') {
        nextStack = [...s.exploreStack, id];
      }
      return {
        selectedNodeId: id,
        isSidebarOpen: true,
        centerOnNodeId: options?.center === true ? id : null,
        exploreNeighborhoodFitId: null,
        exploreStack: nextStack,
        pendingExploreEdit: options?.openEdit === true,
      };
    }),

  closeSidebar: () =>
    set({
      isSidebarOpen: false,
      selectedNodeId: null,
      exploreHoveredNodeId: null,
      centerOnNodeId: null,
      exploreNeighborhoodFitId: null,
      exploreStack: [],
      pendingExploreEdit: false,
      categoryPanelOpen: true,
    }),

  closeSidebarKeepGraphHover: () =>
    set({
      isSidebarOpen: false,
      selectedNodeId: null,
      centerOnNodeId: null,
      exploreStack: [],
      pendingExploreEdit: false,
      categoryPanelOpen: true,
    }),

  popExploreStack: () =>
    set((s) => {
      if (s.exploreStack.length === 0) {
        return {
          isSidebarOpen: false,
          selectedNodeId: null,
          exploreHoveredNodeId: null,
          centerOnNodeId: null,
          exploreNeighborhoodFitId: null,
          exploreStack: [],
          pendingExploreEdit: false,
          categoryPanelOpen: true,
        };
      }
      const nextStack = s.exploreStack.slice(0, -1);
      const nextId =
        nextStack.length > 0 ? nextStack[nextStack.length - 1]! : null;
      return {
        exploreStack: nextStack,
        selectedNodeId: nextId,
        isSidebarOpen: nextId !== null,
        centerOnNodeId: null,
        exploreNeighborhoodFitId: null,
      };
    }),

  clearCenterTarget: () => set({ centerOnNodeId: null }),

  toggleCategory: (category) =>
    set((s) => {
      const next = new Set(s.activeCategories);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return { activeCategories: next };
    }),

  toggleEra: (era) =>
    set((s) => {
      const next = new Set(s.activeEras);
      if (next.has(era)) next.delete(era);
      else next.add(era);
      return { activeEras: next };
    }),

  toggleType: (type) =>
    set((s) => {
      const next = new Set(s.activeTypes);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { activeTypes: next };
    }),

  setAllCategories: (active) =>
    set({
      activeCategories: active ? new Set(ALL_CATEGORIES) : new Set(),
    }),

  setAllEras: (active) =>
    set({
      activeEras: active ? new Set(ALL_ERAS) : new Set(),
    }),

  setAllTypes: (active) =>
    set({
      activeTypes: active ? new Set(ALL_TYPES) : new Set(),
    }),

  setOnlyCategory: (category) =>
    set({
      activeCategories: new Set([category]),
      activeEras: new Set(ALL_ERAS),
      activeTypes: new Set(ALL_TYPES),
    }),

  setOnlyEra: (era) =>
    set({
      activeCategories: new Set(ALL_CATEGORIES),
      activeEras: new Set([era]),
      activeTypes: new Set(ALL_TYPES),
    }),

  setOnlyType: (type) =>
    set({
      activeCategories: new Set(ALL_CATEGORIES),
      activeEras: new Set(ALL_ERAS),
      activeTypes: new Set([type]),
    }),

  edgeStyle: 'smooth',
  toggleEdgeStyle: () =>
    set((s) => ({
      edgeStyle: s.edgeStyle === 'angular' ? 'smooth' : 'angular',
    })),

  categoryPanelOpen: true,
  setCategoryPanelOpen: (open) => set({ categoryPanelOpen: open }),

  loginModalOpen: false,
  setLoginModalOpen: (open) => set({ loginModalOpen: open }),
}));

import { create } from 'zustand';
import type {
  Era,
  MaterialLevel,
  NodeCategory,
  NodeDimension,
} from '@/lib/types';
import { NodeCategory as NC, Era as EraEnum } from '@/lib/types';

export interface SelectNodeOptions {
  /** Centrer la vue sur le nœud (ex. navigation depuis la recherche) */
  center?: boolean;
  /** Mobile /explore : pile d’exploration séquentielle */
  exploreMode?: 'root' | 'push';
}

const ALL_CATEGORIES = new Set(Object.values(NC) as NodeCategory[]);
const ALL_ERAS = new Set(Object.values(EraEnum) as Era[]);
const ALL_DIMENSIONS = new Set<NodeDimension>(['matter', 'process', 'tool']);
const ALL_MATERIAL_LEVELS = new Set<MaterialLevel>([
  'raw',
  'processed',
  'industrial',
  'component',
]);

export type EdgeStyle = 'angular' | 'smooth';

interface UIStore {
  selectedNodeId: string | null;
  /** Verrouillage pendant la transition vue focalisée (clic voisin) ~1,1 s */
  isAnimating: boolean;
  setIsAnimating: (v: boolean) => void;
  /** /explore : survol sans remplacer les nœuds React Flow (évite le clignotement) */
  exploreHoveredNodeId: string | null;
  setExploreHoveredNodeId: (id: string | null) => void;
  /** Consommé par TechTimeline / recherche pour fitView, puis remis à null */
  centerOnNodeId: string | null;
  /** Consommé par TechGraph : recentrage animé après sortie de la vue focalisée /explore. */
  exploreFocusExitCenterId: string | null;
  clearExploreFocusExitCenter: () => void;
  /** Un coup : ajuster la vue sur le voisinage direct (recherche / arbre). */
  exploreNeighborhoodFitId: string | null;
  requestExploreNeighborhoodFit: (nodeId: string) => void;
  clearExploreNeighborhoodFit: () => void;
  /** Mobile /explore : fil d’Ariane pour retour arrière */
  exploreStack: string[];

  /** Incrémenté à chaque `closeSidebar` : `BuiltUponView` ferme `ExploreDetailPanel` (header / logo). */
  exploreDetailDismissNonce: number;

  /** Filtres visuels : sous-ensembles actifs (tout activé par défaut) */
  activeCategories: Set<NodeCategory>;
  activeEras: Set<Era>;
  /** Matière / procédé / outil */
  activeDimensions: Set<NodeDimension>;
  /** Sous-filtre si dimension = matter (nœuds non-matter ignorés pour ce critère) */
  activeMaterialLevels: Set<MaterialLevel>;

  selectNode: (id: string, options?: SelectNodeOptions) => void;
  closeSidebar: () => void;
  /** Ferme la fiche sans effacer le surlignage voisinage /explore (sync ?node= absent). */
  closeSidebarKeepGraphHover: () => void;
  /** Mobile explore : un niveau de retour dans la pile */
  popExploreStack: () => void;
  clearCenterTarget: () => void;

  toggleCategory: (category: NodeCategory) => void;
  toggleEra: (era: Era) => void;
  toggleDimension: (dimension: NodeDimension) => void;
  toggleMaterialLevel: (level: MaterialLevel) => void;
  setAllCategories: (active: boolean) => void;
  setAllEras: (active: boolean) => void;
  setAllDimensions: (active: boolean) => void;
  setAllMaterialLevels: (active: boolean) => void;

  /** Page picker : un seul critère actif, les autres dimensions restent « tout ». */
  setOnlyCategory: (category: NodeCategory) => void;
  setOnlyEra: (era: Era) => void;
  setOnlyDimension: (dimension: NodeDimension) => void;
  /** Filtre uniquement les cartes matière avec ce niveau (dimension matter implicite). */
  setOnlyMaterialLevel: (level: MaterialLevel) => void;

  /** /explore : liens orthogonaux (angles droits) ou courbes de Bézier */
  edgeStyle: EdgeStyle;
  toggleEdgeStyle: () => void;

  /** Vue focalisée /explore : panneau gauche « même catégorie » (✕ masque, bouton rouvre) */
  categoryPanelOpen: boolean;
  setCategoryPanelOpen: (open: boolean) => void;

  /** Modal « connectez-vous pour contribuer » */
  loginModalOpen: boolean;
  setLoginModalOpen: (open: boolean) => void;

  /** Modal globale « Ajouter une carte » (création / suggestion) */
  addCardModalOpen: boolean;
  setAddCardModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedNodeId: null,
  exploreDetailDismissNonce: 0,
  isAnimating: false,
  setIsAnimating: (v) => set({ isAnimating: v }),
  exploreHoveredNodeId: null,
  setExploreHoveredNodeId: (id) => set({ exploreHoveredNodeId: id }),
  centerOnNodeId: null,
  exploreFocusExitCenterId: null,
  exploreNeighborhoodFitId: null,

  requestExploreNeighborhoodFit: (nodeId) =>
    set({ exploreNeighborhoodFitId: nodeId }),

  clearExploreNeighborhoodFit: () => set({ exploreNeighborhoodFitId: null }),

  exploreStack: [],

  activeCategories: new Set(ALL_CATEGORIES),
  activeEras: new Set(ALL_ERAS),
  activeDimensions: new Set(ALL_DIMENSIONS),
  activeMaterialLevels: new Set(ALL_MATERIAL_LEVELS),

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
        centerOnNodeId: options?.center === true ? id : null,
        exploreFocusExitCenterId: null,
        exploreNeighborhoodFitId: null,
        exploreStack: nextStack,
      };
    }),

  closeSidebar: () =>
    set((s) => {
      const lastSelected = s.selectedNodeId;
      const centerAfterExit = lastSelected !== null ? lastSelected : null;
      return {
        selectedNodeId: null,
        exploreHoveredNodeId: null,
        centerOnNodeId: null,
        exploreFocusExitCenterId: centerAfterExit,
        exploreNeighborhoodFitId: null,
        exploreStack: [],
        categoryPanelOpen: true,
        exploreDetailDismissNonce: s.exploreDetailDismissNonce + 1,
      };
    }),

  closeSidebarKeepGraphHover: () =>
    set((s) => ({
      selectedNodeId: null,
      centerOnNodeId: null,
      exploreFocusExitCenterId: null,
      exploreStack: [],
      categoryPanelOpen: true,
      exploreDetailDismissNonce: s.exploreDetailDismissNonce + 1,
    })),

  popExploreStack: () =>
    set((s) => {
      if (s.exploreStack.length === 0) {
        return {
          selectedNodeId: null,
          exploreHoveredNodeId: null,
          centerOnNodeId: null,
          exploreFocusExitCenterId: null,
          exploreNeighborhoodFitId: null,
          exploreStack: [],
          categoryPanelOpen: true,
        };
      }
      const poppedId = s.exploreStack[s.exploreStack.length - 1]!;
      const nextStack = s.exploreStack.slice(0, -1);
      const nextId =
        nextStack.length > 0 ? nextStack[nextStack.length - 1]! : null;
      return {
        exploreStack: nextStack,
        selectedNodeId: nextId,
        centerOnNodeId: null,
        exploreFocusExitCenterId: nextId === null ? poppedId : null,
        exploreNeighborhoodFitId: null,
      };
    }),

  clearCenterTarget: () => set({ centerOnNodeId: null }),

  clearExploreFocusExitCenter: () =>
    set({ exploreFocusExitCenterId: null }),

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

  toggleDimension: (dimension) =>
    set((s) => {
      const next = new Set(s.activeDimensions);
      if (next.has(dimension)) next.delete(dimension);
      else next.add(dimension);
      return { activeDimensions: next };
    }),

  toggleMaterialLevel: (level) =>
    set((s) => {
      const next = new Set(s.activeMaterialLevels);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return { activeMaterialLevels: next };
    }),

  setAllCategories: (active) =>
    set({
      activeCategories: active ? new Set(ALL_CATEGORIES) : new Set(),
    }),

  setAllEras: (active) =>
    set({
      activeEras: active ? new Set(ALL_ERAS) : new Set(),
    }),

  setAllDimensions: (active) =>
    set({
      activeDimensions: active ? new Set(ALL_DIMENSIONS) : new Set(),
    }),

  setAllMaterialLevels: (active) =>
    set({
      activeMaterialLevels: active ? new Set(ALL_MATERIAL_LEVELS) : new Set(),
    }),

  setOnlyCategory: (category) =>
    set({
      activeCategories: new Set([category]),
      activeEras: new Set(ALL_ERAS),
      activeDimensions: new Set(ALL_DIMENSIONS),
      activeMaterialLevels: new Set(ALL_MATERIAL_LEVELS),
    }),

  setOnlyEra: (era) =>
    set({
      activeCategories: new Set(ALL_CATEGORIES),
      activeEras: new Set([era]),
      activeDimensions: new Set(ALL_DIMENSIONS),
      activeMaterialLevels: new Set(ALL_MATERIAL_LEVELS),
    }),

  setOnlyDimension: (dimension) =>
    set({
      activeCategories: new Set(ALL_CATEGORIES),
      activeEras: new Set(ALL_ERAS),
      activeDimensions: new Set([dimension]),
      activeMaterialLevels: new Set(ALL_MATERIAL_LEVELS),
    }),

  setOnlyMaterialLevel: (level) =>
    set({
      activeCategories: new Set(ALL_CATEGORIES),
      activeEras: new Set(ALL_ERAS),
      activeDimensions: new Set(['matter']),
      activeMaterialLevels: new Set([level]),
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

  addCardModalOpen: false,
  setAddCardModalOpen: (open) => set({ addCardModalOpen: open }),
}));

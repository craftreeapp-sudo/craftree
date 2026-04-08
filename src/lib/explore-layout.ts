/** Largeur du panneau latéral explore (fiche invention, suggestion, édition admin associée). */
export const EXPLORE_DETAIL_PANEL_WIDTH_PX = 400;

/**
 * Classe CSS pour le `top` des panneaux `fixed` sur /tree **sauf** la fiche détail :
 * légende desktop — voir `.explore-tree-panel-fixed-top` dans globals.css et
 * `--explore-tree-toolbar-h` sur BuiltUponViewInner.
 * La fiche (`ExploreDetailPanel`) est en `fixed top-14 bottom-0 z-[95]` pour passer au-dessus
 * de la barre d’outils arbre (`z-[90]`).
 */
export const EXPLORE_TREE_PANEL_FIXED_TOP_CLASS = 'explore-tree-panel-fixed-top';

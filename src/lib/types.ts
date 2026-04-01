/**
 * Types CivTree — Modèle de données du graphe de fabrication
 * @see BRIEF.md Section 2 — Architecture des données
 */

// ─── Catégories de nœuds (cartes site — une seule liste) ─────────────────────

export enum NodeCategory {
  ENERGY = 'energy',
  CONSTRUCTION = 'construction',
  WEAPON = 'weapon',
  NETWORK = 'network',
  FOOD = 'food',
  TRANSPORT = 'transport',
  SOFTWARE = 'software',
  INFRASTRUCTURE = 'infrastructure',
  TEXTILE = 'textile',
  COMMUNICATION = 'communication',
  AGRICULTURE = 'agriculture',
  ROBOTICS = 'robotics',
  CHEMISTRY = 'chemistry',
  ELECTRONICS = 'electronics',
  ENVIRONMENT = 'environment',
  AUTOMATION = 'automation',
  MEDICAL = 'medical',
  OPTICAL = 'optical',
  STORAGE = 'storage',
  AERONAUTICS = 'aeronautics',
  SPACE = 'space',
  INDUSTRY = 'industry',
  NANOTECHNOLOGY = 'nanotechnology',
  BIOTECHNOLOGY = 'biotechnology',
  SECURITY = 'security',
  HOME_AUTOMATION = 'home_automation',
}

// ─── Époques ─────────────────────────────────────────────────────────────────

export enum Era {
  PREHISTORIC = 'prehistoric',   // Avant -3000
  ANCIENT = 'ancient',           // -3000 à 500
  MEDIEVAL = 'medieval',         // 500 à 1500
  RENAISSANCE = 'renaissance',   // 1500 à 1750
  INDUSTRIAL = 'industrial',     // 1750 à 1900
  MODERN = 'modern',             // 1900 à 1970
  DIGITAL = 'digital',           // 1970 à 2010
  CONTEMPORARY = 'contemporary', // 2010+
}

/** Nature de l’invention : matière / procédé / outil (+ niveau matière si matter). */
export type NodeDimension = 'matter' | 'process' | 'tool';

/** Niveau matière — uniquement si dimension = matter. */
export type MaterialLevel =
  | 'raw'
  | 'processed'
  | 'industrial'
  | 'component';

/** Origine naturelle (fiche / suggestion de correction). */
export type NaturalOrigin = 'mineral' | 'vegetal' | 'animal';

/** Nature chimique ou physique (fiche / suggestion de correction). */
export type ChemicalNature = 'element' | 'compound' | 'material';

/** Origine naturelle (colonnes DB / seed `origin_type`). */
export type OriginType = 'mineral' | 'vegetal' | 'animal';

/** Nature chimique/physique (colonnes DB / seed `nature_type`). */
export type NatureType = 'element' | 'compose' | 'materiau';

// ─── Nœuds (technologies / ressources) ───────────────────────────────────────

/** Champs chargés avec le graphe (seed-data.json, projection runtime) — pas de textes longs ni médias. */
export interface TechNodeBasic {
  id: string;
  name: string;
  /** Présent quand la projection graphe l’inclut (recherche Fuse, affichage). */
  name_en?: string;
  category: NodeCategory;
  era: Era;
  year_approx?: number; // Négatif = avant JC
  complexity_depth: number;
  tags: string[];
  /** Inventeur, entreprise, pays ou civilisation d’origine (optionnel) */
  origin?: string;
  /** Image illustrative (sinon placeholder par catégorie) */
  image_url?: string;
  /** Matière / procédé / outil — null tant non renseigné. */
  dimension?: NodeDimension | null;
  /** Niveau matière si dimension = matter ; sinon null. */
  materialLevel?: MaterialLevel | null;
  /** Origine naturelle (optionnel). */
  naturalOrigin?: NaturalOrigin | null;
  /** Nature chimique/physique (optionnel). */
  chemicalNature?: ChemicalNature | null;
  /** Classification origine naturelle (seed / Supabase). */
  origin_type?: OriginType | null;
  /** Classification nature chimique/physique (seed / Supabase). */
  nature_type?: NatureType | null;
}

/** Métadonnées étendues (nodes-details.json ou API — chargées à la demande). */
export interface TechNodeDetails {
  name_en: string;
  description: string;
  /** Description courte en anglais (sidebar hors locale FR) */
  description_en?: string;
  image_url?: string;
  wikipedia_url?: string;
  origin?: string | null;
  tags?: string[];
  /** Images additionnelles (galerie) — optionnel, rarement renseigné. */
  extra_image_urls?: string[];
  _ai_built_upon?: string[];
  _ai_led_to?: string[];
}

/** Modèle complet (fusion basic + détails). */
export type TechNode = TechNodeBasic & TechNodeDetails;

// ─── Type de relation (liens de fabrication) ─────────────────────────────────

export enum RelationType {
  MATERIAL = 'material',   // Matière première consommée
  TOOL = 'tool',           // Outil nécessaire (non consommé)
  ENERGY = 'energy',       // Source d'énergie nécessaire
  KNOWLEDGE = 'knowledge', // Connaissance/procédé prérequis
  CATALYST = 'catalyst',   // Catalyseur (facilite mais non strictement requis)
}

// ─── Liens (recettes de fabrication) ─────────────────────────────────────────

export interface CraftingLink {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: RelationType;
  is_optional: boolean;
  notes?: string;
}

/** Nœud tel que stocké dans seed-data.json (graphe + textes pour l’éditeur). */
export interface SeedNode {
  id: string;
  name: string;
  name_en: string;
  description: string;
  description_en?: string;
  category: string;
  era: string;
  year_approx?: number | null;
  complexity_depth: number;
  tags: string[];
  origin?: string;
  image_url?: string;
  wikipedia_url?: string;
  dimension?: NodeDimension | null;
  materialLevel?: MaterialLevel | null;
  /** Origine naturelle (optionnel — colonnes DB / seed). */
  naturalOrigin?: NaturalOrigin | null;
  /** Nature chimique/physique (optionnel). */
  chemicalNature?: ChemicalNature | null;
  origin_type?: OriginType | null;
  nature_type?: NatureType | null;
  _ai_built_upon?: string[];
  _ai_led_to?: string[];
}

/** Fichier seed-data.json */
export interface SeedDataFile {
  nodes: SeedNode[];
  links: CraftingLink[];
}

// ─── Recettes (regroupement des liens) ───────────────────────────────────────

export interface Recipe {
  id: string;
  output_id: string;
  variant_name?: string;         // "Méthode traditionnelle", "Procédé Bessemer", etc.
  inputs: CraftingLink[];
  era: Era;
  is_primary: boolean;
}

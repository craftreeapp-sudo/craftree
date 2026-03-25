# BRIEF PROJET — CivTree : L'Arbre de Fabrication de la Civilisation

## 1. Vision du projet

### Concept fondamental

CivTree est une application web interactive qui modélise **l'intégralité des technologies humaines sous forme d'un graphe de recettes de fabrication**. Contrairement aux arbres technologiques classiques (type Civilization ou Historical Tech Tree) qui montrent des liens d'inspiration ou de chronologie, CivTree représente les **intrants matériels** nécessaires à la production de chaque technologie.

**Principe clé** : chaque nœud est une technologie ou une ressource. Chaque lien signifie « est un intrant nécessaire à la fabrication de ». Le graphe est récursif : on peut remonter de n'importe quelle technologie moderne jusqu'aux matières premières brutes.

### Exemples fondateurs

```
Pot en terre cuite = Argile + Feu
Eau bouillante = Pot en terre cuite + Feu + Eau
Brique = Argile + Feu + Moule
Four = Briques + Feu + Pierre
Verre = Sable (silice) + Four + Soude
Acier = Minerai de fer + Charbon + Four à haute température
Circuit imprimé = Cuivre + Fibre de verre + Résine époxy + Acide (gravure) + Photolithographie
```

### Différenciation

| Aspect | Historical Tech Tree | CivTree |
|--------|---------------------|---------|
| Type de lien | Inspiration / héritage historique | Intrant matériel de fabrication |
| Question posée | « Qu'est-ce qui a mené à X ? » | « De quoi a-t-on besoin pour fabriquer X ? » |
| Direction | Chronologique | Récursive (décomposition) |
| Feuilles du graphe | Premières inventions | Matières premières naturelles |
| Analogie | Arbre généalogique des idées | Recette de cuisine civilisationnelle |

---

## 2. Architecture des données

### 2.1 Modèle de données

#### Nœuds (technologies / ressources)

```typescript
interface TechNode {
  id: string;                    // Identifiant unique (slug)
  name: string;                  // Nom affiché
  name_en: string;               // Nom anglais (pour internationalisation future)
  description: string;           // Description courte (1-2 phrases)
  category: NodeCategory;        // Catégorie principale
  type: 'raw_material' | 'process' | 'tool' | 'component' | 'end_product';
  era: Era;                      // Époque approximative d'apparition
  year_approx?: number;          // Année approximative (négatif = avant JC)
  complexity_depth: number;       // Profondeur max de l'arbre de dépendances (calculé)
  image_url?: string;            // Illustration
  wikipedia_url?: string;        // Lien Wikipedia
  tags: string[];                // Tags libres pour recherche
}
```

#### Catégories de nœuds

```typescript
enum NodeCategory {
  // Matières premières naturelles
  MINERAL = 'mineral',           // Fer, cuivre, silice, argile...
  VEGETAL = 'vegetal',           // Bois, coton, caoutchouc...
  ANIMAL = 'animal',            // Cuir, laine, os...
  ELEMENT = 'element',          // Eau, feu, air...
  ENERGY = 'energy',            // Charbon, pétrole, uranium, électricité...

  // Technologies
  MATERIAL = 'material',        // Acier, verre, plastique, béton...
  TOOL = 'tool',                // Marteau, tour, presse, laser...
  PROCESS = 'process',          // Fonderie, distillation, fermentation...
  MACHINE = 'machine',          // Moteur, pompe, générateur...
  ELECTRONICS = 'electronics',  // Transistor, circuit imprimé, processeur...
  CHEMISTRY = 'chemistry',      // Acide, engrais, médicament...
  CONSTRUCTION = 'construction', // Brique, poutre, pont...
  TRANSPORT = 'transport',      // Roue, bateau, avion...
  COMMUNICATION = 'communication', // Papier, imprimerie, internet...
  FOOD = 'food',                // Pain, fromage, conserve...
  TEXTILE = 'textile',          // Tissu, teinture, fil...
  MEDICAL = 'medical',          // Vaccin, antibiotique, prothèse...
  WEAPON = 'weapon',            // Épée, poudre à canon, missile...
  OPTICAL = 'optical',          // Lentille, microscope, fibre optique...
  SOFTWARE = 'software',        // Algorithme, OS, IA...
}
```

#### Époques

```typescript
enum Era {
  PREHISTORIC = 'prehistoric',   // Avant -3000
  ANCIENT = 'ancient',           // -3000 à 500
  MEDIEVAL = 'medieval',         // 500 à 1500
  RENAISSANCE = 'renaissance',   // 1500 à 1750
  INDUSTRIAL = 'industrial',     // 1750 à 1900
  MODERN = 'modern',             // 1900 à 1970
  DIGITAL = 'digital',           // 1970 à 2010
  CONTEMPORARY = 'contemporary', // 2010+
}
```

#### Liens (recettes de fabrication)

```typescript
interface CraftingLink {
  id: string;
  source_id: string;             // ID de l'intrant
  target_id: string;             // ID du produit
  relation_type: RelationType;
  quantity_hint?: string;         // Indication de quantité ("beaucoup", "trace", "1")
  is_optional: boolean;          // Intrant optionnel ou substitut ?
  notes?: string;                // Précision sur le rôle de l'intrant
}

enum RelationType {
  MATERIAL = 'material',         // Matière première consommée
  TOOL = 'tool',                 // Outil nécessaire (non consommé)
  ENERGY = 'energy',             // Source d'énergie nécessaire
  KNOWLEDGE = 'knowledge',       // Connaissance/procédé prérequis
  CATALYST = 'catalyst',         // Catalyseur (facilite mais non strictement requis)
}
```

#### Recettes (regroupement des liens)

```typescript
interface Recipe {
  id: string;
  output_id: string;             // Technologie produite
  variant_name?: string;         // "Méthode traditionnelle", "Procédé Bessemer", etc.
  inputs: CraftingLink[];        // Liste des intrants
  era: Era;                      // Époque de cette méthode spécifique
  is_primary: boolean;           // Recette principale vs alternative
}
```

> **Point clé** : une même technologie peut avoir PLUSIEURS recettes (le verre peut être fait avec du sable + soude + four, ou sable + potasse + four). Les recettes alternatives sont un aspect fondamental du modèle.

### 2.2 Données initiales (seed)

Le jeu de données initial doit couvrir au minimum **150-200 nœuds** et **300-400 liens** pour être explorable et démonstratif. Organiser le seed autour de « chaînes de fabrication » complètes :

**Chaîne 1 — De la terre à l'électronique** :
Sable → Silicium → Wafer → Transistor → Circuit intégré → Microprocesseur

**Chaîne 2 — De la mine au gratte-ciel** :
Minerai de fer → Fer → Acier → Poutre en acier → Structure métallique
Calcaire + Argile → Ciment → Béton → Fondations

**Chaîne 3 — De la nature à la pharmacie** :
Plantes médicinales → Extraits → Principes actifs → Médicaments
Pétrole → Chimie organique → Polymères → Gélules

**Chaîne 4 — De l'arbre au livre (puis à internet)** :
Bois → Pâte à papier → Papier → Imprimerie → Livre
Cuivre → Fil de cuivre → Câble → Télégraphe → Téléphone → Internet

**Chaîne 5 — De la graine à la table** :
Blé + Eau + Levure + Four → Pain
Lait + Présure + Sel → Fromage
Raisin + Levure + Tonneau → Vin

Le fichier seed sera un JSON structuré (`seed-data.json`) importé au lancement.

### 2.3 Base de données

- **Stockage** : fichier JSON local pour le MVP, avec migration vers Supabase (PostgreSQL) ou Firebase prévue
- **Format d'export/import** : JSON
- Le modèle doit supporter les contributions communautaires à terme (suggestions de nœuds et liens)

---

## 3. Fonctionnalités

### 3.1 MVP (v1)

#### Visualisation du graphe
- **Vue graphe interactive** : affichage du réseau de nœuds et liens avec pan, zoom, et drag
- Les nœuds sont colorés par catégorie (palette cohérente)
- Les liens sont stylisés par type de relation (trait plein pour matériau, pointillé pour outil, ondulé pour énergie, etc.)
- Cliquer sur un nœud ouvre un **panneau de détail** latéral (nom, description, image, recette complète, époque)
- **Vue « explosion »** : depuis n'importe quel nœud, afficher l'arbre complet de ses dépendances récursives (type arbre inversé), jusqu'aux matières premières. C'est LA fonctionnalité signature.

#### Navigation
- **Barre de recherche** globale avec autocomplétion (recherche par nom, catégorie, tag)
- **Filtres** : par catégorie, par époque, par type de nœud, par profondeur de complexité
- **Mode timeline** : axe horizontal = époques, montrant l'apparition progressive des technologies
- **Mode catégorie** : regroupement visuel par domaine technologique

#### Interactions sur le graphe
- Survoler un nœud = mise en surbrillance de tous ses intrants directs et de tous les produits qui l'utilisent
- Double-clic = centrer la vue et afficher les N niveaux de voisinage
- Clic droit ou bouton = « Explorer les dépendances » (vue explosion)
- Possibilité de « verrouiller » des nœuds en place pour comparer

#### Panneau de détail (sidebar)
- Nom + icône de catégorie
- Description (1-3 phrases)
- Image illustrative
- **Recette de fabrication** : liste des intrants avec leur type de relation, sous forme visuelle (petites icônes connectées)
- **Recettes alternatives** si elles existent (onglets)
- **Utilisé dans** : liste des technologies qui utilisent ce nœud comme intrant
- **Profondeur** : nombre de niveaux jusqu'aux matières premières
- Lien Wikipedia
- Époque d'apparition

### 3.2 Fonctionnalités futures (v2+)

- **Contributions communautaires** : formulaire pour suggérer de nouveaux nœuds/liens (modération)
- **Mode quiz/jeu** : « De combien de matières premières a-t-on besoin pour fabriquer un smartphone ? » — l'utilisateur explore et découvre
- **Statistiques** : technologies avec le plus de dépendances, matières premières les plus utilisées, « hub » les plus critiques
- **Comparaison** : mettre deux technologies côte à côte et voir leurs arbres de dépendances se superposer
- **Mode « survie »** : si tu es seul sur une île avec [X ressources], que peux-tu fabriquer ?
- **API publique** : accès aux données du graphe
- **Multi-langue** : FR / EN

---

## 4. Stack technique recommandée

### Frontend
- **Framework** : Next.js 14+ (App Router) avec TypeScript
- **Visualisation du graphe** : **React Flow** (https://reactflow.dev) — parfait pour les graphes interactifs avec nœuds custom, très bien documenté, performant. Alternative : D3.js pour plus de contrôle bas niveau, mais React Flow est plus adapté au cas d'usage.
- **Styling** : Tailwind CSS 4
- **Animations** : Framer Motion pour les transitions UI
- **State management** : Zustand (léger, adapté)
- **Recherche** : Fuse.js (recherche fuzzy côté client pour le MVP)

### Backend (v2)
- **BaaS** : Supabase (PostgreSQL + Auth + Realtime)
- **ORM** : Prisma ou Drizzle
- **Hébergement** : Vercel

### Outils de dev
- **Linter** : ESLint + Prettier
- **Tests** : Vitest

---

## 5. Design & Direction artistique

### 5.1 Identité visuelle

**Nom** : CivTree (ou « TechCraft », « CivGraph », « ForgePath » — à valider)

**Mood** : Interface sombre et immersive, entre un tableau de bord scientifique et un jeu de stratégie. Inspirations visuelles : Factorio (esthétique industrielle), l'interface de Notion (propreté), les dashboards de données spatiales (NASA/SpaceX).

**Pas de** : esthétique « corporate » fade, ni look jeu vidéo cartoon. On cherche un équilibre entre sérieux intellectuel et plaisir d'exploration.

### 5.2 Palette de couleurs

```
Fond principal :         #0A0E17 (noir bleuté profond)
Fond secondaire :        #111827 (gris très foncé)
Fond cartes/panels :     #1A1F2E (gris bleuté)
Bordures subtiles :      #2A3042
Texte principal :        #E8ECF4 (blanc cassé)
Texte secondaire :       #8B95A8 (gris clair)
Accent primaire :        #3B82F6 (bleu vif)
Accent secondaire :      #10B981 (vert émeraude)
Accent tertiaire :       #F59E0B (ambre/or)
Danger / énergie :       #EF4444 (rouge)
```

### 5.3 Couleurs des catégories de nœuds

Chaque catégorie a une couleur distincte pour identification immédiate sur le graphe :

```
MINERAL      → #94A3B8 (gris acier)
VEGETAL      → #22C55E (vert vif)
ANIMAL       → #F97316 (orange)
ELEMENT      → #06B6D4 (cyan)
ENERGY       → #EF4444 (rouge)
MATERIAL     → #6366F1 (indigo)
TOOL         → #A78BFA (violet clair)
PROCESS      → #EC4899 (rose)
MACHINE      → #8B5CF6 (violet)
ELECTRONICS  → #3B82F6 (bleu)
CHEMISTRY    → #14B8A6 (teal)
CONSTRUCTION → #78716C (stone)
TRANSPORT    → #F59E0B (ambre)
COMMUNICATION→ #06B6D4 (cyan)
FOOD         → #84CC16 (lime)
TEXTILE      → #E879F9 (fuchsia)
MEDICAL      → #F43F5E (rose-rouge)
WEAPON       → #DC2626 (rouge foncé)
OPTICAL      → #38BDF8 (sky)
SOFTWARE     → #818CF8 (bleu-violet)
```

### 5.4 Apparence des nœuds sur le graphe

- **Forme** : rectangles arrondis (border-radius: 12px) avec un bandeau coloré à gauche indiquant la catégorie
- **Taille** : proportionnelle à la « centralité » du nœud (combien de liens entrants + sortants)
- **Contenu visible** : icône de catégorie + nom
- **État hover** : glow subtil de la couleur de catégorie, affichage d'un tooltip avec description courte
- **État sélectionné** : bordure lumineuse, ombre portée colorée
- **Nœuds « matière première »** (feuilles) : forme légèrement différente (coins plus arrondis ou hexagonale) pour les distinguer visuellement
- **Nœuds « produit final »** : badge ou icône spéciale (étoile, diamant)

### 5.5 Apparence des liens

- **Matériau (MATERIAL)** : trait plein, épaisseur 2px, couleur de la catégorie source avec opacité 0.6
- **Outil (TOOL)** : trait pointillé, couleur violet clair
- **Énergie (ENERGY)** : trait ondulé ou dashes larges, couleur rouge/ambre
- **Connaissance (KNOWLEDGE)** : trait fin pointillé, couleur bleu clair
- **Catalyseur (CATALYST)** : trait très fin semi-transparent
- **Animation** : les liens « pulsent » subtilement quand un chemin est sélectionné (particules qui suivent le lien, comme un flux de matière)

### 5.6 Typographie

- **Titres** : Inter ou Space Grotesk (bold, géométrique, moderne)
- **Corps** : Inter (lisible, propre)
- **Mono (données techniques)** : JetBrains Mono ou Fira Code
- **Tailles** : Hiérarchie claire avec titre graphe (24px), noms de nœuds (13-16px selon importance), descriptions (14px), metadata (12px)

### 5.7 Layout global

```
┌─────────────────────────────────────────────────────┐
│  HEADER : Logo + Recherche + Filtres + Mode vue     │
├──────────────────────────────────────┬──────────────┤
│                                      │              │
│                                      │   SIDEBAR    │
│           ZONE GRAPHE                │   DÉTAIL     │
│        (plein écran)                 │   (320px)    │
│                                      │              │
│                                      │  - Nom       │
│                                      │  - Recette   │
│                                      │  - Image     │
│                                      │  - Liens     │
│                                      │              │
├──────────────────────────────────────┴──────────────┤
│  BARRE INFÉRIEURE : Mini-map + Contrôles zoom       │
│  + Statistiques (nb nœuds affichés, profondeur...)  │
└─────────────────────────────────────────────────────┘
```

- Le graphe occupe la majeure partie de l'écran (immersif)
- La sidebar se déploie/rétracte à droite au clic sur un nœud
- Le header est compact (50-60px), semi-transparent avec blur backdrop
- La mini-map en bas à gauche (comme dans un éditeur de code ou un jeu de stratégie)
- Mode plein écran disponible (masque le header)

### 5.8 Animations et micro-interactions

- **Ouverture du graphe** : les nœuds apparaissent progressivement depuis le centre (effet de propagation)
- **Sélection d'un nœud** : les nœuds non connectés se grisent, les nœuds liés se rapprochent légèrement
- **Vue explosion** : animation d'arbre qui se « déplie » niveau par niveau, avec un léger délai entre chaque couche
- **Transition entre modes** (graphe → timeline) : morphing fluide des positions
- **Liens actifs** : particules lumineuses qui circulent le long des liens sélectionnés (direction = flux de matière vers le produit)
- **Chargement** : animation de « forge » ou de « crafting » (icône qui s'assemble)
- **Hover sur les catégories** (filtres) : aperçu instantané en surbrillance sur le graphe

### 5.9 Responsive

- **Desktop** (>1280px) : expérience complète avec sidebar
- **Tablette** (768-1280px) : sidebar en overlay, graphe plein écran
- **Mobile** (< 768px) : vue liste/arbre verticale au lieu du graphe 2D libre. Le graphe 2D interactif n'est pas adapté au tactile petit écran. Proposer une vue « exploration séquentielle » : on tape une techno, on voit sa recette, on peut taper sur chaque intrant pour descendre d'un niveau.

---

## 6. Pages et routes

```
/                        → Page d'accueil avec graphe par défaut (vue d'ensemble)
/explore                 → Graphe interactif complet
/explore?node=acier      → Graphe centré sur un nœud spécifique
/tree/[id]               → Vue explosion d'une technologie (arbre de dépendances dédié)
/timeline                → Vue chronologique
/categories              → Navigation par catégorie
/stats                   → Statistiques et visualisations dérivées
/about                   → À propos du projet, méthodologie, crédits
/contribute              → Formulaire de contribution (v2)
```

---

## 7. Page d'accueil (Landing)

La page d'accueil doit immédiatement faire comprendre le concept et donner envie d'explorer.

### Structure

1. **Hero section** : fond sombre avec un fragment animé du graphe en arrière-plan (quelques nœuds et liens qui pulsent doucement). Titre principal : **« De quoi est faite la civilisation ? »** — sous-titre : *« Explorez l'arbre complet des technologies humaines, de la matière première au produit final. »* — CTA : bouton « Explorer le graphe »

2. **Démo interactive** : section avec un exemple interactif embarqué. Par défaut, montrer la chaîne « Sable → Verre → Ampoule → ... ». L'utilisateur peut cliquer et voir l'arbre se déployer. Cela sert de tutoriel implicite.

3. **Chiffres clés** : « X technologies · Y recettes de fabrication · Z matières premières · Profondeur max : N niveaux »

4. **Section « Comment ça marche »** : 3 colonnes avec icônes animées :
   - 🔍 « Cherchez une technologie »
   - 🌳 « Explorez ses dépendances »
   - 🔗 « Découvrez les connexions »

5. **Section « Fait marquant »** : une stat ou un fait contre-intuitif mis en avant chaque semaine (ex : « Un smartphone nécessite plus de 60 matières premières différentes » avec un lien vers l'arbre du smartphone)

6. **Footer** : liens about, contribute, GitHub, crédits, contact

---

## 8. Structure de fichiers

```
civtree/
├── public/
│   ├── images/
│   │   └── nodes/           # Illustrations des technologies
│   ├── favicon.ico
│   └── og-image.png
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx         # Landing page
│   │   ├── explore/
│   │   │   └── page.tsx     # Graphe interactif principal
│   │   ├── tree/
│   │   │   └── [id]/
│   │   │       └── page.tsx # Vue explosion
│   │   ├── timeline/
│   │   │   └── page.tsx
│   │   ├── categories/
│   │   │   └── page.tsx
│   │   ├── stats/
│   │   │   └── page.tsx
│   │   └── about/
│   │       └── page.tsx
│   ├── components/
│   │   ├── graph/
│   │   │   ├── TechGraph.tsx         # Composant graphe principal (React Flow)
│   │   │   ├── TechNode.tsx          # Nœud custom React Flow
│   │   │   ├── TechEdge.tsx          # Lien custom React Flow
│   │   │   ├── GraphControls.tsx     # Contrôles zoom/mode
│   │   │   ├── MiniMap.tsx           # Mini-carte
│   │   │   └── ExplosionTree.tsx     # Vue arbre de dépendances
│   │   ├── ui/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── FilterPanel.tsx
│   │   │   ├── NodeDetailSidebar.tsx
│   │   │   ├── RecipeCard.tsx
│   │   │   ├── CategoryBadge.tsx
│   │   │   ├── EraBadge.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   └── StatsCard.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Sidebar.tsx
│   │   └── landing/
│   │       ├── HeroSection.tsx
│   │       ├── DemoGraph.tsx
│   │       ├── HowItWorks.tsx
│   │       └── FeaturedFact.tsx
│   ├── data/
│   │   └── seed-data.json            # Données initiales complètes
│   ├── lib/
│   │   ├── types.ts                  # Interfaces TypeScript
│   │   ├── graph-utils.ts            # Algorithmes de graphe (BFS, profondeur, centralité)
│   │   ├── search.ts                 # Configuration Fuse.js
│   │   ├── colors.ts                 # Palette et mapping catégories → couleurs
│   │   └── constants.ts
│   ├── stores/
│   │   ├── graph-store.ts            # Zustand : état du graphe
│   │   └── ui-store.ts               # Zustand : état UI (sidebar, filtres, mode)
│   └── styles/
│       └── globals.css
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 9. Algorithmes clés à implémenter

### 9.1 Calcul de profondeur (complexity_depth)

Pour chaque nœud, calculer la longueur du plus long chemin jusqu'à une matière première (feuille du graphe). BFS inversé depuis les feuilles.

```
Matière première → profondeur 0
Pot en terre cuite (argile + feu) → profondeur 1
Eau bouillante (pot + feu + eau) → profondeur 2
...
Microprocesseur → profondeur ~15-20
```

### 9.2 Arbre d'explosion (dependency tree)

Depuis un nœud donné, parcours récursif de tous les intrants (BFS ou DFS), avec détection de cycles (un même nœud peut apparaître plusieurs fois dans l'arbre mais ne doit pas boucler). Retourner un arbre avec niveaux pour l'affichage en couches.

### 9.3 Graphe inversé (usage tree)

Depuis une matière première, trouver TOUT ce qu'on peut fabriquer (directement et indirectement). Utile pour répondre à : « À quoi sert le cuivre ? »

### 9.4 Centralité des nœuds

Calculer un score de « criticité » : combien de technologies dépendent (directement ou indirectement) de ce nœud. Les nœuds les plus critiques (feu, fer, cuivre, silicium) seront visuellement plus gros.

### 9.5 Chemin de fabrication

Trouver le chemin complet entre deux nœuds : « Comment passe-t-on du sable au microprocesseur ? » — afficher la chaîne étape par étape.

---

## 10. Comportements UX détaillés

### 10.1 Premier chargement

1. Le graphe se charge avec une animation de « construction » (nœuds qui apparaissent progressivement)
2. Vue centrée sur un sous-ensemble parlant (ex : chaîne du fer → acier → machine)
3. Tooltip d'onboarding : « Cliquez sur un nœud pour voir sa recette de fabrication »

### 10.2 Interaction avec un nœud

1. **Hover** : tooltip rapide (nom + catégorie + profondeur), nœuds adjacents mis en surbrillance
2. **Clic simple** : ouvre la sidebar de détail, centre doucement la vue
3. **Double-clic** : zoom sur le nœud et affiche 2-3 niveaux de voisinage
4. **Clic sur « Voir l'arbre complet »** dans la sidebar : navigation vers `/tree/[id]` avec vue explosion plein écran
5. **Drag** : déplace le nœud (si mode libre activé)

### 10.3 Sidebar de détail

- Transition slide-in depuis la droite (300ms, ease-out)
- Fermeture par bouton ✕ ou clic en dehors
- Sticky header avec nom + catégorie, contenu scrollable
- Section « Recette » avec mini-schéma visuel : les intrants représentés comme de petits nœuds connectés au produit
- Chaque intrant dans la recette est cliquable (navigation dans le graphe)

### 10.4 Vue Explosion (page dédiée)

- Layout en arbre vertical inversé (produit final en haut, matières premières en bas)
- Chaque niveau = une couche horizontale
- Animation de « dépliage » couche par couche (500ms entre chaque niveau)
- Possibilité de replier/déplier chaque branche
- Code couleur par catégorie conservé
- Breadcrumb en haut : chemin de navigation
- Stats affichées : nombre total de dépendances, profondeur, matières premières requises

---

## 11. SEO et métadonnées

- Chaque nœud a sa propre URL partageable (`/explore?node=acier` ou `/tree/acier`)
- Métadonnées Open Graph dynamiques (titre = nom du nœud, description = sa recette, image = capture du sous-graphe)
- Sitemap généré automatiquement depuis les données
- Schema.org pour les technologies (type `Thing` ou `CreativeWork`)

---

## 12. Performance

- **Rendu du graphe** : React Flow gère le viewport culling nativement (seuls les nœuds visibles sont rendus dans le DOM)
- **Données** : lazy loading des détails (seuls les noms et positions sont chargés initialement, les descriptions/images sont fetchées au clic)
- **Recherche** : index Fuse.js construit une seule fois au chargement
- **Images** : format WebP, lazy loaded, placeholder blur
- **Target** : < 2s First Contentful Paint, < 4s Time to Interactive

---

## 13. Priorités de développement

### Phase 1 — Fondations (semaine 1-2)
- [ ] Setup Next.js + Tailwind + TypeScript
- [ ] Modèle de données TypeScript
- [ ] Fichier seed JSON avec ~50 nœuds et ~80 liens (une chaîne complète)
- [ ] Composant graphe React Flow basique avec nœuds custom
- [ ] Recherche basique

### Phase 2 — Cœur (semaine 3-4)
- [ ] Sidebar de détail complète
- [ ] Algorithme d'explosion (dependency tree)
- [ ] Page vue explosion `/tree/[id]`
- [ ] Filtres par catégorie et époque
- [ ] Styling complet des nœuds et liens

### Phase 3 — Polish (semaine 5-6)
- [ ] Landing page
- [ ] Animations et micro-interactions
- [ ] Mode timeline
- [ ] Page stats
- [ ] Responsive mobile (vue alternative)
- [ ] SEO et métadonnées

### Phase 4 — Contenu (semaine 7+)
- [ ] Enrichissement du seed data à 150-200 nœuds
- [ ] Images pour chaque nœud
- [ ] Descriptions détaillées
- [ ] Tests et optimisation performance

---

## 14. Inspirations visuelles et références

- **Factorio** : le concept de chaînes de production récursives, l'esthétique industrielle
- **React Flow examples** : https://reactflow.dev/examples
- **Historical Tech Tree** : https://www.historicaltechtree.com (pour la structure de données, pas l'UX)
- **Notion** : propreté du design, sidebar de détail
- **Obsidian Graph View** : navigation dans un graphe de connaissances
- **The Pudding** (data journalism) : visualisations de données engageantes et narratives
- **Civilization VI Tech Tree** : layout en couches par époques
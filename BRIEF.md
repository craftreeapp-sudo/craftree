# BRIEF PROJET — Craftree : De quoi est faite la civilisation ?

> **Repo** : https://github.com/craftreeapp-sudo/craftree
> **Site** : https://craftree.app
> **Twitter** : @Craftree_app
> **Email** : craftree.app@gmail.com

---

## 1. Vision du projet

### Concept fondamental

Craftree est une application web interactive qui modélise **les technologies humaines sous forme de recettes de fabrication**. Chaque invention est décomposée en ses intrants : les matières qui la composent, les procédés de transformation, et les outils nécessaires — récursivement jusqu'aux matières premières brutes trouvées dans la nature.

**Question centrale** : « Que faut-il pour fabriquer X ? »

**Principe** : chaque carte est une invention ou une ressource. Chaque lien signifie « est nécessaire à la fabrication de ». On peut remonter de n'importe quelle technologie moderne (smartphone, voiture, panneau solaire) jusqu'au sable, au minerai et à l'eau.

### Exemples

```
Pain = Farine + Eau + Levure + Four
Farine = Blé + Moulin
Acier = Minerai de fer + Charbon + Haut fourneau
Smartphone = Processeur + Écran + Batterie + Assemblage + Usine
Processeur = Silicium + Photolithographie + Salle blanche
Silicium = Sable (silice) + Raffinage
```

### Analogie

Craftree est une **encyclopédie du faire** — comme Wikipedia répond à « Qu'est-ce que c'est ? », Craftree répond à « Comment c'est fait ? ».

---

## 2. Architecture des données

### 2.1 Modèle de données

#### Inventions (table `nodes`)

```typescript
interface TechNode {
  id: string;                    // Identifiant unique (slug)
  name: string;                  // Nom affiché (FR par défaut)
  name_en: string;               // Nom anglais
  description: string;           // Description courte (texte brut, pas de HTML)
  description_en: string;        // Description anglaise
  category: string;              // Catégorie principale (energy, electronics, material, etc.)
  type: string;                  // Type hérité (raw_material, material, process, tool, component)
  dimension: 'matter' | 'process' | 'tool' | null;
  materialLevel: 'raw' | 'processed' | 'industrial' | 'component' | null;
  origin_type: 'mineral' | 'vegetal' | 'animal' | null;
  nature_type: 'element' | 'compose' | 'materiau' | null;
  era: string;                   // Époque
  year_approx?: number;          // Année approximative (clamped entre -10000 et 2030)
  origin?: string;               // Pays / inventeur
  image_url?: string;            // URL image Wikimedia Commons (jamais locale)
  wikipedia_url?: string;        // Lien Wikipedia
  tags: string[];                // Tags pour recherche et classification
  complexity_depth: number;      // Nombre total de cartes requises en amont (calculé)
}
```

#### Les 3 dimensions

| Dimension | Question | Exemples |
|-----------|----------|----------|
| **matter** | De quoi c'est fait ? | Sable, cuivre, acier, batterie, processeur |
| **process** | Comment on transforme ? | Fusion, raffinage, assemblage, forgeage |
| **tool** | Avec quoi on transforme ? | Haut fourneau, machine CNC, usine |

#### Les 4 niveaux de matière (uniquement pour dimension = 'matter')

| Niveau | Description | Test | Exemples |
|--------|-------------|------|----------|
| **raw** | Extrait de la nature, aucune transformation | On le trouve tel quel | Minerai de fer, sable, pétrole brut, bois |
| **processed** | Nouvelle substance créée par transformation | On le mesure au poids/volume | Acier, silicium, plastique, farine |
| **industrial** | Matériau mis en forme pour un usage | Même substance, mais préparée | Fil de cuivre, tôle d'acier, verre trempé |
| **component** | Pièce fonctionnelle autonome | On le compte en unités | Batterie, processeur, moteur, écran |

**Règle de classement** : si on le mesure (kg, litres) → matière (raw/processed/industrial). Si on le compte (1, 2, 3 unités) → component. Les cas ambigus sont gérés par la communauté via les suggestions.

#### Origine naturelle (origin_type) — D'où ça vient dans la nature

Applicable principalement aux matières (dimension = 'matter'). Null si non applicable.

| Origine | Description | Exemples |
|---------|-------------|----------|
| **mineral** | Provient du sol, des roches, du sous-sol. Non vivant. | Pierre, sable, minerais, sel, argile, pétrole, charbon |
| **vegetal** | Provient des plantes. Vivant ou issu du vivant. | Bois, coton, caoutchouc naturel, lin, résine |
| **animal** | Provient des animaux. Vivant ou issu du vivant. | Cuir, laine, soie, os, lait, cire d'abeille |

#### Nature chimique/physique (nature_type) — Ce que c'est physiquement

Applicable principalement aux matières (dimension = 'matter'). Null si non applicable.

| Nature | Description | Test | Exemples |
|--------|-------------|------|----------|
| **element** | Substance pure, un seul type d'atome | Dans le tableau périodique ? | Cuivre (Cu), fer (Fe), silicium (Si) |
| **compose** | Combinaison chimique de plusieurs éléments | A une formule chimique ? | Eau (H₂O), sel (NaCl), sucre |
| **materiau** | Mélange, alliage ou assemblage | Défini par ses propriétés d'usage ? | Acier, béton, verre, plastique, bois |

#### Catégories

energy, construction, weapon, network, food, transport, software, infrastructure, textile, communication, agriculture, robotics, chemistry, electronics, environment, automation, medical, optical, storage, aeronautics, space, industry, nanotechnology, biotechnology, security, home_automation

#### Liens (table `links`)

```typescript
interface CraftingLink {
  id: string;
  source_id: string;             // ID de l'intrant
  target_id: string;             // ID du produit
  relation_type: string;         // material, component, tool, energy, process, infrastructure
  is_optional: boolean;
  notes?: string;
}
```

### 2.2 Base de données

- **Backend** : Supabase (PostgreSQL) — les données sont modifiables sans commits git
- **Données seed** : fichier `src/data/seed-data.json` (backup local) + Supabase (source de vérité)
- **Peuplement IA** : script `scripts/populate.mjs` utilisant l'API Claude — écrit dans seed-data.json ET directement dans Supabase
- **Schéma SQL** : `supabase/schema.sql`
- **Images** : URLs Wikimedia Commons stockées dans `image_url` (jamais de fichiers locaux)

### Migration `relation_type` (anciennes valeurs → officielles)

Si la base Supabase contient encore `knowledge` ou `catalyst` sur `links.relation_type` :

```sql
UPDATE links SET relation_type = 'process' WHERE relation_type = 'knowledge';
UPDATE links SET relation_type = 'tool' WHERE relation_type = 'catalyst';
```

### 2.3 Contraintes SQL importantes

```sql
-- dimension ne peut être que matter, process ou tool
-- materialLevel ne peut être non-null QUE si dimension = 'matter'
-- origin_type : mineral, vegetal, animal (ou null)
-- nature_type : element, compose, materiau (ou null)
-- year_approx : integer entre -10000 et 2030
```

---

## 3. UX — Interface actuelle

### 3.1 Page principale : vue invention unique scrollable

La page principale est une **page unique scrollable** centrée sur une invention. Pas de graphe, pas de React Flow, pas de toggle entre deux vues séparées.

#### Structure verticale de la page (de haut en bas) :

```
┌─────────────────────────────────────────────┐
│ HEADER (sticky)                             │
│ [How to read?]              [Built upon] [Led to] │
├─────────────────────────────────────────────┤
│                                             │
│ ZONE "LED TO" (haut de page)                │
│   Section TOOLS & MACHINES                  │
│   Section PROCESS                           │
│   Section MATTERS (4 sous-colonnes)         │
│                                             │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│                                             │
│         CARTE PRINCIPALE (centrée)          │
│         "33 cards required upstream"        │
│                                             │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
│                                             │
│ ZONE "BUILT UPON" (bas de page)             │
│   Section MATTERS (4 sous-colonnes)         │
│   Section PROCESS                           │
│   Section TOOLS & MACHINES                  │
│                                             │
└─────────────────────────────────────────────┘
```

#### Comportement des boutons "Built upon" / "Led to"
- **Fixes au scroll** (sticky dans le header)
- Clic → **smooth scroll** vers la zone correspondante (navigation par ancre)
- Le bouton actif est mis en **surbrillance** selon la zone visible (**IntersectionObserver**)
- Au chargement, scroll automatique vers "Built upon" par défaut
- Si l'URL contient `?view=led-to`, scroll vers "Led to"

#### Carte d'invention (composant réutilisable)
Chaque carte affiche :
- Image (carrée, coins arrondis) ou placeholder avec initiale colorée
- Nom de l'invention
- Nombre de dépendances directes (badge chiffré)
- Date
- Catégorie principale (badge coloré)

#### Interactions
- **Clic sur une carte** → navigation : recharge la page avec cette carte comme principale
- **Clic sur l'icône info** → ouvre le panneau de détails à droite (slide-in)
- **Hover sur une carte** (desktop) → popup avec infos rapides (délai 300ms)

### 3.2 Panneau de détails (latéral droit)

Slide-in depuis la droite (~300-350px). Contient :
- Nom de l'invention + numéro de complexité
- Badges : catégorie, origin_type (Minéral/Végétal/Animal), nature_type (Élément/Composé/Matériau)
- Tags
- Image principale
- Date
- Origin (inventeur, pays)
- Description
- Bouton "Suggest a correction" (fond ambre)
- Section "LED TO" avec liste cliquable des inventions permises
- Section "BUILT UPON" avec liste cliquable des dépendances
- Chaque élément dans les listes Led To / Built Upon a un bouton X pour suggérer la suppression du lien

### 3.3 Panneau "How to read?" (latéral gauche)

Slide-in depuis la gauche (~300px). Explique :
- Les 3 dimensions (Matters, Process, Tools & Machines) avec exemples
- Les origines naturelles (Minéral, Végétal, Animal) avec tableau
- La nature chimique/physique (Élément, Composé, Matériau) avec tableau
- Traduit via next-intl
- Ne peut pas être ouvert en même temps que le panneau de détails

### 3.4 Section MATTERS — Layout en grille

```
| Raw materials | Processed material | Industrial materials | Components |
```
- CSS Grid avec 4 colonnes de taille égale
- Chaque carte se place dans la colonne correspondant à son `materialLevel`
- Wrap vertical quand une colonne a beaucoup de cartes
- Cette grille à 4 colonnes ne concerne QUE la dimension MATTERS

### 3.5 Sections PROCESS et TOOLS & MACHINES

- Flexbox wrap horizontal simple
- Pas de sous-colonnes
- Les cartes vont à la ligne automatiquement

### 3.6 Landing page

- Fond sombre, plein écran (100vh)
- Titre central : "De quoi est faite la civilisation ?" / "What is civilization made of?"
- Sous-titre explicatif
- Barre de recherche avec autocomplétion + bouton "Explorer l'arbre"
- Cartes d'inventions flottantes en arrière-plan (semi-transparentes, léger drift)
- Pas de sections supplémentaires, pas de scroll

### 3.7 Autres pages

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/[locale]` | Hero section plein écran avec recherche |
| Invention | `/[locale]/tree/[slug]` | Page principale scrollable (Led To + carte + Built Upon) |
| About | `/[locale]/about` | Présentation du projet, comment lire, niveaux de matière |
| Admin | `/[locale]/admin` | Dashboard d'administration des suggestions |
| Editor | `/[locale]/editor` | Table de toutes les inventions (admin only) avec colonnes Dimension, Level, Origin Type, Nature Type |
| Profile | `/[locale]/profile` | Profil utilisateur, historique contributions, rang |

---

## 4. Stack technique

| Couche | Technologie |
|--------|------------|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS |
| State | Zustand |
| Recherche | Fuse.js (⌘K pour focus) |
| Base de données | Supabase (PostgreSQL) |
| Auth | Supabase Auth (Google OAuth) |
| i18n | next-intl (FR, EN, ES, AR, HI, ZH) |
| IA peuplement | API Anthropic Claude (Sonnet) + web search |
| Images | API Wikimedia Commons (gratuit, pas de tokens) |
| Déploiement | Vercel (auto-deploy depuis GitHub) |
| Domaine | craftree.app (Namecheap) |
| Monétisation (futur) | Buy Me a Coffee (buymeacoffee.com/craftree) |

---

## 5. Scripts

### Pipeline principal

```bash
# Remplir la base de données (Claude API → seed-data.json + Supabase)
npm run populate                          # Mode normal : nouvelles inventions
npm run populate:expand                   # Mode expand : enrichir fiches existantes incomplètes
npm run populate:deep                     # Mode deep : expand + dépendances profondes
node scripts/populate.mjs --no-cascade    # Désactive l'effet boule de neige (économie tokens)
node scripts/populate.mjs --test Cuivre   # Test sur une seule invention

# Images (gratuit, pas de Claude)
npm run fix:images                        # Comble les images manquantes via Wikimedia
```

### Scripts disponibles

| Script npm | Fichier | Rôle | Coût |
|-----------|---------|------|------|
| `populate` | `scripts/populate.mjs` | Peuplement IA (Claude + web search) → seed-data.json + Supabase | ~0.03$/invention |
| `populate:expand` | même + `--expand` | Enrichit fiches existantes incomplètes | ~0.03$/fiche |
| `populate:deep` | même + `--deep` | Expand + dépendances profondes | ~0.03$/fiche |
| `fix:images` | `scripts/fix-images.mjs` | Images Wikimedia → Supabase | Gratuit |
| `split-data` | `scripts/split-seed-data.mjs` | Découpe seed-data.json pour le bundle | Gratuit |
| `generate:tag-labels` | `scripts/build-tag-labels-en.mjs` | Traductions FR→EN des tags | Gratuit |
| `generate:og` | `scripts/generate-og.mjs` | Image Open Graph par défaut | Gratuit |
| `cleanup:analytics` | `scripts/cleanup-analytics.mjs` | Purge analytics > 90 jours | Gratuit |

### Modules partagés (pas des scripts CLI)

| Fichier | Rôle |
|---------|------|
| `scripts/wikimedia-fetch.mjs` | Résolution d'URLs d'images Wikipedia/MediaWiki |
| `scripts/supabase-seed-sync.mjs` | Client Supabase service role + mappers pour upsert |

---

## 6. Structure du projet

```
src/
├── app/
│   ├── [locale]/               # Routes internationalisées
│   │   ├── page.tsx            # Landing page
│   │   ├── tree/[slug]/        # Page invention (Led To + carte + Built Upon)
│   │   ├── about/              # À propos
│   │   ├── admin/              # Administration
│   │   ├── editor/             # Éditeur inventions (admin)
│   │   └── profile/            # Profil utilisateur
│   └── api/
│       └── nodes/              # API CRUD inventions
├── components/
│   ├── tree/                   # Composants vue invention (cards, grille, panneaux)
│   ├── editor/                 # Composants éditeur
│   ├── landing/                # Composants landing page
│   └── ui/                     # Composants partagés (search, badges, etc.)
├── lib/
│   ├── types.ts                # Interfaces TypeScript
│   ├── data.ts                 # Requêtes Supabase et mappers
│   ├── node-labels.ts          # Labels dimensions et niveaux
│   ├── node-dimension.ts       # Parsing/validation dimension/materialLevel
│   └── colors.ts               # Palette couleurs par catégorie
├── stores/
│   ├── graph-store.ts          # État des données (inventions, liens)
│   └── ui-store.ts             # État UI (panneaux, filtres)
├── data/
│   └── seed-data.json          # Backup local (Supabase = source de vérité)
├── messages/                   # Traductions next-intl (fr.json, en.json, etc.)
└── styles/
    └── globals.css

scripts/                        # Scripts CLI (hors bundle Next)
├── populate.mjs                # Peuplement IA
├── fix-images.mjs              # Images Wikimedia
├── supabase-seed-sync.mjs      # Module partagé Supabase
├── wikimedia-fetch.mjs         # Module partagé Wikimedia
├── split-seed-data.mjs         # Découpe seed
├── build-tag-labels-en.mjs     # Tags i18n
├── generate-og.mjs             # OG image
└── cleanup-analytics.mjs       # Maintenance
```

---

## 7. Contribution communautaire

### Système de suggestions

- N'importe qui peut suggérer : corrections, nouveaux liens, nouvelles inventions
- Les suggestions anonymes sont acceptées (pas besoin de compte)
- Chaque suggestion est soumise à validation admin avant publication
- Types : correction, nouveau lien, nouvelle invention, suppression de lien, retour anonyme
- Bouton "Suggest a correction" sur chaque fiche

### Profils utilisateurs

- Connexion via Google (Supabase Auth)
- Système de rang : Apprentice → Artisan → Master (basé sur le nombre de contributions approuvées)
- Historique des suggestions (approuvées, en attente, rejetées)

### Page admin

- Dashboard avec compteurs (en attente, approuvées, rejetées, contributeurs)
- Filtres par type de suggestion
- Actions : Approve / Edit then approve / Reject
- Onglets : Pending suggestions, History, Contributors, Analytics

---

## 8. Principes fondamentaux

1. **Pas de produit final** — il n'y a jamais de fin dans la chaîne. Un smartphone est un composant du réseau télécom, qui est un composant d'Internet.
2. **Classification par ce que c'est, pas par étapes** — on classe selon la nature de l'invention (matière vs procédé vs outil), pas selon le nombre de transformations.
3. **Collaboratif** — comme Wikipedia, les données grandissent avec la communauté.
4. **Récursif** — cliquer sur n'importe quel élément ouvre sa propre recette. L'exploration est infinie.
5. **Croissance avant monétisation** — pas de paywall, pas de pub, pas de premium pour l'instant.
6. **Page unique scrollable** — Led To en haut, carte principale au milieu, Built Upon en bas. Pas de pages séparées, pas de toggle entre deux vues.
7. **Supabase = source de vérité** — seed-data.json est un backup local. Le script populate écrit directement dans Supabase.
8. **Images via Wikimedia** — pas de stockage local, pas de téléchargement, URLs directes vers les thumbnails Wikipedia.

---

## 9. Ce qui a été supprimé (ne plus utiliser)

> **IMPORTANT pour Cursor** : les éléments suivants ont été retirés du projet. Ne pas créer de composants, fichiers ou imports les concernant.

- ❌ **React Flow** — supprimé. Plus de graphe interactif avec nœuds et edges SVG.
- ❌ **dagre** — supprimé. Plus de calcul de layout de graphe.
- ❌ **Focus view / Fullscreen view / Global view** — supprimées.
- ❌ **Toggle Built Upon ↔ Led To** — supprimé. Les deux zones sont sur la MÊME page scrollable, pas un toggle entre deux vues.
- ❌ **Filter panel** — supprimé. Plus de panneau de filtres latéral.
- ❌ **Mode timeline** — supprimé.
- ❌ **Mode catégorie** — supprimé.
- ❌ **Mini-map** — supprimée.
- ❌ **Vue explosion en arbre vertical** — supprimée.
- ❌ **Type "end_product"** — supprimé. Il n'y a pas de produit final. Utiliser "component" à la place.
- ❌ **CivTree** — ancien nom. Le projet s'appelle **Craftree**.
- ❌ **import-to-supabase.mjs** — supprimé. Le script populate écrit directement dans Supabase.
- ❌ **fetch-image-urls.mjs** — remplacé par fix-images.mjs.
- ❌ **translate-descriptions.mjs** — supprimé. Le populate génère FR + EN en un seul appel.
- ❌ **clean-descriptions.mjs** — supprimé. Le populate nettoie les descriptions automatiquement.
- ❌ **merge-seed-enrichment.mjs** — supprimé.
- ❌ **Images locales** — ne jamais stocker d'images dans `/images/nodes/` ou `/public/`. Toujours des URLs Wikimedia.

---

## 10. Prochaines étapes

### Court terme
- [ ] Compléter les champs dimension, materialLevel, origin_type, nature_type pour toutes les inventions existantes (via populate --expand)
- [ ] Enrichir la base à 500+ inventions
- [ ] Images Wikimedia pour toutes les cartes (via fix:images)
- [ ] Mettre à jour la page About avec le nouveau contenu
- [ ] Mettre à jour le README GitHub

### Moyen terme
- [ ] OG images auto-générées par invention pour le partage social
- [ ] SEO : sitemap, Schema.org, metadata dynamiques par invention
- [ ] Analytics (Vercel Analytics + table analytics_events)
- [ ] Responsive mobile complet (panneaux en drawers, grille adaptative)

### Viral / croissance
- [ ] Quiz feature ("À partir de quoi est fait X ?")
- [ ] "Craftree of the day" (invention aléatoire quotidienne)
- [ ] Widget embed pour sites tiers
- [ ] Liens externes depuis Wikipedia (section "External links")
- [ ] Partenariats musées / éducation
- [ ] Ciblage communautés : Factorio/Civilization, science communicators, YouTubers

### Monétisation (différée)
- [ ] Buy Me a Coffee (donations)
- [ ] Pro subscription (fonctionnalités avancées)
- [ ] Licences éducatives
- [ ] API access
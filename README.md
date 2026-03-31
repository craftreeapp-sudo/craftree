# Craftree

**What is civilization made of?**

Craftree is an interactive technology tree that maps dependency relationships between human inventions. Instead of showing *when* things were invented, it answers a different question: **what do you need to make them?**

Each invention is decomposed into its materials, processes, tools, and prerequisite technologies — recursively, all the way down to raw materials found in nature.

🌐 **Live:** [craftree.app](https://craftree.app)
🐦 **Twitter:** [@Craftree_app](https://twitter.com/Craftree_app)

---

## How it works

Every invention sits at the center of a single scrollable page:

- **Above it** — everything the invention enables (*Led To*)
- **Below it** — everything the invention requires (*Built Upon*)

Click any card to explore its own recipe. The depth is recursive — a smartphone requires a processor, which requires silicon, which requires sand.

### Three dimensions

Every invention is classified along three dimensions:

| Dimension | Question | Examples |
|---|---|---|
| **Matters** | What is it made of? | Sand, copper, steel, battery, processor |
| **Process** | How do we transform it? | Smelting, refining, assembly, forging |
| **Tools & Machines** | What do we use? | Blast furnace, CNC machine, factory |

### Four material levels

Materials are further classified by how far they've been transformed from nature:

| Level | Description | Examples |
|---|---|---|
| Raw materials | Extracted from nature | Iron ore, sand, crude oil |
| Processed materials | New substance from transformation | Steel, silicon, plastic |
| Industrial materials | Shaped for a specific use | Copper wire, steel sheet |
| Components | Functional piece with a purpose | Battery, engine, processor |

### Natural origin & chemical nature

Materials are also tagged with their natural origin (mineral, vegetal, animal) and their chemical nature (element, compound, material).

---

## Tech stack

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS
- **Database & Auth:** Supabase (PostgreSQL + Google OAuth)
- **Deployment:** Vercel
- **Search:** Fuse.js
- **State management:** Zustand
- **Internationalization:** next-intl (6 languages: FR, EN, ES, AR, HI, ZH)
- **AI data population:** Anthropic Claude API (Haiku for classification, Sonnet for enrichment)
- **Images:** Wikimedia Commons API (free, no local storage)
- **Domain:** craftree.app (Namecheap)

---

## Project structure

```
src/
├── app/
│   ├── [locale]/               # Internationalized routes
│   │   ├── page.tsx            # Landing page
│   │   ├── tree/[slug]/        # Invention page (Led To + Built Upon)
│   │   ├── about/              # About page
│   │   ├── admin/              # Admin dashboard
│   │   ├── editor/             # All inventions editor (admin)
│   │   └── profile/            # User profile
│   └── api/                    # API routes
├── components/
│   ├── tree/                   # Tree view (cards, grid, panels)
│   ├── editor/                 # Editor components
│   ├── landing/                # Landing page components
│   └── ui/                     # Shared UI components
├── lib/                        # Types, utilities, data helpers
├── stores/                     # Zustand stores
├── data/                       # seed-data.json (local backup)
└── messages/                   # i18n translations

scripts/                        # CLI scripts (outside Next bundle)
├── add-inventions.mjs          # Add new inventions via Claude AI
├── enrich-inventions.mjs       # Complete incomplete invention cards
├── fix-images.mjs              # Fetch missing images from Wikimedia
├── wikimedia-fetch.mjs         # Shared Wikimedia API module
├── supabase-seed-sync.mjs      # Shared Supabase upsert module
├── split-seed-data.mjs         # Split seed data for Next bundle
├── build-tag-labels-en.mjs     # Tag translations
├── generate-og.mjs             # Default Open Graph image
└── cleanup-analytics.mjs       # Purge old analytics events
```

---

## Getting started

### Prerequisites

- Node.js 18+
- A Supabase project
- An Anthropic API key (for data population only)

### Setup

```bash
# Clone the repository
git clone https://github.com/craftreeapp-sudo/craftree.git
cd craftree

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY

# Initialize the database
# Run the contents of supabase/schema.sql in your Supabase SQL Editor

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Populating the database

Craftree uses Claude AI to automatically generate invention data. Three scripts handle different tasks:

| Command | What it does | Cost |
|---------|-------------|------|
| `npm run add -- --count 10` | Add 10 new inventions automatically | ~$0.02 |
| `npm run add -- --count 5 --category energy` | Add 5 inventions in a specific category | ~$0.01 |
| `npm run add -- --name "Dynamite,Radar"` | Add specific inventions by name | ~$0.01 |
| `npm run enrich` | Complete all incomplete cards | ~$0.01/10 cards |
| `npm run enrich -- --limit 20` | Complete 20 cards max | ~$0.02 |
| `npm run fix:images` | Fetch missing images from Wikimedia | Free |

### Recommended workflow

```bash
npm run add -- --count 20        # Add inventions
npm run fix:images               # Fetch images
npm run enrich                   # Complete missing fields
```

All scripts write to both `seed-data.json` (local backup) and Supabase (production) simultaneously. Human edits are never overwritten by the scripts.

---

## Data model

Each invention (`node`) has the following attributes:

| Field | Description |
|---|---|
| `name` / `name_en` | Display name (French + English) |
| `description` / `description_en` | Short description (French + English) |
| `category` | Primary category (energy, electronics, etc.) |
| `dimension` | `matter`, `process`, or `tool` |
| `materialLevel` | `raw`, `processed`, `industrial`, or `component` (matter only) |
| `origin_type` | `mineral`, `vegetal`, or `animal` (natural origin) |
| `nature_type` | `element`, `compose`, or `materiau` (chemical nature) |
| `era` | Historical era |
| `year_approx` | Approximate year of invention |
| `origin` | Country and/or inventor |
| `image_url` | Wikimedia Commons image URL |
| `wikipedia_url` | Wikipedia page URL |
| `tags` | Search and classification tags |
| `complexity_depth` | Total cards required upstream (computed) |

Inventions are connected by **links** (`source_id` → `target_id`) with a `relation_type`: material, tool, energy, knowledge, or catalyst.

---

## Contributing

### On the website

Anyone can suggest corrections, add new inventions, or propose new links between technologies directly on [craftree.app](https://craftree.app). All suggestions are reviewed by an admin before being published. No account required for anonymous suggestions.

### On the code

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## License

MIT

---

Built with curiosity by Julien Beljio.
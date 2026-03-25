# Craftree

**Craftree** est une application web qui modélise les technologies humaines sous forme d’un graphe de recettes de fabrication — de la matière première au produit final.

## Prérequis

- [Node.js](https://nodejs.org/) (version compatible avec le projet)
- npm

## Démarrage

Installation des dépendances et lancement du serveur de développement :

```bash
npm install
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000) dans le navigateur.

## Scripts utiles

| Script | Description |
|--------|-------------|
| `npm run dev` | Serveur de développement Next.js |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production après build |
| `npm run lint` | ESLint |
| `npm run generate:og` | Génération d’image Open Graph (`scripts/generate-og.mjs`) |
| `npm run populate` | Outils de peuplement des données (voir `scripts/populate.mjs`) |

## Technique

Projet [Next.js](https://nextjs.org/) avec React, graphe interactif (React Flow / `@xyflow/react`), styles Tailwind CSS, état [Zustand](https://github.com/pmndrs/zustand).

Le site public est prévu sous **https://craftree.app** (URL de base configurable via `NEXT_PUBLIC_SITE_URL`).

## Licence

Projet open source — voir le dépôt GitHub du projet pour les détails.

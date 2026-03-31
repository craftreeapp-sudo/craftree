# Scripts Craftree

## Remplir la base de données

| Commande | Ce qu'elle fait | Coût |
|----------|----------------|------|
| npm run add -- --count 10 | Ajoute 10 nouvelles inventions automatiquement | ~0.02$ |
| npm run add -- --count 5 --category energy | Ajoute 5 inventions dans la catégorie énergie | ~0.01$ |
| npm run add -- --name "Dynamite,Radar" | Ajoute des inventions spécifiques par nom | ~0.01$ |
| npm run enrich | Complète toutes les fiches incomplètes | ~0.01$/10 fiches |
| npm run enrich -- --limit 20 | Complète 20 fiches max | ~0.02$ |
| npm run fix:images | Comble les images manquantes (Wikimedia) | Gratuit |

## Workflow recommandé
1. npm run add -- --count 20          (ajouter des inventions)
2. npm run fix:images                 (combler les images)
3. npm run enrich                     (compléter les champs manquants)
4. Vérifier sur craftree.app que tout est correct

## Autres scripts
| npm run split-data | Découpe seed-data.json pour le bundle |
| npm run generate:og | Image Open Graph par défaut |
| npm run cleanup:analytics | Purge analytics > 90 jours |

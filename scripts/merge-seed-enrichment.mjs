/**
 * Fusionne l’enrichissement dans seed-data.json (usage : node scripts/merge-seed-enrichment.mjs)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const extraNodes = [
  // TEXTILE
  { id: 'coton', name: 'Coton', name_en: 'Cotton', description: 'Fibres végétales filées pour textiles respirants.', category: 'textile', type: 'raw_material', era: 'ancient', year_approx: -5000, complexity_depth: 0, tags: ['textile', 'fibre', 'vêtement'] },
  { id: 'fil-de-coton', name: 'Fil de coton', name_en: 'Cotton yarn', description: 'Fil obtenu par filage et torsion des fibres de coton.', category: 'textile', type: 'material', era: 'ancient', year_approx: -4000, complexity_depth: 1, tags: ['fil', 'tissage'] },
  { id: 'tissu', name: 'Tissu', name_en: 'Woven fabric', description: 'Étoffe produite par entrecroisement de fils sur métier à tisser.', category: 'textile', type: 'material', era: 'ancient', year_approx: -3000, complexity_depth: 2, tags: ['tissu', 'habillement'] },
  { id: 'vetement', name: 'Vêtement', name_en: 'Garment', description: 'Article confectionné à partir de tissus pour se couvrir ou se parer.', category: 'textile', type: 'end_product', era: 'prehistoric', year_approx: -20000, complexity_depth: 3, tags: ['mode', 'couture'] },
  { id: 'laine', name: 'Laine', name_en: 'Wool', description: 'Fibres animales du mouton, isolantes et élastiques.', category: 'animal', type: 'raw_material', era: 'prehistoric', year_approx: -10000, complexity_depth: 0, tags: ['textile', 'tricot'] },
  { id: 'fil-de-laine', name: 'Fil de laine', name_en: 'Wool yarn', description: 'Fil cardé et filé, adapté au tricot et au tissage lourd.', category: 'textile', type: 'material', era: 'prehistoric', year_approx: -8000, complexity_depth: 1, tags: ['fil', 'chaud'] },
  { id: 'tricot', name: 'Tricot', name_en: 'Knitwear', description: 'Textile formé de boucles de fil enchaînées (mailles).', category: 'textile', type: 'end_product', era: 'medieval', year_approx: 1200, complexity_depth: 2, tags: ['pull', 'maille'] },
  { id: 'ver-a-soie', name: 'Ver à soie', name_en: 'Silkworm', description: 'Larve du bombyx produisant le fil de la cocoon.', category: 'animal', type: 'raw_material', era: 'ancient', year_approx: -3000, complexity_depth: 0, tags: ['soie', 'Asie'] },
  { id: 'soie-naturelle', name: 'Soie naturelle', name_en: 'Natural silk', description: 'Fibre protéique filée à partir du cocon du bombyx du mûrier.', category: 'textile', type: 'material', era: 'ancient', year_approx: -3000, complexity_depth: 1, tags: ['luxury', 'tissu'] },
  { id: 'plantes-teinture', name: 'Plantes tinctoriales', name_en: 'Dye plants', description: 'Indigo, garance, gaude : sources de pigments pour teindre.', category: 'vegetal', type: 'raw_material', era: 'ancient', year_approx: -2000, complexity_depth: 0, tags: ['couleur', 'teinture'] },
  { id: 'mordant', name: 'Mordant', name_en: 'Mordant', description: 'Sel métallique fixant le pigment sur la fibre textile.', category: 'chemistry', type: 'material', era: 'ancient', year_approx: -1500, complexity_depth: 1, tags: ['fixateur', 'teinture'] },
  { id: 'teinture-textile', name: 'Teinture textile', name_en: 'Textile dyeing', description: 'Procédé d’application durable des colorants sur fils ou étoffes.', category: 'process', type: 'process', era: 'ancient', year_approx: -2000, complexity_depth: 2, tags: ['couleur', 'industrie'] },

  // TRANSPORT
  { id: 'roue', name: 'Roue', name_en: 'Wheel', description: 'Disque tournant réduisant le frottement au sol pour le transport.', category: 'transport', type: 'component', era: 'ancient', year_approx: -3500, complexity_depth: 1, tags: ['mécanique', 'char'] },
  { id: 'chariot', name: 'Chariot', name_en: 'Wheeled cart', description: 'Véhicule à roues pour transporter charges et personnes.', category: 'transport', type: 'end_product', era: 'ancient', year_approx: -3500, complexity_depth: 2, tags: ['traction', 'route'] },
  { id: 'caoutchouc', name: 'Caoutchouc', name_en: 'Rubber', description: 'Polymère naturel ou synthétique pour pneus et joints étanches.', category: 'material', type: 'raw_material', era: 'industrial', year_approx: 1839, complexity_depth: 0, tags: ['élastique', 'pneu'] },
  { id: 'moteur-explosion', name: 'Moteur à explosion', name_en: 'Internal combustion engine', description: 'Machine thermique convertissant l’essence en mouvement rotatif.', category: 'machine', type: 'machine', era: 'industrial', year_approx: 1876, complexity_depth: 3, tags: ['automobile', 'essence'] },
  { id: 'automobile', name: 'Automobile', name_en: 'Automobile', description: 'Véhicule routier autonome à moteur et châssis métallique.', category: 'transport', type: 'end_product', era: 'industrial', year_approx: 1886, complexity_depth: 5, tags: ['voiture', 'industrie'] },
  { id: 'aluminium', name: 'Aluminium', name_en: 'Aluminium', description: 'Métal léger issu de la bauxite, allié pour aéronautique.', category: 'material', type: 'material', era: 'modern', year_approx: 1886, complexity_depth: 2, tags: ['léger', 'aéronautique'] },
  { id: 'moteur-reaction', name: 'Moteur à réaction', name_en: 'Jet engine', description: 'Propulseur à flux gazeux à haute vitesse pour aviation.', category: 'machine', type: 'machine', era: 'modern', year_approx: 1937, complexity_depth: 4, tags: ['avion', 'turbine'] },
  { id: 'avion', name: 'Avion', name_en: 'Airplane', description: 'Aéronef à voilure fixe propulsé par réaction ou hélice.', category: 'transport', type: 'end_product', era: 'modern', year_approx: 1903, complexity_depth: 6, tags: ['aviation', 'transport'] },

  // ÉNERGIE
  { id: 'charbon-de-bois', name: 'Charbon de bois', name_en: 'Charcoal', description: 'Carbone poreux obtenu par pyrolyse du bois, combustible intense.', category: 'energy', type: 'raw_material', era: 'prehistoric', year_approx: -20000, complexity_depth: 1, tags: ['forge', 'combustible'] },
  { id: 'houille', name: 'Houille', name_en: 'Bituminous coal', description: 'Charbon sédimentaire riche en carbone pour centrales et sidérurgie.', category: 'energy', type: 'raw_material', era: 'industrial', year_approx: 1700, complexity_depth: 0, tags: ['mine', 'thermique'] },
  { id: 'essence', name: 'Essence', name_en: 'Gasoline', description: 'Coupe d’hydrocarbures légers pour moteurs à allumage commandé.', category: 'energy', type: 'material', era: 'industrial', year_approx: 1860, complexity_depth: 1, tags: ['carburant', 'pétrole'] },
  { id: 'uranium', name: 'Uranium', name_en: 'Uranium', description: 'Élément fissile utilisé comme combustible nucléaire enrichi.', category: 'mineral', type: 'raw_material', era: 'modern', year_approx: 1942, complexity_depth: 0, tags: ['nucléaire', 'fission'] },
  { id: 'reacteur-nucleaire', name: 'Réacteur nucléaire', name_en: 'Nuclear reactor', description: 'Cœur où la fission contrôlée produit de la chaleur.', category: 'machine', type: 'machine', era: 'modern', year_approx: 1954, complexity_depth: 3, tags: ['fission', 'centrale'] },
  { id: 'panneau-solaire', name: 'Panneau solaire', name_en: 'Solar panel', description: 'Modules photovoltaïques convertissant la lumière en courant continu.', category: 'electronics', type: 'component', era: 'modern', year_approx: 1954, complexity_depth: 3, tags: ['PV', 'renouvelable'] },

  // CONSTRUCTION
  { id: 'charpente-bois', name: 'Charpente en bois', name_en: 'Timber frame', description: 'Ossature porteuse assemblée en bois pour toitures et planchers.', category: 'construction', type: 'component', era: 'medieval', year_approx: 800, complexity_depth: 2, tags: ['toit', 'ossature'] },
  { id: 'pierre', name: 'Pierre de taille', name_en: 'Dimension stone', description: 'Bloc rocheux extrait et parfois équarr pour maçonnerie.', category: 'mineral', type: 'raw_material', era: 'ancient', year_approx: -2500, complexity_depth: 0, tags: ['mur', 'monument'] },
  { id: 'taille-pierre', name: 'Taille de pierre', name_en: 'Stone dressing', description: 'Façonnage des blocs par sciage et dressage pour l’assemblage.', category: 'process', type: 'process', era: 'ancient', year_approx: -2000, complexity_depth: 1, tags: ['maçonnerie', 'outil'] },
  { id: 'mur-pierre', name: 'Mur en pierre', name_en: 'Stone wall', description: 'Ouvrage vertical maçonné en pierres liées au mortier.', category: 'construction', type: 'component', era: 'ancient', year_approx: -1500, complexity_depth: 3, tags: ['fortification', 'bâtiment'] },
  { id: 'chaux', name: 'Chaux vive', name_en: 'Quicklime', description: 'Oxyde de calcium obtenu par cuisson du calcaire, base du mortier.', category: 'chemistry', type: 'material', era: 'ancient', year_approx: -2000, complexity_depth: 1, tags: ['liant', 'mortier'] },
  { id: 'mortier', name: 'Mortier', name_en: 'Mortar', description: 'Mélange de chaux ou ciment avec sable et eau pour liaison des maçonneries.', category: 'construction', type: 'material', era: 'ancient', year_approx: -1500, complexity_depth: 2, tags: ['joint', 'maçonnerie'] },
  { id: 'vitre', name: 'Vitre', name_en: 'Window glass pane', description: 'Plaque de verre plane pour laisser passer la lumière.', category: 'construction', type: 'component', era: 'ancient', year_approx: 100, complexity_depth: 2, tags: ['fenêtre', 'transparence'] },
  { id: 'fenetre', name: 'Fenêtre', name_en: 'Window', description: 'Percement muni d’un châssis vitré et d’occultants.', category: 'construction', type: 'end_product', era: 'medieval', year_approx: 1200, complexity_depth: 3, tags: ['bâtiment', 'lumière'] },

  // COMMUNICATION (suite)
  { id: 'papyrus', name: 'Papyrus', name_en: 'Papyrus', description: 'Support d’écriture en lamelle de moelle du papyrus nilotique.', category: 'communication', type: 'material', era: 'ancient', year_approx: -3000, complexity_depth: 1, tags: ['Égypte', 'écriture'] },
  { id: 'parchemin', name: 'Parchemin', name_en: 'Parchment', description: 'Peau préparée pour l’écriture, durable et lisse.', category: 'communication', type: 'material', era: 'medieval', year_approx: 200, complexity_depth: 1, tags: ['manuscrit', 'livre'] },
  { id: 'imprimerie', name: 'Imprimerie industrielle', name_en: 'Industrial printing', description: 'Ensemble de rotatives et composition pour tirages de masse.', category: 'process', type: 'process', era: 'industrial', year_approx: 1814, complexity_depth: 3, tags: ['presse', 'journal'] },
  { id: 'journal', name: 'Journal', name_en: 'Newspaper', description: 'Périodique d’information imprimé sur papier bon marché.', category: 'communication', type: 'end_product', era: 'industrial', year_approx: 1704, complexity_depth: 4, tags: ['presse', 'actualité'] },
  { id: 'radio', name: 'Radio', name_en: 'Radio receiver', description: 'Récepteur démodulant les ondes électromagnétiques en son.', category: 'communication', type: 'machine', era: 'modern', year_approx: 1920, complexity_depth: 4, tags: ['ondes', 'audio'] },
  { id: 'television', name: 'Télévision', name_en: 'Television', description: 'Appareil affichant images et son diffusés par ondes ou câble.', category: 'communication', type: 'machine', era: 'modern', year_approx: 1927, complexity_depth: 5, tags: ['image', 'broadcast'] },
  { id: 'ordinateur', name: 'Ordinateur', name_en: 'Computer', description: 'Machine programmable traitant l’information numérique.', category: 'electronics', type: 'machine', era: 'digital', year_approx: 1945, complexity_depth: 5, tags: ['calcul', 'logiciel'] },
  { id: 'smartphone', name: 'Smartphone', name_en: 'Smartphone', description: 'Terminal mobile tactile connecté à Internet et réseaux cellulaires.', category: 'electronics', type: 'end_product', era: 'contemporary', year_approx: 2007, complexity_depth: 7, tags: ['mobile', 'app'] },

  // CHIMIE / ARMES
  { id: 'plastique', name: 'Plastique', name_en: 'Plastic', description: 'Polymère thermoplastique moulable pour emballages et pièces.', category: 'chemistry', type: 'material', era: 'modern', year_approx: 1907, complexity_depth: 2, tags: ['PE', 'moulage'] },
  { id: 'bouteille-plastique', name: 'Bouteille plastique', name_en: 'Plastic bottle', description: 'Contenant soufflé en PET pour liquides alimentaires.', category: 'food', type: 'end_product', era: 'modern', year_approx: 1973, complexity_depth: 3, tags: ['emballage', 'recyclage'] },
  { id: 'engrais', name: 'Engrais azoté', name_en: 'Nitrogen fertilizer', description: 'Amendement issu du procédé Haber-Bosch ou du nitrate.', category: 'chemistry', type: 'material', era: 'modern', year_approx: 1913, complexity_depth: 2, tags: ['agriculture', 'rendement'] },
  { id: 'salpetre', name: 'Salpêtre', name_en: 'Saltpeter', description: 'Nitrate de potassium, oxydant majeur des poudres.', category: 'mineral', type: 'raw_material', era: 'medieval', year_approx: 1200, complexity_depth: 0, tags: ['explosif', 'chimie'] },
  { id: 'soufre', name: 'Soufre', name_en: 'Sulfur', description: 'Élément jaune comburant secondaire dans les mélanges explosifs.', category: 'mineral', type: 'raw_material', era: 'ancient', year_approx: -500, complexity_depth: 0, tags: ['explosif', 'acide'] },
  { id: 'poudre-a-canon', name: 'Poudre à canon', name_en: 'Gunpowder', description: 'Mélange salpêtre–charbon–soufre déflagrant sous choc ou flamme.', category: 'weapon', type: 'material', era: 'medieval', year_approx: 850, complexity_depth: 2, tags: ['explosif', 'arme'] },

  // OPTIQUE
  { id: 'lentille', name: 'Lentille optique', name_en: 'Optical lens', description: 'Verre poli courbé pour converger ou diverger la lumière.', category: 'optical', type: 'component', era: 'renaissance', year_approx: 1280, complexity_depth: 2, tags: ['optique', 'verre'] },
  { id: 'lunettes', name: 'Lunettes', name_en: 'Eyeglasses', description: 'Monture portant des verres correcteurs pour la vision.', category: 'optical', type: 'end_product', era: 'renaissance', year_approx: 1286, complexity_depth: 3, tags: ['vue', 'correction'] },
  { id: 'microscope', name: 'Microscope', name_en: 'Microscope', description: 'Instrument grossissant le très petit par lentilles combinées.', category: 'optical', type: 'machine', era: 'renaissance', year_approx: 1590, complexity_depth: 4, tags: ['science', 'lentille'] },
  { id: 'telescope', name: 'Télescope', name_en: 'Telescope', description: 'Instrument astronomique collectant la lumière lointaine.', category: 'optical', type: 'machine', era: 'renaissance', year_approx: 1608, complexity_depth: 4, tags: ['astronomie', 'lunette'] },

  // ALIMENTATION
  { id: 'viande', name: 'Viande', name_en: 'Meat', description: 'Muscle animal frais ou préparé, riche en protéines.', category: 'animal', type: 'raw_material', era: 'prehistoric', year_approx: -50000, complexity_depth: 0, tags: ['protéine', 'aliment'] },
  { id: 'salaison', name: 'Salaison', name_en: 'Salted meat', description: 'Viande conservée par saumure et séchage pour longue durée.', category: 'food', type: 'end_product', era: 'ancient', year_approx: -2000, complexity_depth: 2, tags: ['conservation', 'sel'] },
  { id: 'canne-a-sucre', name: 'Canne à sucre', name_en: 'Sugarcane', description: 'Graminée tropicale dont le jus est riche en saccharose.', category: 'vegetal', type: 'raw_material', era: 'ancient', year_approx: -8000, complexity_depth: 0, tags: ['sucre', 'tropical'] },
  { id: 'sucre', name: 'Sucre de canne', name_en: 'Cane sugar', description: 'Saccharose cristallisé après évaporation et raffinage.', category: 'food', type: 'material', era: 'ancient', year_approx: 500, complexity_depth: 1, tags: ['sucré', 'pâtisserie'] },
  { id: 'confiserie', name: 'Confiserie', name_en: 'Confectionery', description: 'Bonbons et pâtes à base de sucre cuit et arômes.', category: 'food', type: 'end_product', era: 'medieval', year_approx: 1200, complexity_depth: 2, tags: ['bonbon', 'dessert'] },
  { id: 'cacao', name: 'Fèves de cacao', name_en: 'Cocoa beans', description: 'Graines fermentées du cacaoyer, base du chocolat.', category: 'vegetal', type: 'raw_material', era: 'ancient', year_approx: -1500, complexity_depth: 0, tags: ['chocolat', 'Mesoamérique'] },
  { id: 'chocolat', name: 'Chocolat', name_en: 'Chocolate', description: 'Préparation à base de pâte de cacao, sucre et souvent lait.', category: 'food', type: 'end_product', era: 'renaissance', year_approx: 1520, complexity_depth: 3, tags: ['dessert', 'industrie'] },
  { id: 'houblon', name: 'Houblon', name_en: 'Hops', description: 'Inflorescences amérisantes et conservatrices de la bière.', category: 'vegetal', type: 'raw_material', era: 'medieval', year_approx: 800, complexity_depth: 0, tags: ['bière', 'amer'] },
  { id: 'orge', name: 'Orge', name_en: 'Barley', description: 'Céréale maltée pour brasser la bière et alimenter le moût.', category: 'vegetal', type: 'raw_material', era: 'ancient', year_approx: -5000, complexity_depth: 0, tags: ['malt', 'brasserie'] },
  { id: 'biere', name: 'Bière', name_en: 'Beer', description: 'Boisson fermentée du malt, houblonnée et gazéifiée.', category: 'food', type: 'end_product', era: 'ancient', year_approx: -3500, complexity_depth: 2, tags: ['fermentation', 'brasserie'] },

  // Extras & intermédiaires (densité graphe)
  { id: 'metier-tisser', name: 'Métier à tisser', name_en: 'Loom', description: 'Machine à entrecroiser les fils pour former le tissu.', category: 'machine', type: 'tool', era: 'ancient', year_approx: -4000, complexity_depth: 1, tags: ['textile', 'tissage'] },
  { id: 'eau-de-chaux', name: 'Eau de chaux', name_en: 'Limewater', description: 'Solution de hydroxyde de calcium pour mortiers et peintures.', category: 'chemistry', type: 'material', era: 'ancient', year_approx: -1000, complexity_depth: 1, tags: ['mortier', 'chaux'] },
  { id: 'bauxite', name: 'Bauxite', name_en: 'Bauxite', description: 'Minerai alumineux servant à produire l’aluminium par électrolyse.', category: 'mineral', type: 'raw_material', era: 'industrial', year_approx: 1821, complexity_depth: 0, tags: ['aluminium', 'mine'] },
  { id: 'raffinerie', name: 'Raffinerie', name_en: 'Oil refinery', description: 'Installation de distillation fractionnée du pétrole brut.', category: 'process', type: 'process', era: 'industrial', year_approx: 1860, complexity_depth: 2, tags: ['pétrole', 'essence'] },
  { id: 'antenne-radio', name: 'Antenne radio', name_en: 'Radio antenna', description: 'Structure captant les ondes HF pour réception et émission.', category: 'electronics', type: 'component', era: 'modern', year_approx: 1895, complexity_depth: 2, tags: ['RF', 'ondes'] },
  { id: 'tube-cathodique', name: 'Tube cathodique', name_en: 'CRT', description: 'Écran à balayage électronique pour affichage analogique.', category: 'electronics', type: 'component', era: 'modern', year_approx: 1897, complexity_depth: 3, tags: ['image', 'TV'] },
  { id: 'eau-lourde', name: 'Eau lourde', name_en: 'Heavy water', description: 'Modérateur possible dans certains réacteurs (rôle pédagogique).', category: 'chemistry', type: 'material', era: 'modern', year_approx: 1934, complexity_depth: 1, tags: ['nucléaire', 'modérateur'] },
  { id: 'beton-arme', name: 'Béton armé', name_en: 'Reinforced concrete', description: 'Béton coulé sur armature d’acier pour résistance à la traction.', category: 'construction', type: 'material', era: 'industrial', year_approx: 1853, complexity_depth: 4, tags: ['génie civil', 'pont'] },
  { id: 'pneu', name: 'Pneu', name_en: 'Tire', description: 'Enveloppe caoutchouc gonflée assurant l’adhérence routière.', category: 'transport', type: 'component', era: 'industrial', year_approx: 1888, complexity_depth: 2, tags: ['caoutchouc', 'roue'] },
  { id: 'chassis-auto', name: 'Châssis automobile', name_en: 'Car chassis', description: 'Structure porteuse en acier ou aluminium du véhicule.', category: 'transport', type: 'component', era: 'industrial', year_approx: 1900, complexity_depth: 3, tags: ['assemblage', 'acier'] },
  { id: 'carlingue', name: 'Carlingue', name_en: 'Fuselage', description: 'Enveloppe structurelle de l’avion en alliages légers.', category: 'transport', type: 'component', era: 'modern', year_approx: 1935, complexity_depth: 4, tags: ['aéronautique', 'alu'] },
  { id: 'gazole', name: 'Gazole', name_en: 'Diesel fuel', description: 'Coupe lourde pour moteurs diesel industriels et trains.', category: 'energy', type: 'material', era: 'industrial', year_approx: 1892, complexity_depth: 1, tags: ['diesel', 'pétrole'] },
  { id: 'turbine-vapeur', name: 'Turbine à vapeur', name_en: 'Steam turbine', description: 'Machine thermique entraînant alternateurs dans les centrales.', category: 'machine', type: 'machine', era: 'industrial', year_approx: 1884, complexity_depth: 3, tags: ['thermique', 'électricité'] },
  { id: 'alternateur', name: 'Alternateur', name_en: 'Alternator', description: 'Générateur produisant du courant alternatif triphasé.', category: 'electronics', type: 'component', era: 'industrial', year_approx: 1891, complexity_depth: 2, tags: ['réseau', 'AC'] },
  { id: 'reseau-electrique', name: 'Réseau électrique', name_en: 'Power grid', description: 'Transport et distribution de l’électricité à grande échelle.', category: 'energy', type: 'process', era: 'industrial', year_approx: 1896, complexity_depth: 3, tags: ['HT', 'transport'] },
  { id: 'onduleur-solaire', name: 'Onduleur solaire', name_en: 'Solar inverter', description: 'Convertit le courant continu des panneaux en AC pour le réseau.', category: 'electronics', type: 'component', era: 'contemporary', year_approx: 1995, complexity_depth: 3, tags: ['PV', 'grille'] },
  { id: 'fonte', name: 'Fonte', name_en: 'Cast iron', description: 'Alliage fer–carbone coulé, étape entre fer et acier.', category: 'material', type: 'material', era: 'industrial', year_approx: 1709, complexity_depth: 2, tags: ['sidérurgie', 'moule'] },
  { id: 'acier-inox', name: 'Acier inoxydable', name_en: 'Stainless steel', description: 'Acier allié au chrome résistant à la corrosion.', category: 'material', type: 'material', era: 'modern', year_approx: 1913, complexity_depth: 3, tags: ['chimie', 'alimentaire'] },
  { id: 'tissu-teint', name: 'Tissu teint', name_en: 'Dyed fabric', description: 'Étoffe après fixation des pigments et mordantage.', category: 'textile', type: 'material', era: 'ancient', year_approx: -1500, complexity_depth: 3, tags: ['mode', 'couleur'] },
  { id: 'filature', name: 'Filature', name_en: 'Spinning mill', description: 'Atelier mécanisé alignant les fibres en fil continu.', category: 'process', type: 'process', era: 'industrial', year_approx: 1771, complexity_depth: 2, tags: ['industrie', 'coton'] },
  { id: 'mouton', name: 'Mouton', name_en: 'Sheep', description: 'Ruminant élevé pour laine, viande et lait.', category: 'animal', type: 'raw_material', era: 'prehistoric', year_approx: -9000, complexity_depth: 0, tags: ['élevage', 'laine'] },
  { id: 'mulberry', name: 'Mûrier', name_en: 'Mulberry', description: 'Arbre nourricier du bombyx du ver à soie.', category: 'vegetal', type: 'raw_material', era: 'ancient', year_approx: -3000, complexity_depth: 0, tags: ['soie', 'feuille'] },
  { id: 'feuille-or', name: 'Feuille d’or', name_en: 'Gold leaf', description: 'Or battu pour dorure décorative sur bois ou papier.', category: 'material', type: 'material', era: 'ancient', year_approx: -500, complexity_depth: 1, tags: ['luxe', 'dorure'] },
  { id: 'or', name: 'Or', name_en: 'Gold', description: 'Métal noble ductile, résistant à l’oxydation.', category: 'mineral', type: 'raw_material', era: 'prehistoric', year_approx: -4000, complexity_depth: 0, tags: ['monnaie', 'bijou'] },
  { id: 'scierie', name: 'Scierie', name_en: 'Sawmill', description: 'Usine découpant les grumes en planches et poutres.', category: 'process', type: 'process', era: 'medieval', year_approx: 1300, complexity_depth: 2, tags: ['bois', 'charpente'] },
  { id: 'planche-bois', name: 'Planche de bois', name_en: 'Lumber board', description: 'Pièce sciée servant aux charpentes et menuiseries.', category: 'material', type: 'material', era: 'ancient', year_approx: -2000, complexity_depth: 1, tags: ['construction', 'bois'] },
  { id: 'verre-trempe', name: 'Verre trempé', name_en: 'Tempered glass', description: 'Vitre renforcée thermiquement pour sécurité des façades.', category: 'material', type: 'material', era: 'modern', year_approx: 1929, complexity_depth: 3, tags: ['sécurité', 'bâtiment'] },
  { id: 'acier-structure', name: 'Profilé acier', name_en: 'Steel section', description: 'Poutrelles laminées pour ossatures industrielles.', category: 'construction', type: 'component', era: 'industrial', year_approx: 1850, complexity_depth: 3, tags: ['pont', 'gratte-ciel'] },
  { id: 'hydrogene', name: 'Hydrogène', name_en: 'Hydrogen', description: 'Gaz léger utilisé dans la synthèse ammoniaque (Haber).', category: 'element', type: 'raw_material', era: 'modern', year_approx: 1913, complexity_depth: 1, tags: ['chimie', 'engrais'] },
  { id: 'azote', name: 'Azote', name_en: 'Nitrogen', description: 'Gaz atmosphérique fixé industriellement pour engrais.', category: 'element', type: 'raw_material', era: 'modern', year_approx: 1913, complexity_depth: 1, tags: ['Haber', 'engrais'] },
  { id: 'ammoniac', name: 'Ammoniac', name_en: 'Ammonia', description: 'Précurseur des engrais azotés et explosifs nités.', category: 'chemistry', type: 'material', era: 'modern', year_approx: 1913, complexity_depth: 2, tags: ['synthèse', 'engrais'] },
  { id: 'nitrate', name: 'Nitrate de calcium', name_en: 'Calcium nitrate', description: 'Engrais soluble dérivé de chaînes azotées industrielles.', category: 'chemistry', type: 'material', era: 'modern', year_approx: 1920, complexity_depth: 2, tags: ['sol', 'engrais'] },
  { id: 'polycarbonate', name: 'Polycarbonate', name_en: 'Polycarbonate', description: 'Plastique transparent résistant pour bouteilles et visières.', category: 'chemistry', type: 'material', era: 'modern', year_approx: 1953, complexity_depth: 3, tags: ['transparent', 'sécurité'] },
  { id: 'route-bitee', name: 'Route bitumée', name_en: 'Asphalt road', description: 'Chaussée liée au bitume de pétrole pour trafic motorisé.', category: 'construction', type: 'end_product', era: 'industrial', year_approx: 1870, complexity_depth: 3, tags: ['pétrole', 'transport'] },
  { id: 'bitume', name: 'Bitume', name_en: 'Bitumen', description: 'Fraction visqueuse du pétrole pour enrobés routiers.', category: 'material', type: 'material', era: 'industrial', year_approx: 1870, complexity_depth: 1, tags: ['route', 'étanchéité'] },
  { id: 'signal-numerique', name: 'Signal numérique', name_en: 'Digital signal', description: 'Information discrétisée pour traitement par circuits logiques.', category: 'software', type: 'process', era: 'digital', year_approx: 1948, complexity_depth: 2, tags: ['DSP', 'télécom'] },
  { id: 'ecran-lcd', name: 'Écran LCD', name_en: 'LCD display', description: 'Matrice à cristaux liquides polarisés pour affichage basse conso.', category: 'electronics', type: 'component', era: 'digital', year_approx: 1971, complexity_depth: 4, tags: ['mobile', 'affichage'] },
  { id: 'batterie-li', name: 'Batterie Li-ion', name_en: 'Li-ion battery', description: 'Accumulateur léger à haute densité pour mobiles et véhicules.', category: 'electronics', type: 'component', era: 'contemporary', year_approx: 1991, complexity_depth: 3, tags: ['stockage', 'mobile'] },
  { id: 'reseau-cellulaire', name: 'Réseau cellulaire', name_en: 'Cellular network', description: 'Infrastructure radio 4G/5G pour données mobiles.', category: 'communication', type: 'process', era: 'contemporary', year_approx: 1980, complexity_depth: 5, tags: ['5G', 'opérateur'] },
];

const extraLinks = [
  // Textile
  ['coton', 'fil-de-coton', 'material'], ['filature', 'fil-de-coton', 'tool'], ['eau', 'filature', 'material'], ['feu', 'filature', 'energy'],
  ['fil-de-coton', 'tissu', 'material'], ['metier-tisser', 'tissu', 'tool'], ['bois', 'metier-tisser', 'material'],
  ['tissu', 'vetement', 'material'], ['feu', 'vetement', 'energy'],
  ['laine', 'fil-de-laine', 'material'], ['mouton', 'laine', 'knowledge'],
  ['fil-de-laine', 'tricot', 'material'], ['fil-de-laine', 'tissu', 'material'],
  ['ver-a-soie', 'soie-naturelle', 'material'], ['mulberry', 'ver-a-soie', 'energy'],
  ['soie-naturelle', 'tissu', 'material'],
  ['plantes-teinture', 'teinture-textile', 'material'], ['mordant', 'teinture-textile', 'material'], ['eau', 'teinture-textile', 'material'], ['feu', 'teinture-textile', 'energy'],
  ['tissu', 'tissu-teint', 'material'], ['teinture-textile', 'tissu-teint', 'tool'], ['mordant', 'tissu-teint', 'material'],
  ['tissu-teint', 'vetement', 'material'],

  // Transport
  ['bois', 'roue', 'material'], ['feu', 'roue', 'energy'], ['acier', 'roue', 'material'],
  ['roue', 'chariot', 'material'], ['bois', 'chariot', 'material'], ['acier', 'chariot', 'material'],
  ['acier', 'chassis-auto', 'material'], ['caoutchouc', 'pneu', 'material'], ['acier', 'pneu', 'material'],
  ['pneu', 'automobile', 'material'], ['chassis-auto', 'automobile', 'material'], ['moteur-explosion', 'automobile', 'material'],
  ['essence', 'moteur-explosion', 'material'], ['petrole', 'essence', 'material'], ['raffinerie', 'essence', 'tool'], ['petrole', 'raffinerie', 'material'],
  ['acier', 'moteur-explosion', 'material'], ['cuivre', 'moteur-explosion', 'material'],
  ['bauxite', 'aluminium', 'material'], ['electricite', 'aluminium', 'energy'], ['four-haute-temp', 'aluminium', 'tool'],
  ['aluminium', 'carlingue', 'material'], ['moteur-reaction', 'avion', 'material'], ['carlingue', 'avion', 'material'],
  ['acier-inox', 'moteur-reaction', 'material'], ['essence', 'moteur-reaction', 'material'],

  // Energy
  ['bois', 'charbon-de-bois', 'material'], ['feu', 'charbon-de-bois', 'energy'], ['four', 'charbon-de-bois', 'tool'],
  ['houille', 'electricite', 'energy'], ['houille', 'charbon', 'knowledge'],
  ['petrole', 'gazole', 'material'], ['raffinerie', 'gazole', 'tool'],
  ['petrole', 'essence', 'material'],
  ['uranium', 'reacteur-nucleaire', 'material'], ['eau', 'reacteur-nucleaire', 'material'], ['acier-inox', 'reacteur-nucleaire', 'material'],
  ['reacteur-nucleaire', 'electricite', 'energy'], ['turbine-vapeur', 'electricite', 'tool'], ['houille', 'turbine-vapeur', 'energy'], ['eau', 'turbine-vapeur', 'material'],
  ['alternateur', 'electricite', 'tool'], ['turbine-vapeur', 'alternateur', 'material'],
  ['generateur', 'alternateur', 'knowledge'],
  ['electricite', 'reseau-electrique', 'energy'], ['cuivre', 'reseau-electrique', 'material'],
  ['silicium', 'panneau-solaire', 'material'], ['verre', 'panneau-solaire', 'material'], ['cuivre', 'panneau-solaire', 'material'],
  ['panneau-solaire', 'electricite', 'energy'], ['onduleur-solaire', 'electricite', 'tool'], ['panneau-solaire', 'onduleur-solaire', 'material'],
  ['microprocesseur', 'onduleur-solaire', 'material'], ['electricite', 'onduleur-solaire', 'energy'],

  // Construction
  ['bois', 'planche-bois', 'material'], ['scierie', 'planche-bois', 'tool'], ['bois', 'scierie', 'material'], ['eau', 'scierie', 'material'],
  ['planche-bois', 'charpente-bois', 'material'], ['acier', 'charpente-bois', 'material'],
  ['pierre', 'taille-pierre', 'material'], ['feu', 'taille-pierre', 'energy'], ['acier', 'taille-pierre', 'material'],
  ['taille-pierre', 'mur-pierre', 'tool'], ['mortier', 'mur-pierre', 'material'], ['pierre', 'mur-pierre', 'material'],
  ['calcaire', 'chaux', 'material'], ['four', 'chaux', 'tool'], ['feu', 'chaux', 'energy'],
  ['chaux', 'mortier', 'material'], ['sable', 'mortier', 'material'], ['eau', 'mortier', 'material'],
  ['mortier', 'beton-arme', 'material'], ['acier', 'beton-arme', 'material'], ['beton', 'beton-arme', 'material'],
  ['verre', 'vitre', 'material'], ['four', 'vitre', 'tool'], ['verre-trempe', 'fenetre', 'material'], ['vitre', 'fenetre', 'material'], ['bois', 'fenetre', 'material'], ['acier-inox', 'fenetre', 'material'],
  ['bitume', 'route-bitee', 'material'], ['petrole', 'bitume', 'material'], ['sable', 'route-bitee', 'material'], ['acier', 'route-bitee', 'material'],

  // Communication
  ['papyrus', 'livre', 'material'], ['parchemin', 'livre', 'material'],
  ['papier', 'journal', 'material'], ['encre', 'journal', 'material'], ['imprimerie', 'journal', 'tool'], ['electricite', 'imprimerie', 'energy'],
  ['presse-imprimer', 'imprimerie', 'knowledge'], ['acier', 'imprimerie', 'material'],
  ['electricite', 'radio', 'energy'], ['cuivre', 'radio', 'material'], ['antenne-radio', 'radio', 'material'], ['transistor', 'radio', 'material'],
  ['radio', 'television', 'knowledge'], ['tube-cathodique', 'television', 'material'], ['electricite', 'television', 'energy'], ['cuivre', 'television', 'material'],
  ['transistor', 'ordinateur', 'material'], ['circuit-integre', 'ordinateur', 'material'], ['microprocesseur', 'ordinateur', 'material'], ['electricite', 'ordinateur', 'energy'],
  ['ordinateur', 'internet', 'material'], ['microprocesseur', 'internet', 'material'],
  ['internet', 'smartphone', 'material'], ['ecran-lcd', 'smartphone', 'material'], ['microprocesseur', 'smartphone', 'material'], ['batterie-li', 'smartphone', 'material'], ['electricite', 'smartphone', 'energy'],
  ['reseau-cellulaire', 'smartphone', 'material'], ['signal-numerique', 'smartphone', 'knowledge'],

  // Chimie / armes
  ['petrole', 'plastique', 'material'], ['chimie-organique', 'plastique', 'tool'], ['polycarbonate', 'bouteille-plastique', 'material'], ['plastique', 'bouteille-plastique', 'material'],
  ['petrole', 'engrais', 'material'], ['ammoniac', 'engrais', 'material'], ['nitrate', 'engrais', 'material'], ['azote', 'ammoniac', 'material'], ['hydrogene', 'ammoniac', 'material'], ['feu', 'ammoniac', 'energy'],
  ['salpetre', 'poudre-a-canon', 'material'], ['charbon', 'poudre-a-canon', 'material'], ['soufre', 'poudre-a-canon', 'material'], ['feu', 'poudre-a-canon', 'energy'],

  // Optique
  ['verre', 'lentille', 'material'], ['feu', 'lentille', 'energy'],
  ['lentille', 'lunettes', 'material'], ['acier-inox', 'lunettes', 'material'],
  ['lentille', 'microscope', 'material'], ['cuivre', 'microscope', 'material'], ['electricite', 'microscope', 'energy'],
  ['lentille', 'telescope', 'material'], ['acier-structure', 'telescope', 'material'],

  // Alimentation
  ['sel', 'salaison', 'material'], ['viande', 'salaison', 'material'], ['feu', 'salaison', 'energy'],
  ['canne-a-sucre', 'sucre', 'material'], ['feu', 'sucre', 'energy'], ['eau', 'sucre', 'material'],
  ['sucre', 'confiserie', 'material'], ['feu', 'confiserie', 'energy'],
  ['cacao', 'chocolat', 'material'], ['sucre', 'chocolat', 'material'], ['lait', 'chocolat', 'material'], ['feu', 'chocolat', 'energy'],
  ['orge', 'biere', 'material'], ['houblon', 'biere', 'material'], ['eau', 'biere', 'material'], ['levure', 'biere', 'material'], ['tonneau', 'biere', 'tool'],

  // Cross-links existing
  ['electricite', 'radio', 'energy'], ['electricite', 'ordinateur', 'energy'],
  ['acier', 'chassis-auto', 'material'], ['fer', 'fonte', 'material'], ['charbon', 'fonte', 'material'], ['fonte', 'acier', 'material'],
  ['or', 'feuille-or', 'material'], ['feu', 'feuille-or', 'energy'],
  ['acier', 'acier-inox', 'material'], ['cuivre', 'radio', 'material'],
  ['petrole', 'bitume', 'material'], ['raffinerie', 'bitume', 'tool'],
];

const data = JSON.parse(fs.readFileSync(path.join(root, 'src/data/seed-data.json'), 'utf8'));
const existing = new Set(data.nodes.map((n) => n.id));
let dup = extraNodes.filter((n) => existing.has(n.id));
if (dup.length) {
  console.error('Duplicate IDs:', dup.map((d) => d.id));
  process.exit(1);
}
const linkIds = new Set(data.links.map((l) => l.id));
let lid = data.links.length + 1;
function addLink(source, target, rel) {
  const id = 'l' + lid++;
  while (linkIds.has(id)) {
    lid++;
  }
  linkIds.add(id);
  return { id, source_id: source, target_id: target, relation_type: rel, is_optional: false };
}

const newLinks = [];
for (const [s, t, rel] of extraLinks) {
  const all = new Set([...data.nodes.map((n) => n.id), ...extraNodes.map((n) => n.id)]);
  if (!all.has(s) || !all.has(t)) {
    console.warn('Skip link (missing node):', s, '->', t);
    continue;
  }
  newLinks.push(addLink(s, t, rel));
}

data.nodes.push(...extraNodes);
data.links.push(...newLinks);

console.log('New totals: nodes', data.nodes.length, 'links', data.links.length);
fs.writeFileSync(path.join(root, 'src/data/seed-data.json'), JSON.stringify(data, null, 2) + '\n');

try {
  execSync('node scripts/split-seed-data.mjs', { cwd: root, stdio: 'inherit' });
} catch {
  console.warn('split-seed-data.mjs a échoué — lancez npm run split-data manuellement.');
}

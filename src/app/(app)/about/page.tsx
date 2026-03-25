import type { Metadata } from 'next';
import linksJson from '@/data/links.json';
import nodesIndex from '@/data/nodes-index.json';

export const metadata: Metadata = {
  title: { absolute: 'À propos — Craftree' },
  description:
    'Comprendre de quoi est faite la civilisation : arbre technologique interactif, méthodologie et données.',
};

const titleFont =
  'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif';

function LinkTypeRow({
  children,
  title,
  body,
}: {
  children: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4 border-b border-[#1A1F2E] py-3 last:border-b-0">
      <div className="flex w-10 shrink-0 items-center justify-center" aria-hidden>
        {children}
      </div>
      <p className="min-w-0 flex-1 text-base leading-[1.7] text-[#C8CDD8]">
        <strong className="font-bold text-[#E8ECF4]">{title}</strong>
        {' — '}
        {body}
      </p>
    </div>
  );
}

function InventionTypeRow({
  children,
  title,
  body,
}: {
  children: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-4 border-b border-[#1A1F2E] py-3 last:border-b-0">
      <div className="flex w-10 shrink-0 items-center justify-center" aria-hidden>
        {children}
      </div>
      <p className="min-w-0 flex-1 text-base leading-[1.7] text-[#C8CDD8]">
        <strong className="font-bold text-[#E8ECF4]">{title}</strong>
        {' — '}
        {body}
      </p>
    </div>
  );
}

export default function AboutPage() {
  const nInventions = nodesIndex.nodes.length;
  const nLinks = linksJson.links.length;

  return (
    <main
      className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-20 pt-16 font-[family-name:var(--font-inter)] text-[#C8CDD8]"
      style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
    >
      <article className="pb-20">
        {/* Hero */}
        <header className="mb-12">
          <h1
            className="text-[32px] font-bold leading-tight text-[#E8ECF4]"
            style={{ fontFamily: titleFont }}
          >
            À propos de Craftree
          </h1>
          <p className="mt-3 text-base text-[#8B95A8]">
            Comprendre de quoi est faite la civilisation.
          </p>
        </header>

        <div className="space-y-16">
          {/* Section 1 */}
          <section aria-labelledby="about-projet">
            <h2
              id="about-projet"
              className="mb-5 text-[22px] font-bold text-[#E8ECF4]"
              style={{ fontFamily: titleFont }}
            >
              Le projet
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-[#C8CDD8]">
              <p>
                Craftree est un arbre technologique interactif qui modélise les
                inventions humaines sous forme de recettes de fabrication.
                Contrairement aux chronologies classiques qui montrent quand les
                choses ont été inventées, Craftree répond à une question
                différente : de quoi a-t-on besoin pour les fabriquer ?
              </p>
              <p>
                Chaque invention est décomposée en ses intrants directs — les
                matériaux consommés, les outils utilisés, les sources
                d&apos;énergie nécessaires et les connaissances prérequises. En
                cliquant sur un intrant, on descend d&apos;un niveau. Et ainsi
                de suite, jusqu&apos;aux matières premières que l&apos;on trouve
                dans la nature : le sable, l&apos;argile, le bois, l&apos;eau,
                le feu.
              </p>
              <p>
                Le résultat est une pyramide inversée. En haut, un smartphone. En
                bas, du sable et du minerai. Entre les deux, des centaines
                d&apos;inventions empilées les unes sur les autres, chacune
                rendue possible par celles qui la précèdent. Craftree rend cette
                profondeur visible et navigable.
              </p>
              <p>
                Le projet est né d&apos;une conviction : dans un monde où les
                choses vont de plus en plus vite, il est important de comprendre
                d&apos;où elles viennent. Pas seulement qui les a inventées,
                mais ce qu&apos;il a fallu assembler, transformer et maîtriser
                pour qu&apos;elles existent.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section aria-labelledby="about-graphe">
            <h2
              id="about-graphe"
              className="mb-5 text-[22px] font-bold text-[#E8ECF4]"
              style={{ fontFamily: titleFont }}
            >
              Comment lire le graphe
            </h2>
            <p className="mb-6 text-base leading-[1.7] text-[#C8CDD8]">
              Le graphe s&apos;organise en couches horizontales. Les matières
              premières sont en bas, les produits les plus complexes en haut. La
              position verticale d&apos;une invention correspond à sa profondeur
              de fabrication : le nombre d&apos;étapes de transformation depuis
              la nature.
            </p>

            <h3
              className="mb-4 mt-8 text-lg font-bold text-[#E8ECF4]"
              style={{ fontFamily: titleFont }}
            >
              Les types de liens
            </h3>
            <div className="rounded-lg border border-[#1A1F2E]/80">
              <LinkTypeRow
                title="Matériau"
                body="consommé ou transformé dans le produit. Le minerai de fer disparaît pour devenir de l'acier."
              >
                <svg width={40} height={14} viewBox="0 0 40 14" aria-hidden>
                  <line
                    x1="0"
                    y1="7"
                    x2="40"
                    y2="7"
                    stroke="#14B8A6"
                    strokeWidth="2.5"
                  />
                </svg>
              </LinkTypeRow>
              <LinkTypeRow
                title="Outil"
                body="utilisé pendant la fabrication mais récupéré intact. Le four sert à cuire le pain, mais on le réutilise ensuite."
              >
                <svg width={40} height={14} viewBox="0 0 40 14" aria-hidden>
                  <line
                    x1="0"
                    y1="7"
                    x2="40"
                    y2="7"
                    stroke="#A78BFA"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                </svg>
              </LinkTypeRow>
              <LinkTypeRow
                title="Énergie"
                body="fournit la force ou la chaleur nécessaire. Le feu chauffe le four, l'électricité alimente le moteur."
              >
                <svg width={40} height={14} viewBox="0 0 40 14" aria-hidden>
                  <line
                    x1="0"
                    y1="7"
                    x2="40"
                    y2="7"
                    stroke="#EF4444"
                    strokeWidth="2.5"
                    strokeDasharray="10 5"
                  />
                </svg>
              </LinkTypeRow>
              <LinkTypeRow
                title="Connaissance"
                body="un savoir ou une technique qu'il faut maîtriser au préalable. La thermodynamique est nécessaire pour concevoir un moteur à vapeur."
              >
                <svg width={40} height={14} viewBox="0 0 40 14" aria-hidden>
                  <line
                    x1="0"
                    y1="7"
                    x2="40"
                    y2="7"
                    stroke="#38BDF8"
                    strokeWidth="1.25"
                    strokeDasharray="2 3"
                  />
                </svg>
              </LinkTypeRow>
              <LinkTypeRow
                title="Catalyseur"
                body="facilite le processus sans être strictement indispensable."
              >
                <svg width={40} height={14} viewBox="0 0 40 14" aria-hidden>
                  <line
                    x1="0"
                    y1="7"
                    x2="40"
                    y2="7"
                    stroke="#6B7280"
                    strokeWidth="0.75"
                  />
                </svg>
              </LinkTypeRow>
            </div>

            <h3
              className="mb-4 mt-8 text-lg font-bold text-[#E8ECF4]"
              style={{ fontFamily: titleFont }}
            >
              Les types d&apos;inventions
            </h3>
            <div className="rounded-lg border border-[#1A1F2E]/80">
              <InventionTypeRow
                title="Matière première"
                body="existe dans la nature sans intervention humaine. Eau, sable, minerai, bois."
              >
                <span className="inline-block h-5 min-w-[2.25rem] rounded-full bg-[#6B7280]" />
              </InventionTypeRow>
              <InventionTypeRow
                title="Procédé"
                body="une technique, pas un objet. Fonderie, distillation, soudure."
              >
                <span className="inline-block h-6 w-10 rounded border border-[#8B95A8] bg-transparent" />
              </InventionTypeRow>
              <InventionTypeRow
                title="Outil"
                body="un objet réutilisable. Four, marteau, laser."
              >
                <span className="inline-block h-6 w-10 rounded border border-[#8B95A8] bg-transparent" />
              </InventionTypeRow>
              <InventionTypeRow
                title="Composant"
                body="un objet intégré dans un autre. Transistor, lentille, engrenage."
              >
                <span className="inline-block h-6 w-10 rounded border border-[#8B95A8] bg-transparent" />
              </InventionTypeRow>
              <InventionTypeRow
                title="Produit final"
                body="utilisé directement par l'humain. Automobile, smartphone, pain."
              >
                <span className="inline-block h-6 w-10 rounded border-2 border-[#8B95A8] bg-transparent" />
              </InventionTypeRow>
            </div>
          </section>

          {/* Section 3 */}
          <section aria-labelledby="about-methodo">
            <h2
              id="about-methodo"
              className="mb-5 text-[22px] font-bold text-[#E8ECF4]"
              style={{ fontFamily: titleFont }}
            >
              Méthodologie
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-[#C8CDD8]">
              <p>
                Chaque invention est classée selon trois critères : son type
                (matière première, procédé, outil, composant ou produit final), sa
                catégorie (le domaine d&apos;application principal, parmi 20
                catégories comme Électronique, Transport, Alimentation, etc.) et
                ses intrants de fabrication.
              </p>
              <p>
                La classification suit un arbre de décision en trois questions :
              </p>
              <p>
                Première question : est-ce que ça existe dans la nature sans
                intervention humaine ? Si oui, c&apos;est une matière première.
                Sinon, est-ce un objet physique ou une technique ? Les techniques
                sont des procédés, les objets sont classés selon leur usage —
                outils s&apos;ils sont réutilisables, composants s&apos;ils sont
                intégrés dans un autre produit, produits finaux s&apos;ils sont
                utilisés directement.
              </p>
              <p>
                Deuxième question : dans quel domaine cette invention est-elle
                principalement utilisée ? Si elle sert dans un seul domaine,
                c&apos;est la catégorie de ce domaine. Si elle est transversale,
                c&apos;est la catégorie de sa nature physique.
              </p>
              <p>
                Troisième question : quels sont les intrants nécessaires à sa
                fabrication ? Pour chaque intrant, on détermine s&apos;il est
                consommé (matériau), réutilisé (outil), s&apos;il fournit de
                l&apos;énergie, ou s&apos;il représente une connaissance
                prérequise.
              </p>
              <p>
                Ce graphe est une simplification. Les vraies chaînes de fabrication
                sont infiniment plus complexes, impliquent des centaines de
                sous-étapes et de variantes régionales. L&apos;objectif n&apos;est
                pas l&apos;exhaustivité absolue, mais de capturer les
                dépendances principales pour révéler la structure profonde de
                notre civilisation technologique.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section aria-labelledby="about-data">
            <h2
              id="about-data"
              className="mb-5 text-[22px] font-bold text-[#E8ECF4]"
              style={{ fontFamily: titleFont }}
            >
              Les données
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-[#C8CDD8]">
              <p>
                La base de données de Craftree est construite à l&apos;aide
                d&apos;un agent IA (Claude, développé par Anthropic) qui recherche
                les informations sur le web, classe chaque invention selon les
                règles de méthodologie décrites ci-dessus, et identifie ses
                intrants de fabrication. Les résultats sont ensuite vérifiés et
                corrigés manuellement.
              </p>
              <p>
                Les images des inventions proviennent de Wikimedia Commons et
                sont dans le domaine public ou sous licence Creative Commons.
              </p>
              <p>
                La base contient actuellement{' '}
                <strong className="font-semibold text-[#E8ECF4]">
                  {nInventions}
                </strong>{' '}
                inventions et{' '}
                <strong className="font-semibold text-[#E8ECF4]">{nLinks}</strong>{' '}
                liens de fabrication. Elle est enrichie en continu.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section aria-labelledby="about-contrib">
            <h2
              id="about-contrib"
              className="mb-5 text-[22px] font-bold text-[#E8ECF4]"
              style={{ fontFamily: titleFont }}
            >
              Contribuer
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-[#C8CDD8]">
              <p>
                Craftree est un projet open source. Le code est disponible sur
                GitHub.
              </p>
              <a
                href="https://github.com/julien-beljio/civtree"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-[#2A3042] px-4 py-2.5 text-sm font-medium text-[#E8ECF4] transition-colors hover:border-[#3B82F6]"
              >
                Voir sur GitHub →
              </a>
              <p>
                Si vous repérez une erreur de classification, un lien manquant,
                ou une invention qui devrait figurer dans l&apos;arbre, vous
                pouvez ouvrir une issue sur GitHub ou nous contacter directement.
              </p>
              <p>
                <a
                  href="mailto:contact@craftree.app"
                  className="text-[#3B82F6] underline-offset-2 transition-colors hover:underline"
                >
                  contact@craftree.app
                </a>
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section aria-labelledby="about-credits">
            <h2
              id="about-credits"
              className="mb-5 text-[22px] font-bold text-[#E8ECF4]"
              style={{ fontFamily: titleFont }}
            >
              Crédits
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-[#C8CDD8]">
              <p>Craftree est un projet créé par Julien Beljio.</p>
              <p>
                Développé avec Next.js, React Flow et Tailwind CSS. Les données
                sont enrichies par Claude (Anthropic). Les images proviennent de
                Wikimedia Commons.
              </p>
              <p>
                Inspiré par le{' '}
                <a
                  href="https://historicaltechtree.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#3B82F6] underline-offset-2 transition-colors hover:underline"
                >
                  Historical Tech Tree
                </a>{' '}
                d&apos;Étienne Fortier-Dubois, les arbres technologiques de la
                série Civilization, et la conviction que comprendre d&apos;où
                viennent les choses est la première étape pour comprendre où
                elles vont.
              </p>
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}

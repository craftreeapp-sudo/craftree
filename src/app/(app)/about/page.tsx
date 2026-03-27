import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AppContentShell } from '@/components/layout/AppContentShell';
import { BackToExploreLink } from '@/components/layout/BackToExploreLink';
import { getPublicGraphStats } from '@/lib/landing-stats';

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
    <div className="flex gap-4 border-b border-border-subtle py-3 last:border-b-0">
      <div className="flex w-10 shrink-0 items-center justify-center" aria-hidden>
        {children}
      </div>
      <p className="min-w-0 flex-1 text-base leading-[1.7] text-foreground/85">
        <strong className="font-bold text-foreground">{title}</strong>
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
    <div className="flex gap-4 border-b border-border-subtle py-3 last:border-b-0">
      <div className="flex w-10 shrink-0 items-center justify-center" aria-hidden>
        {children}
      </div>
      <p className="min-w-0 flex-1 text-base leading-[1.7] text-foreground/85">
        <strong className="font-bold text-foreground">{title}</strong>
        {' — '}
        {body}
      </p>
    </div>
  );
}

export default async function AboutPage() {
  const t = await getTranslations('about');
  const { nodeCount: nInventions, linkCount: nLinks } =
    await getPublicGraphStats();

  return (
    <AppContentShell
      as="main"
      className="flex-1 font-[family-name:var(--font-inter)] text-foreground/85"
      style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
    >
      <article className="pb-20">
        <BackToExploreLink />
        {/* Hero */}
        <header className="mb-12">
          <h1
            className="text-[32px] font-bold leading-tight text-foreground"
            style={{ fontFamily: titleFont }}
          >
            {t('title')}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{t('subtitle')}</p>
        </header>

        <div className="space-y-16">
          {/* Section 1 */}
          <section aria-labelledby="about-projet">
            <h2
              id="about-projet"
              className="mb-5 text-[22px] font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('projectTitle')}
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-foreground/85">
              <p>{t('projectP1')}</p>
              <p>{t('projectP2')}</p>
              <p>{t('projectP3')}</p>
              <p>{t('projectP4')}</p>
            </div>
          </section>

          {/* Section 2 */}
          <section aria-labelledby="about-graphe">
            <h2
              id="about-graphe"
              className="mb-5 text-[22px] font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('graphTitle')}
            </h2>
            <p className="mb-6 text-base leading-[1.7] text-foreground/85">
              {t('graphIntro')}
            </p>

            <h3
              className="mb-4 mt-8 text-lg font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('linkTypesTitle')}
            </h3>
            <div className="rounded-lg border border-border-subtle/80">
              <LinkTypeRow
                title={t('linkMaterialTitle')}
                body={t('linkMaterialBody')}
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
                title={t('linkToolTitle')}
                body={t('linkToolBody')}
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
                title={t('linkEnergyTitle')}
                body={t('linkEnergyBody')}
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
                title={t('linkKnowledgeTitle')}
                body={t('linkKnowledgeBody')}
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
                title={t('linkCatalystTitle')}
                body={t('linkCatalystBody')}
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
              className="mb-4 mt-8 text-lg font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('inventionTypesTitle')}
            </h3>
            <div className="rounded-lg border border-border-subtle/80">
              <InventionTypeRow
                title={t('invRawTitle')}
                body={t('invRawBody')}
              >
                <span className="inline-block h-5 min-w-[2.25rem] rounded-full bg-[#6B7280]" />
              </InventionTypeRow>
              <InventionTypeRow
                title={t('invProcessTitle')}
                body={t('invProcessBody')}
              >
                <span className="inline-block h-6 w-10 rounded border border-[#8B95A8] bg-transparent" />
              </InventionTypeRow>
              <InventionTypeRow
                title={t('invToolTitle')}
                body={t('invToolBody')}
              >
                <span className="inline-block h-6 w-10 rounded border border-[#8B95A8] bg-transparent" />
              </InventionTypeRow>
              <InventionTypeRow
                title={t('invComponentTitle')}
                body={t('invComponentBody')}
              >
                <span className="inline-block h-6 w-10 rounded border border-[#8B95A8] bg-transparent" />
              </InventionTypeRow>
              <InventionTypeRow
                title={t('invEndTitle')}
                body={t('invEndBody')}
              >
                <span className="inline-block h-6 w-10 rounded border-2 border-[#8B95A8] bg-transparent" />
              </InventionTypeRow>
            </div>
          </section>

          {/* Section 3 */}
          <section aria-labelledby="about-methodo">
            <h2
              id="about-methodo"
              className="mb-5 text-[22px] font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('methodologyTitle')}
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-foreground/85">
              <p>{t('methodologyP1')}</p>
              <p>{t('methodologyP2')}</p>
              <p>{t('methodologyP3')}</p>
              <p>{t('methodologyP4')}</p>
              <p>{t('methodologyP5')}</p>
              <p>{t('methodologyP6')}</p>
            </div>
          </section>

          {/* Section 4 */}
          <section aria-labelledby="about-data">
            <h2
              id="about-data"
              className="mb-5 text-[22px] font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('dataTitle')}
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-foreground/85">
              <p>{t('dataP1')}</p>
              <p>{t('dataP2')}</p>
              <p>
                {t('dataP3', { nInventions, nLinks })}
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section aria-labelledby="about-contrib">
            <h2
              id="about-contrib"
              className="mb-5 text-[22px] font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('contributeTitle')}
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-foreground/85">
              <p>{t('contributeP1')}</p>
              <a
                href="https://github.com/craftreeapp-sudo/craftree"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent"
              >
                {t('viewOnGithub')}
              </a>
              <p>{t('contributeP2')}</p>
              <p>
                <a
                  href="mailto:contact@craftree.app"
                  className="text-accent underline-offset-2 transition-colors hover:underline"
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
              className="mb-5 text-[22px] font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('creditsTitle')}
            </h2>
            <div className="space-y-5 text-base leading-[1.7] text-foreground/85">
              <p>{t('creditsP1')}</p>
              <p>{t('creditsP2')}</p>
              <p>
                {t.rich('creditsP3', {
                  ht: (chunks) => (
                    <a
                      href="https://historicaltechtree.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent underline-offset-2 transition-colors hover:underline"
                    >
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>
          </section>
        </div>
      </article>
    </AppContentShell>
  );
}

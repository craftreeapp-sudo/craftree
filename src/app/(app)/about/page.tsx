import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BackToExploreLink } from '@/components/layout/BackToExploreLink';

const titleFont =
  'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about');
  return {
    title: { absolute: `${t('title')} — Craftree` },
    description: t('subtitle'),
  };
}

export default async function AboutPage() {
  const t = await getTranslations('about');

  return (
    <main
      className="min-h-[calc(100dvh-3.5rem)] flex-1 bg-page px-4 pb-24 pt-16 font-[family-name:var(--font-inter)] sm:px-6"
      style={{ fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif' }}
    >
      <article className="mx-auto max-w-[700px]">
        <BackToExploreLink className="!mb-10 !text-[#b0b0b0] hover:!text-white" />
        <header className="mb-12">
          <h1
            className="text-[32px] font-bold leading-tight text-foreground"
            style={{ fontFamily: titleFont }}
          >
            {t('title')}
          </h1>
          <p className="mt-3 text-base text-[#b0b0b0]">{t('subtitle')}</p>
        </header>

        <div className="space-y-14">
          <section aria-labelledby="about-project">
            <h2
              id="about-project"
              className="mb-6 text-[22px] font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('projectTitle')}
            </h2>
            <div className="space-y-5 text-base leading-[1.75] text-[#b0b0b0]">
              <p>{t('projectP1')}</p>
              <p>{t('projectP2')}</p>
              <p>{t('projectP3')}</p>
              <p>{t('projectP4')}</p>
            </div>
          </section>

          <section aria-labelledby="about-graph">
            <h2
              id="about-graph"
              className="mb-6 text-[22px] font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('graphTitle')}
            </h2>
            <div className="space-y-5 text-base leading-[1.75] text-[#b0b0b0]">
              <p>{t('graphP1')}</p>
              <p>{t('graphP2')}</p>
            </div>
          </section>

          <section aria-labelledby="about-dimensions">
            <h2
              id="about-dimensions"
              className="mb-6 text-[22px] font-bold text-foreground"
              style={{ fontFamily: titleFont }}
            >
              {t('dimensionsTitle')}
            </h2>
            <p className="mb-8 text-base leading-[1.75] text-[#b0b0b0]">
              {t('dimensionsIntro')}
            </p>
            <div className="space-y-8">
              <div>
                <h3
                  className="mb-3 text-lg font-semibold text-foreground"
                  style={{ fontFamily: titleFont }}
                >
                  {t('dimensionMattersTitle')}
                </h3>
                <p className="text-base leading-[1.75] text-[#b0b0b0]">
                  {t('dimensionMattersBody')}
                </p>
              </div>
              <div>
                <h3
                  className="mb-3 text-lg font-semibold text-foreground"
                  style={{ fontFamily: titleFont }}
                >
                  {t('dimensionProcessTitle')}
                </h3>
                <p className="text-base leading-[1.75] text-[#b0b0b0]">
                  {t('dimensionProcessBody')}
                </p>
              </div>
              <div>
                <h3
                  className="mb-3 text-lg font-semibold text-foreground"
                  style={{ fontFamily: titleFont }}
                >
                  {t('dimensionToolsTitle')}
                </h3>
                <p className="text-base leading-[1.75] text-[#b0b0b0]">
                  {t('dimensionToolsBody')}
                </p>
              </div>
            </div>
          </section>
        </div>
      </article>
    </main>
  );
}

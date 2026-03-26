'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { HeaderAuth } from '@/components/layout/HeaderAuth';
import { SearchBar } from '@/components/ui/SearchBar';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { ThemeSwitcher } from '@/components/ui/ThemeSwitcher';
import { LandingHeroBackground } from '@/components/landing/LandingHeroBackground';
import { LandingHowDemoTree } from '@/components/landing/LandingHowDemoTree';
import { useCountUp } from '@/hooks/use-count-up';
import { useOnceInView } from '@/hooks/use-once-in-view';
import type { LandingHeroCard } from '@/lib/landing-hero-cards';
import type { LandingDemoTreeNode } from '@/lib/landing-demo-tree';
import type {
  LandingFeatureHighlight,
  LandingStats,
} from '@/lib/landing-ssg';

type Props = {
  stats: LandingStats;
  feature: LandingFeatureHighlight;
  heroCards: LandingHeroCard[];
  demoNodes: LandingDemoTreeNode[];
};

const COUNT_MS = 1500;

export function LandingPage({ stats, feature, heroCards, demoNodes }: Props) {
  const t = useTranslations('landing');
  const tNav = useTranslations('nav');
  const locale = useLocale();

  const nf = useMemo(
    () =>
      new Intl.NumberFormat(
        locale === 'fr' ? 'fr-FR' : locale === 'ar' ? 'ar' : locale
      ),
    [locale]
  );

  const { ref: statsSectionRef, isVisible: statsSectionVisible } =
    useOnceInView(0.3);
  const inventionsCount = useCountUp(
    stats.nodeCount,
    COUNT_MS,
    statsSectionVisible
  );
  const linksCount = useCountUp(stats.linkCount, COUNT_MS, statsSectionVisible);
  const layersCount = useCountUp(
    stats.maxComplexityDepth,
    COUNT_MS,
    statsSectionVisible
  );

  const howSteps = [
    {
      n: 1,
      title: t('howStep1Title'),
      desc: t('howStep1Desc'),
    },
    {
      n: 2,
      title: t('howStep2Title'),
      desc: t('howStep2Desc'),
    },
    {
      n: 3,
      title: t('howStep3Title'),
      desc: t('howStep3Desc'),
    },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <nav
        className="absolute left-0 right-0 top-0 z-[100] flex items-center justify-between px-4 py-3 md:px-6 md:py-4"
        aria-label={tNav('mainNav')}
      >
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-foreground"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          Craft<span className="text-accent">ree</span>
        </Link>
        <div className="flex items-center gap-3">
          <HeaderAuth />
          <ThemeSwitcher align="end" />
          <LanguageSwitcher align="end" />
        </div>
      </nav>

      <section className="relative flex min-h-screen min-h-[100dvh] flex-col items-center justify-center px-5 pb-20 pt-24 text-center md:px-6">
        {heroCards.length > 0 ? <LandingHeroBackground cards={heroCards} /> : null}
        <div className="relative z-10 mx-auto flex w-full max-w-[960px] flex-col items-center">
          <motion.h1
            className="max-w-3xl font-bold leading-[1.08] tracking-tight text-foreground"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              fontSize: 'clamp(2rem, 5vw, 3.25rem)',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {t('title')}
          </motion.h1>

          <motion.p
            className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            {t('subtitle')}
          </motion.p>

          <motion.div
            className="mt-10 w-full max-w-xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.2 }}
          >
            <SearchBar placeholder={t('searchPlaceholder')} />
          </motion.div>

          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.35 }}
          >
            <Link
              href="/explore"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-10 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent/25 transition-colors hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page"
            >
              {t('cta')}
              <span aria-hidden>→</span>
            </Link>
          </motion.div>
        </div>
      </section>

      <section
        ref={statsSectionRef}
        className="border-t-[0.5px] border-border-subtle bg-page px-5 py-14 md:px-6"
      >
        <div className="mx-auto flex max-w-[960px] flex-col items-center gap-6 text-center md:flex-row md:justify-center md:gap-12">
          <div>
            <p
              className="text-[36px] font-medium leading-none text-foreground"
              style={{
                fontFamily:
                  'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              }}
            >
              {nf.format(inventionsCount)}
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {t('stats.inventions')}
            </p>
          </div>
          <span
            className="hidden select-none text-[20px] leading-none text-border md:inline md:self-center"
            aria-hidden
          >
            {t('statDot')}
          </span>
          <div>
            <p
              className="text-[36px] font-medium leading-none text-foreground"
              style={{
                fontFamily:
                  'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              }}
            >
              {nf.format(linksCount)}
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {t('stats.links')}
            </p>
          </div>
          <span
            className="hidden select-none text-[20px] leading-none text-border md:inline md:self-center"
            aria-hidden
          >
            {t('statDot')}
          </span>
          <div>
            <p
              className="text-[36px] font-medium leading-none text-foreground"
              style={{
                fontFamily:
                  'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
              }}
            >
              {nf.format(layersCount)}
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {t('stats.layers')}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-page px-5 py-20 md:px-6">
        <div className="mx-auto w-full max-w-[960px]">
          <h2
            className="mb-12 text-center text-[22px] font-medium text-foreground"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            }}
          >
            {t('howItWorksTitle')}
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {howSteps.map((step) => (
              <div
                key={step.n}
                className="flex flex-col items-center text-center"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-white"
                  aria-hidden
                >
                  {step.n}
                </div>
                <h3 className="mt-4 text-[15px] font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.5] text-muted-foreground">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
          <LandingHowDemoTree nodes={demoNodes} />
        </div>
      </section>

      <section className="bg-page px-5 py-16 md:px-6" aria-labelledby="landing-quote-heading">
        <h2 id="landing-quote-heading" className="sr-only">
          {t('quoteSaganHeading')}
        </h2>
        <div className="mx-auto max-w-[640px] text-center">
          <div
            className="mx-auto h-px w-10 bg-border"
            aria-hidden
          />
          <blockquote
            className="mt-6 text-[20px] italic leading-[1.6] text-foreground/85"
            style={{
              fontFamily: 'var(--font-serif), Georgia, ui-serif, serif',
            }}
          >
            {t('quoteSagan')}
          </blockquote>
          <p className="mt-4 text-[14px] font-medium text-muted-foreground">
            {t('quoteSaganAttribution')}
          </p>
          <div
            className="mx-auto mt-6 h-px w-10 bg-border"
            aria-hidden
          />
        </div>
      </section>

      <section className="bg-surface px-5 py-16 md:px-6">
        <div className="mx-auto max-w-[960px] text-center">
          <p
            className="mx-auto max-w-[520px] text-[22px] font-medium leading-snug text-foreground"
            style={{
              fontFamily:
                'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
            }}
          >
            {t('featureHighlightLead', { name: feature.nodeName })}
            <span className="text-accent">
              {nf.format(feature.rawMaterialCount)}
            </span>
            {t('featureHighlightMid')}
            <span className="text-accent">
              {nf.format(feature.transformationLayers)}
            </span>
            {t('featureHighlightEnd')}
          </p>
          <Link
            href={`/explore?node=${encodeURIComponent(feature.nodeId)}`}
            className="mt-8 inline-flex items-center justify-center rounded-lg border border-accent bg-transparent px-7 py-3 text-base font-medium text-accent transition-colors hover:bg-accent hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            {t('featureHighlightCta', { name: feature.nodeName })}
          </Link>
        </div>
      </section>

      <SiteFooter variant="landing" />
    </div>
  );
}

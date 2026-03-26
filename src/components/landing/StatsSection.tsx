'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { useTranslations } from 'next-intl';
import type { LandingStats } from '@/lib/landing-stats';

function AnimatedInt({
  value,
  duration = 1.35,
}: {
  value: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-12%' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isInView, value, duration]);

  return <span ref={ref}>{display}</span>;
}

export function StatsSection({ stats }: { stats: LandingStats }) {
  const t = useTranslations('landing');

  const cards: {
    label: string;
    value: number;
    depth?: boolean;
  }[] = [
    {
      label: t('statsTech'),
      value: stats.techCount,
    },
    {
      label: t('statsRecipes'),
      value: stats.recipeCount,
    },
    {
      label: t('statsRaw'),
      value: stats.rawMaterialCount,
    },
    {
      label: t('statsDepthLabel'),
      value: stats.maxDepth,
      depth: true,
    },
  ];

  return (
    <section className="border-y border-border/80 bg-page px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          className="mb-12 text-center text-2xl font-bold tracking-tight text-foreground md:text-3xl"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          {t('statsSectionTitle')}
        </motion.h2>
        <div className="grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-4">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              className="rounded-2xl border border-border bg-surface/80 px-4 py-6 text-center shadow-lg backdrop-blur-sm md:px-6 md:py-8"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
            >
              <div
                className="text-4xl font-bold tabular-nums text-accent md:text-5xl"
                style={{
                  fontFamily:
                    'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
                }}
              >
                <AnimatedInt value={card.value} />
                {card.depth ? (
                  <span className="ms-1 text-2xl font-semibold text-muted-foreground md:text-3xl">
                    {' '}
                    {t('statsDepthSuffix')}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {card.depth ? (
                  <span className="font-medium text-foreground">
                    {t('statsDepthMax')}
                  </span>
                ) : (
                  card.label
                )}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

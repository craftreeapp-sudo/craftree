'use client';

import { motion } from 'framer-motion';

const STEPS = [
  {
    icon: (
      <span className="text-4xl" aria-hidden>
        🔍
      </span>
    ),
    title: 'Cherchez une technologie',
    text: 'Utilisez la barre de recherche pour trouver instantanément un nœud dans l’immense Tree des savoir-faire.',
  },
  {
    icon: (
      <span className="text-4xl" aria-hidden>
        🌳
      </span>
    ),
    title: 'Explorez ses dépendances',
    text: 'Remontez les intrants matériels, recette par recette, jusqu’aux matières premières.',
  },
  {
    icon: (
      <span className="text-4xl" aria-hidden>
        🔗
      </span>
    ),
    title: 'Découvrez les connexions',
    text: 'Visualisez comment le fer, le silicium ou le feu relient des milliers de technologies entre elles.',
  },
] as const;

export function HowItWorksSection() {
  return (
    <section className="bg-page px-4 py-14 md:px-6 md:py-20">
      <div className="mx-auto max-w-6xl">
        <motion.h2
          className="mb-14 text-center text-2xl font-bold tracking-tight text-foreground md:text-3xl"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Comment ça marche
        </motion.h2>
        <div className="flex flex-col gap-8 md:grid md:grid-cols-3 md:gap-8">
          {STEPS.map((step, i) => (
            <motion.article
              key={step.title}
              className="flex flex-col items-center rounded-2xl border border-border/60 bg-surface/40 px-5 py-6 text-center md:px-6 md:py-8"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-elevated ring-1 ring-[#2A3042]">
                {step.icon}
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {step.text}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

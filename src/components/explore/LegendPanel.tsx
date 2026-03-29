'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';

const LEGEND_W = 300;
const TRANSITION = {
  duration: 0.35,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
};

function TableOrigins() {
  const t = useTranslations('explore');
  const headers = [
    t('legendOriginsCol1'),
    t('legendOriginsCol2'),
    t('legendOriginsCol3'),
  ];
  const rows = [
    [
      t('legendOriginsRow1c1'),
      t('legendOriginsRow1c2'),
      t('legendOriginsRow1c3'),
    ],
    [
      t('legendOriginsRow2c1'),
      t('legendOriginsRow2c2'),
      t('legendOriginsRow2c3'),
    ],
    [
      t('legendOriginsRow3c1'),
      t('legendOriginsRow3c2'),
      t('legendOriginsRow3c3'),
    ],
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[260px] border-collapse text-left text-[11px] text-foreground sm:text-xs">
        <thead>
          <tr className="border-b border-border bg-border/10">
            {headers.map((h, hi) => (
              <th key={hi} className="px-2 py-1.5 font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, ri) => (
            <tr
              key={`o-${ri}`}
              className="border-b border-border/40 last:border-b-0"
            >
              {cells.map((c, ci) => (
                <td key={ci} className="px-2 py-1.5 align-top text-muted-foreground">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TableNature() {
  const t = useTranslations('explore');
  const headers = [
    t('legendNatureCol1'),
    t('legendNatureCol2'),
    t('legendNatureCol3'),
  ];
  const rows = [
    [
      t('legendNatureRow1c1'),
      t('legendNatureRow1c2'),
      t('legendNatureRow1c3'),
    ],
    [
      t('legendNatureRow2c1'),
      t('legendNatureRow2c2'),
      t('legendNatureRow2c3'),
    ],
    [
      t('legendNatureRow3c1'),
      t('legendNatureRow3c2'),
      t('legendNatureRow3c3'),
    ],
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[260px] border-collapse text-left text-[11px] text-foreground sm:text-xs">
        <thead>
          <tr className="border-b border-border bg-border/10">
            {headers.map((h, hi) => (
              <th key={hi} className="px-2 py-1.5 font-semibold text-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, ri) => (
            <tr
              key={`n-${ri}`}
              className="border-b border-border/40 last:border-b-0"
            >
              {cells.map((c, ci) => (
                <td key={ci} className="px-2 py-1.5 align-top text-muted-foreground">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegendPanel() {
  const ctx = useExploreCardOptional();
  const t = useTranslations('explore');

  const open = ctx?.legendOpen ?? false;
  const close = ctx?.closeLegend ?? (() => {});
  const isMobile = ctx?.isMobile ?? false;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!ctx) return null;

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6 pt-2">
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#7c9cff]">
          {t('legendMattersHeading')}
        </h3>
        <p className="mt-1 text-sm font-medium text-foreground">
          {t('legendMattersSubtitle')}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t('legendMattersExamples')}
        </p>
      </section>
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#7c9cff]">
          {t('legendProcessHeading')}
        </h3>
        <p className="mt-1 text-sm font-medium text-foreground">
          {t('legendProcessSubtitle')}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t('legendProcessExamples')}
        </p>
      </section>
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#7c9cff]">
          {t('legendToolsHeading')}
        </h3>
        <p className="mt-1 text-sm font-medium text-foreground">
          {t('legendToolsSubtitle')}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {t('legendToolsExamples')}
        </p>
      </section>
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-200/90">
          {t('legendOriginsHeading')}
        </h3>
        <p className="mt-1 text-sm font-medium text-foreground">
          {t('legendOriginsSubtitle')}
        </p>
        <div className="mt-3">
          <TableOrigins />
        </div>
      </section>
      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-amber-200/90">
          {t('legendNatureHeading')}
        </h3>
        <p className="mt-1 text-sm font-medium text-foreground">
          {t('legendNatureSubtitle')}
        </p>
        <div className="mt-3">
          <TableNature />
        </div>
      </section>
    </div>
  );

  const header = (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
      <h2
        id="explore-legend-title"
        className="text-lg font-bold text-foreground"
        style={{
          fontFamily:
            'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
        }}
      >
        {t('legendTitle')}
      </h2>
      <button
        type="button"
        onClick={() => close()}
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground"
        aria-label={t('legendCloseAria')}
      >
        <span className="text-xl leading-none" aria-hidden>
          ×
        </span>
      </button>
    </div>
  );

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label={t('legendCloseAria')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[74] bg-black/55"
            onClick={() => close()}
          />
          {isMobile ? (
            <motion.div
              key="legend-mobile"
              role="dialog"
              aria-modal
              aria-labelledby="explore-legend-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={TRANSITION}
              className="fixed inset-x-0 bottom-0 z-[75] flex max-h-[min(92dvh,720px)] flex-col rounded-t-2xl border border-border border-b-0 bg-surface shadow-2xl"
            >
              {header}
              {body}
            </motion.div>
          ) : (
            <motion.aside
              key="legend-desktop"
              role="dialog"
              aria-modal
              aria-labelledby="explore-legend-title"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={TRANSITION}
              className="fixed bottom-0 left-0 top-14 z-[75] flex w-[min(100vw,300px)] max-w-[300px] flex-col border-r border-border bg-surface shadow-2xl"
              style={{ width: LEGEND_W }}
            >
              {header}
              {body}
            </motion.aside>
          )}
        </>
      ) : null}
    </AnimatePresence>
  );
}

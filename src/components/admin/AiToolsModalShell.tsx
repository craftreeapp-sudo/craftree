'use client';

import type { ReactNode } from 'react';

export function AiToolsModalCloseButton({
  onClose,
  label,
}: {
  onClose: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      aria-label={label}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="h-5 w-5"
        aria-hidden
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  );
}

/**
 * Deux colonnes : formulaire (teinte ambre) · panneau explicatif (teinte rose).
 */
export function AiToolsModalShell({
  form,
  panel,
  footer,
}: {
  form: ReactNode;
  panel: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)] lg:items-start lg:gap-5">
        <div className="min-w-0 space-y-3 rounded-xl border border-amber-500/35 bg-amber-500/[0.07] p-4 dark:bg-amber-950/25">
          {form}
        </div>
        <aside className="min-w-0 space-y-3 rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/[0.08] p-4 dark:bg-fuchsia-950/25">
          {panel}
        </aside>
      </div>
      {footer ? (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
          {footer}
        </div>
      ) : null}
    </>
  );
}

export function AiToolsPanelSections({
  aboutTitle,
  aboutBody,
  summaryTitle,
  summaryBody,
}: {
  aboutTitle: string;
  aboutBody: string;
  summaryTitle: string;
  summaryBody: ReactNode;
}) {
  return (
    <>
      <section>
        <h3 className="text-sm font-semibold text-foreground">{aboutTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {aboutBody}
        </p>
      </section>
      <section>
        <h3 className="text-sm font-semibold text-foreground">{summaryTitle}</h3>
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {summaryBody}
        </div>
      </section>
    </>
  );
}

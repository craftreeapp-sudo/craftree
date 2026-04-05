'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AIReviewBatch } from '@/components/admin/AIReviewBatch';
import { AddInventionsModal } from '@/components/admin/AddInventionsModal';
import { EnrichInventionsModal } from '@/components/admin/EnrichInventionsModal';
import { FixImagesModal } from '@/components/admin/FixImagesModal';
import { AIOperationHistory } from '@/components/admin/AIOperationHistory';

function IconAiReview() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAddInventions() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <path
        d="M12 11v6M9 14h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconEnrich() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 19h16M6 15h8M8 11h12M10 7h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M18 3l2 2-6 6h-3V8l6-6z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconImages() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M3 16l5-5 4 4 4-4 5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="9.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ToolIconWrap({
  children,
  variant,
}: {
  children: ReactNode;
  variant: 'review' | 'default';
}) {
  const box =
    variant === 'review'
      ? 'bg-violet-500/15 text-violet-300'
      : 'bg-muted/40 text-muted-foreground';
  return (
    <div
      className={`mb-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${box}`}
    >
      {children}
    </div>
  );
}

const toolCardClass =
  'flex h-full min-h-[200px] flex-col rounded-xl border border-amber-500/25 bg-surface/50 p-4 text-left shadow-sm transition-colors hover:border-amber-500/40 hover:bg-amber-500/[0.04]';

export function AIToolsTab({
  onToast,
}: {
  onToast: (message: string, kind: 'ok' | 'err') => void;
}) {
  const t = useTranslations('editor');
  const [addOpen, setAddOpen] = useState(false);
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [imagesOpen, setImagesOpen] = useState(false);

  return (
    <div className="flex min-h-[50vh] flex-col pb-8">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        {t('aiToolsIntro')}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* 1 — AI Review (lot) */}
        <div
          className={`${toolCardClass} border-violet-500/30 hover:border-violet-500/45 hover:bg-violet-500/[0.06]`}
        >
          <ToolIconWrap variant="review">
            <IconAiReview />
          </ToolIconWrap>
          <span className="text-base font-semibold text-foreground">
            {t('aiToolsCardReview')}
          </span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {t('aiToolsCardReviewDesc')}
          </span>
          <div className="mt-4 w-full">
            <AIReviewBatch onResult={onToast} />
          </div>
        </div>

        {/* 2 — Ajouter des inventions */}
        <div className={toolCardClass}>
          <ToolIconWrap variant="default">
            <IconAddInventions />
          </ToolIconWrap>
          <span className="text-base font-semibold text-foreground">
            {t('aiToolsCardAdd')}
          </span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {t('aiToolsCardAddDesc')}
          </span>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="mt-4 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
          >
            {t('aiToolsCardOpen')}
          </button>
        </div>

        {/* 3 — Enrichir des fiches */}
        <div className={toolCardClass}>
          <ToolIconWrap variant="default">
            <IconEnrich />
          </ToolIconWrap>
          <span className="text-base font-semibold text-foreground">
            {t('aiToolsCardEnrich')}
          </span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {t('aiToolsCardEnrichDesc')}
          </span>
          <button
            type="button"
            onClick={() => setEnrichOpen(true)}
            className="mt-4 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
          >
            {t('aiToolsCardOpen')}
          </button>
        </div>

        {/* 4 — Images Wikipédia */}
        <div className={toolCardClass}>
          <ToolIconWrap variant="default">
            <IconImages />
          </ToolIconWrap>
          <span className="text-base font-semibold text-foreground">
            {t('aiToolsCardImages')}
          </span>
          <span className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            {t('aiToolsCardImagesDesc')}
          </span>
          <button
            type="button"
            onClick={() => setImagesOpen(true)}
            className="mt-4 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/30"
          >
            {t('aiToolsCardOpen')}
          </button>
        </div>
      </div>

      <AIOperationHistory className="mt-8 rounded-xl border border-pink-500/25 bg-pink-950/20 p-4 sm:p-5" />

      <AddInventionsModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onToast={onToast}
      />
      <EnrichInventionsModal
        open={enrichOpen}
        onClose={() => setEnrichOpen(false)}
        onToast={onToast}
      />
      <FixImagesModal
        open={imagesOpen}
        onClose={() => setImagesOpen(false)}
        onToast={onToast}
      />
    </div>
  );
}

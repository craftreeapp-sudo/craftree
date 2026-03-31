'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useToastStore } from '@/stores/toast-store';
import { trackEvent } from '@/lib/analytics';

type Props = {
  nodeId: string;
  className?: string;
  /** Empêche la navigation quand le bouton est dans une carte cliquable. */
  stopInteractionBubble?: boolean;
};

export function ShareInventionButton({
  nodeId,
  className = '',
  stopInteractionBubble = false,
}: Props) {
  const tCommon = useTranslations('common');
  const pushToast = useToastStore((s) => s.pushToast);

  const handleShare = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (stopInteractionBubble) {
        e.preventDefault();
        e.stopPropagation();
      }
      trackEvent('share', nodeId);
      const url = `${window.location.origin}/invention/${encodeURIComponent(nodeId)}`;
      void navigator.clipboard.writeText(url);
      pushToast(tCommon('linkCopied'), 'success');
    },
    [nodeId, pushToast, stopInteractionBubble, tCommon]
  );

  const bubble = stopInteractionBubble
    ? (ev: React.PointerEvent) => {
        ev.stopPropagation();
      }
    : undefined;

  return (
    <button
      type="button"
      onClick={handleShare}
      onPointerDown={bubble}
      className={`rounded-lg p-2 text-muted-foreground transition-colors hover:bg-border/30 hover:text-foreground ${className}`}
      aria-label={tCommon('share')}
    >
      <svg
        width={20}
        height={20}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    </button>
  );
}

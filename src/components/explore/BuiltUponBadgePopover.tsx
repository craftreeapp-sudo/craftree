'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { hexToRgba } from '@/lib/colors';

type Pos = { top: number; left: number };

/**
 * Badge chiffre (cartes « built upon ») + popover au survol / focus.
 * Rendu en portail (fixed) pour ne pas être rogné par overflow-hidden des cartes.
 */
export function BuiltUponBadgePopover({
  count,
  borderColor,
}: {
  count: number;
  borderColor: string;
}) {
  const t = useTranslations('explore');
  const tipId = useId();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePos = useCallback(() => {
    const el = badgeRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + 8,
      left: r.left + r.width / 2,
    });
  }, []);

  const show = useCallback(() => {
    updatePos();
    setOpen(true);
  }, [updatePos]);

  const hide = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    if (open) updatePos();
  }, [open, count, updatePos]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePos();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePos]);

  const popover =
    mounted && open && pos ? (
      <div
        id={tipId}
        role="tooltip"
        className="pointer-events-none fixed z-[10000] max-w-[min(18rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-lg border border-border bg-surface-elevated px-3 py-2.5 text-start text-xs shadow-xl ring-1 ring-black/10 dark:ring-white/10"
        style={{ top: pos.top, left: pos.left }}
      >
        <p className="font-semibold leading-snug text-foreground">
          {t('badgeBuiltUponHelpTitle')}
        </p>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">
          {t('badgeBuiltUponHelpBody', { count })}
        </p>
      </div>
    ) : null;

  return (
    <>
      <span
        ref={badgeRef}
        tabIndex={0}
        className="flex min-h-7 min-w-7 shrink-0 cursor-help items-center justify-center rounded border-2 px-1 text-xs font-semibold tabular-nums text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{
          borderColor: borderColor,
          backgroundColor: hexToRgba(borderColor, 0.12),
        }}
        aria-describedby={open ? tipId : undefined}
        aria-label={t('badgeBuiltUponTitle', { count })}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {count}
      </span>
      {mounted && popover ? createPortal(popover, document.body) : null}
    </>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ThemeMode } from '@/lib/theme-constants';
import { useThemeStore } from '@/stores/theme-store';

const BTN =
  'inline-flex shrink-0 items-center justify-center rounded-[6px] border border-border bg-transparent p-1.5 text-foreground transition-colors hover:border-accent';

const MENU =
  'absolute z-[110] mt-1 min-w-[12rem] rounded-[8px] border border-border bg-surface-elevated py-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]';

const ITEM =
  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-foreground transition-colors hover:bg-surface';

const ITEM_ACTIVE = 'bg-surface';

function IconMoon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function IconSun({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity="0.2" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

const MODES: { id: ThemeMode; Icon: typeof IconMoon }[] = [
  { id: 'dark', Icon: IconMoon },
  { id: 'light', Icon: IconSun },
];

export function ThemeSwitcher({ align = 'end' }: { align?: 'start' | 'end' }) {
  const t = useTranslations('theme');
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const CurrentIcon = MODES.find((m) => m.id === theme)?.Icon ?? IconMoon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(e.target as globalThis.Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const onPick = useCallback(
    (mode: ThemeMode) => {
      setOpen(false);
      if (mode !== theme) setTheme(mode);
    },
    [setTheme, theme]
  );

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 ${align === 'start' ? 'order-first' : ''}`}
    >
      <button
        type="button"
        className={BTN}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={t('switchTheme')}
        title={t('switchTheme')}
        onClick={() => setOpen((o) => !o)}
      >
        <CurrentIcon className="text-muted-foreground" />
      </button>
      {open ? (
        <div
          className={`${MENU} ${align === 'start' ? 'left-0' : 'right-0'}`}
          role="listbox"
          aria-label={t('switchTheme')}
        >
          {MODES.map(({ id, Icon }) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={id === theme}
              className={`${ITEM} ${id === theme ? ITEM_ACTIVE : ''}`}
              onClick={() => onPick(id)}
            >
              <Icon className="shrink-0 text-muted-foreground" />
              <span>{t(id)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

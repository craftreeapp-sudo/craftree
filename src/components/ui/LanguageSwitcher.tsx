'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import type { AppLocale } from '@/lib/i18n-config';

const OPTIONS: {
  locale: AppLocale;
  flag: string;
  label: string;
}[] = [
  { locale: 'fr', flag: '🇫🇷', label: 'Français' },
  { locale: 'en', flag: '🇬🇧', label: 'English' },
  { locale: 'es', flag: '🇪🇸', label: 'Español' },
  { locale: 'zh', flag: '🇨🇳', label: '中文' },
  { locale: 'hi', flag: '🇮🇳', label: 'हिन्दी' },
  { locale: 'ar', flag: '🇸🇦', label: 'العربية' },
];

const BTN =
  'inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border border-border bg-transparent px-2.5 py-1 text-[13px] text-foreground transition-colors hover:border-accent';

const MENU =
  'absolute z-[110] mt-1 min-w-[11rem] rounded-[8px] border border-border bg-surface-elevated py-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)]';

const ITEM =
  'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface';

const ITEM_ACTIVE = 'bg-surface';

function switchLocale(newLocale: string) {
  document.cookie = `locale=${newLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
  window.location.reload();
}

export function LanguageSwitcher({ align = 'end' }: { align?: 'start' | 'end' }) {
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = OPTIONS.find((o) => o.locale === locale) ?? OPTIONS[0];

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

  const onPick = useCallback((next: AppLocale) => {
    setOpen(false);
    if (next !== locale) switchLocale(next);
  }, [locale]);

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
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>{current.flag}</span>
        <span className="font-medium uppercase">{current.locale}</span>
      </button>
      {open ? (
        <div
          className={`${MENU} ${align === 'start' ? 'left-0' : 'right-0'}`}
          role="listbox"
          aria-label="Language"
        >
          {OPTIONS.map((o) => (
            <button
              key={o.locale}
              type="button"
              role="option"
              aria-selected={o.locale === locale}
              className={`${ITEM} ${o.locale === locale ? ITEM_ACTIVE : ''}`}
              onClick={() => onPick(o.locale)}
            >
              <span aria-hidden>{o.flag}</span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

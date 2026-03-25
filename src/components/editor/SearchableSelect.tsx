'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getCategoryColor } from '@/lib/colors';
import type { NodeCategory } from '@/lib/types';

export interface SearchableOption {
  value: string;
  label: string;
  category?: NodeCategory;
}

type Props = {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Rechercher…',
  disabled = false,
  className = '',
  inputRef: externalRef,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const innerRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? innerRef;
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(t) ||
        o.value.toLowerCase().includes(t)
    );
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQ('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-left text-sm text-[#E8ECF4] outline-none focus:border-[#3B82F6] disabled:opacity-50"
      >
        <span className="truncate">
          {selected ? (
            <span className="flex items-center gap-2">
              {selected.category ? (
                <span
                  className="h-2 w-2 shrink-0 rounded-sm"
                  style={{
                    backgroundColor: getCategoryColor(selected.category),
                  }}
                />
              ) : null}
              {selected.label}
            </span>
          ) : (
            <span className="text-[#5A6175]">{placeholder}</span>
          )}
        </span>
        <span className="text-[#8B95A8]">▼</span>
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-hidden rounded-lg border border-[#2A3042] bg-[#1A1F2E] shadow-xl">
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full border-b border-[#2A3042] bg-[#111827] px-3 py-2 text-sm text-[#E8ECF4] placeholder:text-[#5A6175] outline-none focus:border-[#3B82F6]"
            autoFocus
          />
          <ul className="max-h-48 overflow-y-auto py-1 text-sm">
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#E8ECF4] hover:bg-[#2A3042]"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  {o.category ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: getCategoryColor(o.category),
                      }}
                    />
                  ) : null}
                  <span className="truncate">{o.label}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-[#8B95A8]">Aucun résultat</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { ToastKind } from '@/stores/toast-store';

const KIND_CLASS: Record<ToastKind, string> = {
  default: 'glass-surface border border-border text-foreground',
  success:
    'border border-emerald-500/80 bg-emerald-950/80 text-emerald-50 shadow-[0_0_28px_-4px_rgba(16,185,129,0.5)] ring-1 ring-emerald-400/40',
  error: 'glass-surface border border-red-500/60 text-foreground',
};

export function Toast({
  message,
  kind,
  onDismiss,
  durationMs,
}: {
  message: string;
  kind: ToastKind;
  onDismiss: () => void;
  /** Défaut : succès un peu plus long pour laisser le temps de lire (ex. suggestion envoyée). */
  durationMs?: number;
}) {
  const resolvedDuration =
    durationMs ?? (kind === 'success' ? 5200 : 3000);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
    }, resolvedDuration);
    return () => clearTimeout(t);
  }, [resolvedDuration]);

  useEffect(() => {
    if (visible) return;
    const t = setTimeout(onDismiss, 300);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  return (
    <div
      className={`pointer-events-auto max-w-[min(90vw,360px)] rounded-lg px-5 py-3 text-[13px] transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${KIND_CLASS[kind]}`}
      role="status"
    >
      {message}
    </div>
  );
}

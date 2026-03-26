'use client';

import { useEffect, useState } from 'react';
import type { ToastKind } from '@/stores/toast-store';

const BORDER: Record<ToastKind, string> = {
  default: 'border-[#2A3042]',
  success: 'border-emerald-500/60',
  error: 'border-red-500/60',
};

export function Toast({
  message,
  kind,
  onDismiss,
  durationMs = 3000,
}: {
  message: string;
  kind: ToastKind;
  onDismiss: () => void;
  durationMs?: number;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
    }, durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);

  useEffect(() => {
    if (visible) return;
    const t = setTimeout(onDismiss, 300);
    return () => clearTimeout(t);
  }, [visible, onDismiss]);

  return (
    <div
      className={`pointer-events-auto max-w-[min(90vw,360px)] rounded-lg border bg-[#1A1F2E] px-5 py-3 text-[13px] text-[#E8ECF4] shadow-lg transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${BORDER[kind]}`}
      role="status"
    >
      {message}
    </div>
  );
}

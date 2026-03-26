'use client';

import { useToastStore } from '@/stores/toast-store';
import { Toast } from './Toast';

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 right-6 z-[250] flex flex-col items-end gap-2"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          kind={t.kind}
          onDismiss={() => removeToast(t.id)}
        />
      ))}
    </div>
  );
}

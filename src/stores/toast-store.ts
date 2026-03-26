'use client';

import { create } from 'zustand';

export type ToastKind = 'default' | 'success' | 'error';

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

interface ToastStore {
  toasts: ToastItem[];
  pushToast: (message: string, kind?: ToastKind) => void;
  removeToast: (id: number) => void;
}

let idSeq = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  pushToast: (message, kind = 'default') => {
    const id = ++idSeq;
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

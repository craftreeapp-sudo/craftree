'use client';

import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/auth-utils';

interface AuthStore {
  user: User | null;
  /** Compte connecté (non anonyme). */
  isLoggedIn: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  initialized: boolean;
  initialize: () => void;
}

function applyUser(user: User | null, set: (p: Partial<AuthStore>) => void) {
  set({
    user,
    isLoggedIn: user !== null,
    isAdmin: isAdminEmail(user?.email),
    isLoading: false,
  });
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoggedIn: false,
  isAdmin: false,
  isLoading: true,
  initialized: false,

  initialize: () => {
    if (useAuthStore.getState().initialized) return;
    set({ initialized: true });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      applyUser(session?.user ?? null, set);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null, set);
    });
  },
}));

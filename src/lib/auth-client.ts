'use client';

import { supabase } from '@/lib/supabase';

export async function signInWithGoogle() {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=/explore`,
    },
  });
  if (error) console.error('Auth error:', error);
}

export async function signOut() {
  await supabase.auth.signOut();
  if (typeof window !== 'undefined') window.location.reload();
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

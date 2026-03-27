'use client';

import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type SignInWithGoogleResult = {
  error: AuthError | Error | null;
  /** Pour afficher un message i18n côté UI */
  code?: 'missing_config' | 'no_oauth_url';
};

function hasSupabaseBrowserConfig(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key);
}

/**
 * OAuth Google : avec skipBrowserRedirect, Supabase renvoie l’URL ;
 * on redirige explicitement (évite les échecs silencieux selon versions / SSR).
 */
export async function signInWithGoogle(): Promise<SignInWithGoogleResult> {
  if (typeof window === 'undefined') {
    return { error: new Error('signInWithGoogle: window unavailable') };
  }

  if (!hasSupabaseBrowserConfig()) {
    return {
      error: new Error('missing_config'),
      code: 'missing_config',
    };
  }

  const origin = window.location.origin;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=/explore`,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    console.error('Auth error:', error);
    return { error };
  }

  if (data?.url) {
    window.location.assign(data.url);
    return { error: null };
  }

  return {
    error: new Error('no_oauth_url'),
    code: 'no_oauth_url',
  };
}

export async function signOut() {
  await supabase.auth.signOut();
  if (typeof window !== 'undefined') window.location.assign('/');
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

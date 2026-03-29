'use client';

import type { AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';

const DEFAULT_AFTER_AUTH = treeInventionPath(getDefaultTreeNodeId());

export type SignInWithGoogleResult = {
  error: AuthError | Error | null;
  /** Pour afficher un message i18n côté UI */
  code?: 'missing_config' | 'no_oauth_url';
};

export type SignInWithGoogleOptions = {
  /**
   * Si vrai (défaut), Google affiche le sélecteur de compte (`prompt=select_account`).
   * Permet de choisir un autre compte Google sans rester bloqué sur la session navigateur.
   */
  promptAccountSelection?: boolean;
  /** Chemin après succès OAuth (défaut : première invention /tree) */
  nextPath?: string;
};

export type SignOutOptions = {
  /**
   * Redirection après déconnexion.
   * - défaut : `/`
   * - `false` : pas de redirection (ex. avant `signInWithGoogle` pour changer de compte)
   */
  redirectTo?: string | false;
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
export async function signInWithGoogle(
  options?: SignInWithGoogleOptions
): Promise<SignInWithGoogleResult> {
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
  const nextPath = options?.nextPath ?? DEFAULT_AFTER_AUTH;
  const safeNext = nextPath.startsWith('/') ? nextPath : DEFAULT_AFTER_AUTH;

  const promptAccountSelection = options?.promptAccountSelection !== false;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
      skipBrowserRedirect: true,
      queryParams: promptAccountSelection
        ? { prompt: 'select_account' }
        : undefined,
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

/**
 * Déconnexion complète (session Supabase côté serveur + client).
 * @param redirectTo - `false` pour ne pas quitter la page (ex. enchaîner avec une nouvelle connexion Google).
 */
export async function signOut(options?: SignOutOptions) {
  await supabase.auth.signOut({ scope: 'global' });
  if (typeof window === 'undefined') return;
  if (options?.redirectTo === false) return;
  const path = typeof options?.redirectTo === 'string' ? options.redirectTo : '/';
  window.location.assign(path);
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

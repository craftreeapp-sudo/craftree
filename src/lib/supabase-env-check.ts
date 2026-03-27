/**
 * Indique si les variables d’environnement Supabase sont présentes.
 * Utilisable dans les route handlers et le code serveur (pas un hook React).
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

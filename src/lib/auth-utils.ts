/** Utilisable côté client et serveur (pas d’import Supabase navigateur). */
export function isAdminEmail(email: string | undefined): boolean {
  const admin = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!admin || !email) return false;
  return email === admin;
}

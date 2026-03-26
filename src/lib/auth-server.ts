import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { isAdminEmail } from '@/lib/auth-utils';

export async function getRouteHandlerUser() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

export async function requireAdminFromRequest(): Promise<boolean> {
  const user = await getRouteHandlerUser();
  return isAdminEmail(user?.email);
}

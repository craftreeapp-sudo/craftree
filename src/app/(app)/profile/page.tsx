import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase-route';
import { ProfilePageClient } from '@/components/profile/ProfilePageClient';

export const metadata: Metadata = {
  title: 'Profil — Craftree',
  description: 'Votre profil contributeur Craftree.',
};

export default async function ProfilePage() {
  const supabase = await createSupabaseRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/explore');
  }
  return <ProfilePageClient />;
}

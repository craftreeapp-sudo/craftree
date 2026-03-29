import type { Metadata } from 'next';
import { AdminInventionsPageClient } from '@/components/admin/AdminInventionsPageClient';

export const metadata: Metadata = {
  title: { absolute: 'Craftree — Toutes les inventions' },
  description:
    'Liste administrative de toutes les fiches du graphe (accès réservé).',
};

export default function AdminInventionsPage() {
  return <AdminInventionsPageClient />;
}

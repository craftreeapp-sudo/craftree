import { AdminSuggestionDetailClient } from '@/components/admin/AdminSuggestionDetailClient';

export default async function AdminSuggestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminSuggestionDetailClient id={id} />;
}

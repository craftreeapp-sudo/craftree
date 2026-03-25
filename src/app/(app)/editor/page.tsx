import type { Metadata } from 'next';
import { EditorPageClient } from '@/components/editor/EditorPageClient';

export const metadata: Metadata = {
  title: { absolute: 'Craftree — Éditeur' },
  description: 'Gestion des inventions et des liens du graphe.',
};

export default function EditorPage() {
  return <EditorPageClient />;
}

import type { Metadata } from 'next';
import { CategoriesPickerClient } from '@/components/categories/CategoriesPickerClient';

export const metadata: Metadata = {
  title: { absolute: 'Catégories — Craftree' },
  description:
    'Parcourez les catégories, époques et types de technologies, puis ouvrez le Tree filtré.',
};

export default function CategoriesPage() {
  return <CategoriesPickerClient />;
}

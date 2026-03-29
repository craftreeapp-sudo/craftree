import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CategoriesPickerClient } from '@/components/categories/CategoriesPickerClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('categoriesPage');
  return {
    title: { absolute: t('metaTitle') },
    description: t('metaDescription'),
  };
}

export default function CategoriesPage() {
  return <CategoriesPickerClient />;
}

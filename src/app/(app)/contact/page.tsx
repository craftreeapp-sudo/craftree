import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContactPageClient } from '@/components/contact/ContactPageClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contactPage');
  return {
    title: { absolute: `${t('title')} — Craftree` },
    description: t('intro'),
  };
}

export default function ContactPage() {
  return <ContactPageClient />;
}

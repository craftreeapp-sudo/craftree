'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { treeInventionPath, getDefaultTreeNodeId } from '@/lib/tree-routes';

/** Lien « Retour au Tree » (/tree), aligné sur la page profil. */
export function BackToExploreLink({ className }: { className?: string }) {
  const t = useTranslations('profile');
  return (
    <Link
      href={treeInventionPath(getDefaultTreeNodeId())}
      className={`mb-8 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-accent ${className ?? ''}`}
    >
      <svg
        className="size-4 shrink-0 rtl:rotate-180"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {t('backToTree')}
    </Link>
  );
}

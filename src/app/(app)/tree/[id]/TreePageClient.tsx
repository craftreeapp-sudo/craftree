'use client';

import { use } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ExplosionTreeView } from '@/components/graph/ExplosionTreeView';
import { useGraphStore } from '@/stores/graph-store';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { getNameEnForNode } from '@/lib/name-en-lookup';

export function TreePageClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const locale = useLocale();
  const tNav = useTranslations('nav');
  const te = useTranslations('editor');
  const root = useGraphStore((s) => s.getNodeById(id));
  const label =
    root != null
      ? pickNodeDisplayName(locale, root.name, getNameEnForNode(id))
      : id;

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-14">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-page/95 px-4 py-2.5 backdrop-blur-md">
        <nav
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-sm"
          aria-label={tNav('breadcrumbAria')}
        >
          <Link
            href="/"
            className="shrink-0 text-accent transition-colors hover:underline"
          >
            Craftree
          </Link>
          <span className="text-muted-foreground" aria-hidden>
            ›
          </span>
          <span
            className="truncate font-medium text-foreground"
            title={label}
          >
            {label}
          </span>
          <span className="text-muted-foreground" aria-hidden>
            ›
          </span>
          <span className="text-muted-foreground">{tNav('dependencyTree')}</span>
        </nav>
        <Link
          href={`/explore?node=${encodeURIComponent(id)}`}
          className="shrink-0 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border"
        >
          {te('backToTree')}
        </Link>
      </div>
      <div className="relative min-h-0 flex-1">
        <ExplosionTreeView rootId={id} />
      </div>
    </main>
  );
}

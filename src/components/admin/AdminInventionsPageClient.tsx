'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AppContentShell } from '@/components/layout/AppContentShell';
import { BackToExploreLink } from '@/components/layout/BackToExploreLink';
import { EDITOR_DIM_KEY, EDITOR_LEVEL_KEY } from '@/components/editor/dimension-editor-keys';
import { useAuthStore } from '@/stores/auth-store';
import { getCategoryColor } from '@/lib/colors';
import { filterValidCraftingLinks } from '@/lib/graph-utils';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import type {
  CraftingLink,
  MaterialLevel,
  NodeCategory,
  NodeDimension,
  SeedNode,
  TechNodeType,
} from '@/lib/types';

export function AdminInventionsPageClient() {
  const router = useRouter();
  const tAdmin = useTranslations('admin');
  const te = useTranslations('editor');
  const tCat = useTranslations('categories');
  const tType = useTranslations('types');
  const tEra = useTranslations('eras');
  const { isAdmin, isLoading } = useAuthStore();
  const [nodes, setNodes] = useState<SeedNode[]>([]);
  const [links, setLinks] = useState<CraftingLink[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nr, lr] = await Promise.all([
        fetch('/api/nodes?full=1'),
        fetch('/api/links'),
      ]);
      const nj = await nr.json();
      const lj = await lr.json();
      setNodes(nj.nodes ?? []);
      setLinks(lj.links ?? []);
    } catch {
      setNodes([]);
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!isAdmin) {
      router.replace(treeInventionPath(getDefaultTreeNodeId()));
      return;
    }
    void load();
  }, [isAdmin, isLoading, router, load]);

  const graphEdges = useMemo(() => {
    if (nodes.length === 0) return [];
    const forGraph = nodes.map((n) => ({
      id: n.id,
      type: n.type as TechNodeType,
    }));
    return filterValidCraftingLinks(forGraph, links);
  }, [nodes, links]);

  const linkTotalByNode = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of graphEdges) {
      m.set(l.source_id, (m.get(l.source_id) ?? 0) + 1);
      m.set(l.target_id, (m.get(l.target_id) ?? 0) + 1);
    }
    return m;
  }, [graphEdges]);

  const [q, setQ] = useState('');
  /** Nœuds sans aucun lien entrant ni sortant (graphe valide), comme l’éditeur. */
  const [isolatedOnly, setIsolatedOnly] = useState(false);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let list = [...nodes];
    if (isolatedOnly) {
      list = list.filter((n) => (linkTotalByNode.get(n.id) ?? 0) === 0);
    }
    if (ql) {
      list = list.filter((n) => {
        const hay = [
          n.name,
          n.id,
          n.name_en ?? '',
          n.origin ?? '',
        ]
          .join('\n')
          .toLowerCase();
        return hay.includes(ql);
      });
    }
    list.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    return list;
  }, [nodes, q, isolatedOnly, linkTotalByNode]);

  if (isLoading || !isAdmin) {
    return (
      <AppContentShell
        variant="full"
        className="flex min-h-[50vh] w-full flex-1 flex-col items-center justify-center text-center text-muted-foreground"
      >
        …
      </AppContentShell>
    );
  }

  return (
    <AppContentShell
      variant="full"
      className="flex w-full min-w-0 flex-1 flex-col text-foreground"
    >
      <div className="pb-3">
        <BackToExploreLink />
        <Link
          href="/admin"
          className="mb-2 inline-block text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {tAdmin('backToAdmin')}
        </Link>
        <h1
          className="text-lg font-semibold tracking-tight text-foreground md:text-xl"
          style={{
            fontFamily:
              'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          {tAdmin('allInventionsPageTitle')}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {tAdmin('allInventionsDescription')}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={te('searchPlaceholderNodes')}
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-accent"
        />
        <button
          type="button"
          title={te('isolatedOnlyTitle')}
          aria-pressed={isolatedOnly}
          onClick={() => setIsolatedOnly((v) => !v)}
          className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            isolatedOnly
              ? 'border-[#F87171] bg-[#7f1d1d]/35 text-[#fecaca] hover:bg-[#7f1d1d]/50'
              : 'border-border bg-surface-elevated text-foreground hover:bg-border'
          }`}
        >
          {te('noLinks')}
        </button>
        <span className="text-sm text-muted-foreground">
          {te('nodeCount', { count: filtered.length })}
        </span>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{te('loading')}</p>
      ) : (
        <div className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-auto rounded-lg border border-border md:overflow-x-visible">
          <table className="w-full min-w-0 table-fixed border-collapse text-sm">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '5%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface-elevated text-start text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-1 py-2 text-center">{te('imageColumn')}</th>
                <th className="px-2 py-2 text-foreground sm:px-3">{te('name')}</th>
                <th className="px-2 py-2 sm:px-3">id</th>
                <th className="px-2 py-2 sm:px-3">{te('category')}</th>
                <th className="px-2 py-2 sm:px-3">{te('type')}</th>
                <th className="px-2 py-2 sm:px-3">{te('columnDimension')}</th>
                <th className="px-2 py-2 sm:px-3">{te('columnLevel')}</th>
                <th className="px-2 py-2 sm:px-3">{te('era')}</th>
                <th className="px-2 py-2 text-center sm:px-3">{te('links')}</th>
                <th className="px-2 py-2 sm:px-3">{te('actionsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((n, i) => {
                const bg = i % 2 === 0 ? 'bg-surface' : 'bg-[#0F1420]';
                const lc = linkTotalByNode.get(n.id) ?? 0;
                return (
                  <tr key={n.id} className={`border-t border-border ${bg}`}>
                    <td className="w-14 px-1 py-2 align-middle">
                      <div className="flex justify-center">
                        {n.image_url?.trim() ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={n.image_url}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-md text-sm font-bold text-white"
                            style={{
                              backgroundColor: getCategoryColor(
                                n.category as NodeCategory
                              ),
                            }}
                            aria-hidden
                          >
                            {n.name.trim().charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td
                      className="max-w-0 truncate px-2 py-2 font-medium text-foreground sm:px-3"
                      title={n.name}
                    >
                      {n.name}
                    </td>
                    <td className="max-w-0 px-2 py-2 font-mono text-[11px] leading-snug text-muted-foreground break-all sm:px-3">
                      {n.id}
                    </td>
                    <td className="max-w-0 px-2 py-2 sm:px-3">
                      <span
                        className="inline-flex max-w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-xs sm:px-2"
                        style={{
                          borderColor: getCategoryColor(n.category as NodeCategory),
                          color: getCategoryColor(n.category as NodeCategory),
                        }}
                      >
                        {safeCategoryLabel(tCat, String(n.category), tType)}
                      </span>
                    </td>
                    <td className="max-w-0 px-2 py-2 sm:px-3">
                      <span className="inline-block max-w-full truncate rounded bg-[#2A3042] px-1.5 py-0.5 text-xs text-foreground sm:px-2">
                        {tType.has(n.type as TechNodeType)
                          ? tType(n.type as TechNodeType)
                          : n.type}
                      </span>
                    </td>
                    <td className="max-w-0 truncate px-2 py-2 text-muted-foreground sm:px-3">
                      {n.dimension
                        ? te(EDITOR_DIM_KEY[n.dimension as NodeDimension])
                        : te('notSet')}
                    </td>
                    <td className="max-w-0 truncate px-2 py-2 text-muted-foreground sm:px-3">
                      {n.dimension === 'matter' && n.materialLevel
                        ? te(EDITOR_LEVEL_KEY[n.materialLevel as MaterialLevel])
                        : te('notSet')}
                    </td>
                    <td className="max-w-0 truncate px-2 py-2 text-muted-foreground sm:px-3">
                      {tEra.has(n.era) ? tEra(n.era) : n.era}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums text-muted-foreground sm:px-3">
                      {lc}
                    </td>
                    <td className="max-w-0 px-2 py-2 sm:px-3">
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-2">
                        <Link
                          href={treeInventionPath(n.id)}
                          className="rounded border border-border bg-surface-elevated px-2 py-1 text-xs text-foreground transition-colors hover:bg-border"
                        >
                          {tAdmin('openInTree')}
                        </Link>
                        <Link
                          href="/editor"
                          className="rounded border border-border bg-surface-elevated px-2 py-1 text-xs text-foreground transition-colors hover:bg-border"
                        >
                          {tAdmin('openInEditor')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppContentShell>
  );
}

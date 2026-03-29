'use client';

import { useLayoutEffect, useMemo } from 'react';
import { LayoutGroup } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import type { TechNodeBasic } from '@/lib/types';
import {
  bucketLedToOutputs,
  directDependencyCount,
  directDownstreamCount,
  MATERIAL_COLUMNS,
  totalDownstreamCardCount,
} from '@/lib/built-upon-utils';
import { InventionCard } from './InventionCard';

function cardLayoutId(id: string) {
  return `inv-card-${id}`;
}

type Props = {
  focusId: string;
  focusNode: TechNodeBasic;
  goTo: (id: string) => void;
};

export function LedToView({ focusId, focusNode, goTo }: Props) {
  const t = useTranslations('explore');

  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const imageBustByNodeId = useGraphStore((s) => s.imageBustByNodeId);

  const buckets = useMemo(
    () => bucketLedToOutputs(focusId, nodes, edges),
    [focusId, nodes, edges]
  );

  const totalDown = useMemo(
    () => totalDownstreamCardCount(focusId, edges),
    [focusId, edges]
  );

  const mainOut = useMemo(
    () => directDownstreamCount(focusId, edges),
    [focusId, edges]
  );

  /** Positionnement instantané (sans animation de scroll) sur la carte principale, avant le premier rendu peint — pas de « glissement » depuis le haut. */
  useLayoutEffect(() => {
    document.getElementById('explore-led-to-hero')?.scrollIntoView({
      behavior: 'auto',
      block: 'end',
      inline: 'nearest',
    });
  }, [focusId]);

  return (
    <LayoutGroup id="led-to-cards">
      <div className="mx-auto flex w-full max-w-[calc(72rem+10px)] flex-col gap-6 pb-4 pt-2">
        <div className="-mx-[60px] flex flex-col gap-6">
        <div className="rounded-xl border border-border bg-surface-elevated p-4">
          <div className="sticky top-0 z-10 -mx-4 mb-3 border-b border-border/60 bg-surface-elevated/95 px-4 py-3 backdrop-blur-sm">
            <div className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {t('builtUponTools')}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {buckets.tools.map((n) => (
              <InventionCard
                key={n.id}
                node={n}
                directDeps={directDependencyCount(n.id, edges)}
                variant="compact"
                layoutId={cardLayoutId(n.id)}
                imageBust={imageBustByNodeId[n.id] ?? 0}
                exploreInteractive
                onClick={() => goTo(n.id)}
              />
            ))}
            {buckets.tools.length === 0 ? (
              <p className="col-span-2 text-sm text-muted-foreground sm:col-span-4 lg:col-span-8">
                {t('builtUponEmpty')}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-elevated p-4">
          <div className="sticky top-0 z-10 -mx-4 mb-3 border-b border-border/60 bg-surface-elevated/95 px-4 py-3 backdrop-blur-sm">
            <div className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {t('builtUponProcess')}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {buckets.process.map((n) => (
              <InventionCard
                key={n.id}
                node={n}
                directDeps={directDependencyCount(n.id, edges)}
                variant="compact"
                layoutId={cardLayoutId(n.id)}
                imageBust={imageBustByNodeId[n.id] ?? 0}
                exploreInteractive
                onClick={() => goTo(n.id)}
              />
            ))}
            {buckets.process.length === 0 ? (
              <p className="col-span-2 text-sm text-muted-foreground sm:col-span-4 lg:col-span-8">
                {t('builtUponEmpty')}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-elevated p-4 pt-0 shadow-inner">
          <div className="sticky top-0 z-10 -mx-4 mb-3 border-b border-border/60 bg-surface-elevated/95 px-4 pb-3 pt-3 backdrop-blur-sm rounded-t-xl">
            <div className="mb-[10px] text-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {t('builtUponMatters')}
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface px-2 py-2.5 lg:grid-cols-4">
              {MATERIAL_COLUMNS.map((col) => (
                <div
                  key={col}
                  className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs"
                >
                  {t(`builtUponLevel_${col}`)}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
            {MATERIAL_COLUMNS.map((col) => (
              <div
                key={col}
                className="grid grid-cols-2 gap-3 [align-content:start]"
              >
                {buckets.matters[col].map((n) => (
                  <InventionCard
                    key={n.id}
                    node={n}
                    directDeps={directDependencyCount(n.id, edges)}
                    variant="compact"
                    layoutId={cardLayoutId(n.id)}
                    imageBust={imageBustByNodeId[n.id] ?? 0}
                    exploreInteractive
                    onClick={() => goTo(n.id)}
                  />
                ))}
              </div>
            ))}
          </div>
          {MATERIAL_COLUMNS.every((c) => buckets.matters[c].length === 0) ? (
            <p className="py-2 text-sm text-muted-foreground">{t('ledToNoMatters')}</p>
          ) : null}
        </div>
        </div>

        <div
          id="explore-led-to-hero"
          className="flex scroll-mt-24 flex-col items-center gap-3 pb-2"
        >
          <InventionCard
            node={focusNode}
            directDeps={mainOut}
            variant="hero"
            layoutId={cardLayoutId(focusNode.id)}
            imageBust={imageBustByNodeId[focusNode.id] ?? 0}
          />
          <p className="rounded-full border border-border bg-surface-elevated px-4 py-1.5 text-sm text-muted-foreground">
            {t('ledToTotalCards', { count: totalDown })}
          </p>
        </div>
      </div>
    </LayoutGroup>
  );
}

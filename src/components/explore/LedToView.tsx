'use client';

import { useMemo } from 'react';
import { LayoutGroup } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { useUIStore } from '@/stores/ui-store';
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
  openDetail: (id: string) => void;
};

export function LedToView({ focusId, focusNode, goTo, openDetail }: Props) {
  const t = useTranslations('explore');
  const selectNode = useUIStore((s) => s.selectNode);

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

  return (
    <LayoutGroup id="led-to-cards">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-4 pt-2">
        <div className="rounded-xl bg-[#1a1a2e] p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/45">
            {t('builtUponTools')}
          </div>
          <div className="flex flex-wrap gap-3">
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
                onOpenDetail={() => openDetail(n.id)}
              />
            ))}
            {buckets.tools.length === 0 ? (
              <p className="text-sm text-white/40">{t('builtUponEmpty')}</p>
            ) : null}
          </div>
        </div>

        <div className="h-px w-full bg-white/10" />

        <div className="rounded-xl bg-[#1a1a2e] p-4">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/45">
            {t('builtUponProcess')}
          </div>
          <div className="flex flex-wrap gap-3">
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
                onOpenDetail={() => openDetail(n.id)}
              />
            ))}
            {buckets.process.length === 0 ? (
              <p className="text-sm text-white/40">{t('builtUponEmpty')}</p>
            ) : null}
          </div>
        </div>

        <div className="h-px w-full bg-white/10" />

        <div className="rounded-xl bg-[#1a1a2e] p-4 shadow-inner">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/45">
            {t('builtUponMatters')}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
            {MATERIAL_COLUMNS.map((col) => (
              <div key={col} className="flex flex-col gap-3">
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
                    onOpenDetail={() => openDetail(n.id)}
                  />
                ))}
              </div>
            ))}
          </div>
          {MATERIAL_COLUMNS.every((c) => buckets.matters[c].length === 0) ? (
            <p className="py-2 text-sm text-white/40">{t('ledToNoMatters')}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-lg bg-[#2a2a3e] px-2 py-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {MATERIAL_COLUMNS.map((col) => (
            <div
              key={col}
              className="text-center text-[10px] font-semibold uppercase tracking-wide text-white/75 sm:text-xs"
            >
              {t(`builtUponLevel_${col}`)}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3 pb-2">
          <InventionCard
            node={focusNode}
            directDeps={mainOut}
            variant="hero"
            layoutId={cardLayoutId(focusNode.id)}
            imageBust={imageBustByNodeId[focusNode.id] ?? 0}
            exploreInteractive
            onOpenDetail={() => openDetail(focusNode.id)}
          />
          <p className="rounded-full border border-white/15 bg-[#1a1a2e] px-4 py-1.5 text-sm text-white/80">
            {t('ledToTotalCards', { count: totalDown })}
          </p>
          <button
            type="button"
            onClick={() =>
              selectNode(focusId, { openSidebar: true, center: false })
            }
            className="text-sm text-[#7c9cff] underline-offset-2 hover:underline"
          >
            {t('builtUponOpenDetails')}
          </button>
        </div>
      </div>
    </LayoutGroup>
  );
}

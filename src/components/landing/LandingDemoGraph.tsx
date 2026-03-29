'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import nodesIndex from '@/data/nodes-index.json';
import { treeInventionPath } from '@/lib/tree-routes';
import type { TechNodeBasic } from '@/lib/types';

const DEMO_IDS = ['sable', 'verre', 'ampoule'] as const;

export function LandingDemoGraph() {
  const [phase, setPhase] = useState(0);

  const steps = useMemo(() => {
    const byId = new Map(
      nodesIndex.nodes.map((n) => [n.id, n as TechNodeBasic])
    );
    return DEMO_IDS.map((id) => byId.get(id)).filter(
      (n): n is TechNodeBasic => n != null
    );
  }, []);

  useEffect(() => {
    const delays = [400, 800, 1200, 1750, 2300];
    const timers = delays.map((ms, i) =>
      window.setTimeout(() => setPhase(i + 1), ms)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const visibleCount =
    phase === 0 ? 0 : phase >= 3 ? 3 : Math.min(phase, 3);
  const visibleLinks = phase >= 5 ? 2 : phase >= 4 ? 1 : 0;

  return (
    <div className="flex h-[min(420px,55vh)] w-full max-w-3xl flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-surface/90 p-6 shadow-lg dark:bg-page/90">
      <div className="flex flex-col items-center gap-2">
        {steps.slice(0, visibleCount).map((node, i) => (
          <div key={node.id} className="flex w-full flex-col items-center gap-2">
            <Link
              href={treeInventionPath(node.id)}
              className="group flex w-full max-w-xs flex-col items-center rounded-xl border border-border bg-surface-elevated p-4 shadow-md transition-transform hover:scale-[1.02] dark:border-white/10 dark:bg-[#1a1a2e]"
            >
              <div
                className="mb-2 flex h-16 w-16 items-center justify-center rounded-lg text-lg font-bold text-foreground/80"
                style={{
                  backgroundColor: `color-mix(in srgb, var(--accent) 15%, transparent)`,
                }}
              >
                {node.name.charAt(0)}
              </div>
              <span className="text-center text-sm font-medium text-foreground">
                {node.name}
              </span>
            </Link>
            {i < visibleCount - 1 && visibleLinks > i ? (
              <span className="text-xl text-muted-foreground" aria-hidden>
                ↓
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

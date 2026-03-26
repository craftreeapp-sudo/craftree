'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { getCategoryColor } from '@/lib/colors';
import {
  LANDING_DEMO_EDGES,
  LANDING_DEMO_LAYOUT,
  LANDING_DEMO_STAGGER_ORDER,
  type LandingDemoTreeNode,
} from '@/lib/landing-demo-tree';
import type { NodeCategory } from '@/lib/types';
import { useOnceInView } from '@/hooks/use-once-in-view';

const CARD_W = 60;
const CARD_H = 80;

function edgePath(
  a: { id: string; left: number; top: number },
  b: { id: string; left: number; top: number }
): string {
  const acy = a.top + CARD_H / 2;
  const bcy = b.top + CARD_H / 2;
  const ar = a.left + CARD_W;
  const al = a.left;
  const ab = a.top + CARD_H;
  const at = a.top;
  const acx = a.left + CARD_W / 2;
  const bcx = b.left + CARD_W / 2;
  const bt = b.top;

  if (a.id === 'feu' && b.id === 'four') {
    return `M ${ar} ${acy} L ${al} ${bcy}`;
  }
  if (a.id === 'four' && b.id === 'verre') {
    return `M ${acx} ${ab} L ${bcx} ${bt}`;
  }
  if (a.id === 'sable' && b.id === 'verre') {
    return `M ${ar} ${acy} L ${al} ${bcy}`;
  }
  if (a.id === 'verre' && b.id === 'lentille') {
    return `M ${ar} ${acy} L ${al} ${bcy}`;
  }
  if (a.id === 'lentille' && b.id === 'microscope') {
    return `M ${ar} ${acy} L ${al} ${bcy}`;
  }
  return `M ${acx} ${acy} L ${bcx} ${bcy}`;
}

function relationStroke(relation: 'material' | 'tool' | 'energy'): {
  stroke: string;
  strokeDasharray?: string;
} {
  switch (relation) {
    case 'material':
      return { stroke: '#14B8A6' };
    case 'tool':
      return { stroke: '#A78BFA', strokeDasharray: '3 3' };
    case 'energy':
      return { stroke: '#EF4444', strokeDasharray: '5 4' };
    default:
      return { stroke: '#14B8A6' };
  }
}

type Props = {
  nodes: LandingDemoTreeNode[];
};

export function LandingHowDemoTree({ nodes }: Props) {
  const t = useTranslations('landing');
  const { ref: sectionRef, isVisible } = useOnceInView(0.3);
  const [linksShown, setLinksShown] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, LandingDemoTreeNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const lastCardDoneMs =
    (LANDING_DEMO_STAGGER_ORDER.length - 1) * 150 + 300;

  useEffect(() => {
    if (!isVisible) return;
    const id = window.setTimeout(() => setLinksShown(true), lastCardDoneMs);
    return () => window.clearTimeout(id);
  }, [isVisible, lastCardDoneMs]);

  return (
    <div className="mx-auto mt-8 w-full max-w-[700px]" dir="ltr">
      <div
        ref={sectionRef}
        className="mx-auto w-full max-w-[700px] overflow-x-auto overflow-y-visible"
      >
        <div className="relative mx-auto h-[300px] w-[700px] min-w-[700px] max-w-[700px]">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            {LANDING_DEMO_EDGES.map((e) => {
              const from = LANDING_DEMO_LAYOUT[e.from];
              const to = LANDING_DEMO_LAYOUT[e.to];
              const { stroke, strokeDasharray } = relationStroke(e.relation);
              return (
                <path
                  key={`${e.from}-${e.to}`}
                  d={edgePath(
                    { id: e.from, ...from },
                    { id: e.to, ...to }
                  )}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={0.5}
                  strokeDasharray={strokeDasharray}
                  vectorEffect="non-scaling-stroke"
                  className="transition-opacity duration-[400ms]"
                  style={{
                    opacity: linksShown ? 1 : 0,
                  }}
                />
              );
            })}
          </svg>

          {LANDING_DEMO_STAGGER_ORDER.map((id, index) => {
            const node = byId.get(id);
            if (!node) return null;
            const pos = LANDING_DEMO_LAYOUT[id];
            const cat = node.category as NodeCategory;
            const color = getCategoryColor(cat);
            const delay = index * 150;

            return (
              <div
                key={id}
                className="absolute transition-[transform,opacity] duration-300 ease-out"
                style={{
                  left: pos.left,
                  top: pos.top,
                  width: CARD_W,
                  height: CARD_H,
                  transform: isVisible ? 'scale(1)' : 'scale(0.7)',
                  opacity: isVisible ? 1 : 0,
                  transitionDelay: `${delay}ms`,
                }}
              >
                <Link
                  href={`/explore?node=${encodeURIComponent(id)}`}
                  className="group relative flex h-full w-full flex-col items-center justify-center rounded-md bg-surface/90 px-1 text-center shadow-sm outline-none transition-[transform,border-color,border-width] duration-200 hover:z-10 hover:scale-105 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page"
                  style={
                    {
                      borderColor: hoverId === id ? color : '#2A3042',
                      borderWidth: hoverId === id ? 2 : 1,
                      borderStyle: 'solid',
                    } satisfies CSSProperties
                  }
                  onMouseEnter={() => setHoverId(id)}
                  onMouseLeave={() => setHoverId(null)}
                >
                  <span
                    className="line-clamp-3 text-[10px] font-medium leading-tight text-foreground"
                    style={{
                      fontFamily:
                        'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
                    }}
                  >
                    {node.name}
                  </span>
                  <span
                    className="pointer-events-none absolute left-1/2 top-full z-20 mt-1 hidden w-[200px] -translate-x-1/2 rounded border border-border bg-surface-elevated px-2 py-1.5 text-left text-[11px] leading-snug text-foreground/85 shadow-lg group-hover:block"
                    role="tooltip"
                  >
                    {node.description}
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
      <p
        className="mt-3 text-center text-[12px] text-muted-foreground"
        style={{ fontFamily: 'var(--font-inter), ui-sans-serif, system-ui' }}
      >
        {t('howDemoHint')}
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { CardImagePlaceholder } from '@/components/explore/CardImagePlaceholder';
import { getCategoryColor } from '@/lib/colors';
import type { NodeCategory } from '@/lib/types';

export type LandingFloatingNode = {
  id: string;
  name: string;
  category: string;
  image_url?: string;
};

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Placed = LandingFloatingNode & {
  leftPct: number;
  topPct: number;
  scale: number;
  rotDeg: number;
  dx: string;
  dy: string;
  durationSec: number;
  delaySec: number;
  key: string;
};

const CARD_COUNT_DESKTOP = 16;

export function LandingFloatingCards({ pool }: { pool: LandingFloatingNode[] }) {
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (pool.length === 0) return;
    const seed = Math.floor(Math.random() * 0x7fffffff);
    const rand = mulberry32(seed);
    const shuffled = [...pool].sort(() => rand() - 0.5);
    const seen = new Set<string>();
    const picked: LandingFloatingNode[] = [];
    for (const n of shuffled) {
      if (seen.has(n.id)) continue;
      seen.add(n.id);
      picked.push(n);
      if (picked.length >= CARD_COUNT_DESKTOP) break;
    }
    const next: Placed[] = picked.map((node, i) => {
      const leftPct = 6 + rand() * 88;
      const topPct = 4 + rand() * 82;
      const scale = 0.55 + rand() * 0.65;
      const rotDeg = (rand() - 0.5) * 12;
      const dx = `${(rand() - 0.5) * 28}px`;
      const dy = `${(rand() - 0.5) * 24}px`;
      const durationSec = 22 + rand() * 26;
      const delaySec = rand() * 8;
      return {
        ...node,
        leftPct,
        topPct,
        scale,
        rotDeg,
        dx,
        dy,
        durationSec,
        delaySec,
        key: `${node.id}-${i}`,
      };
    });
    queueMicrotask(() => setPlaced(next));
  }, [pool]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 14;
      const y = (e.clientY / window.innerHeight - 0.5) * 14;
      setParallax({ x, y });
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  if (placed.length === 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden md:block"
      aria-hidden
    >
      <div
        className="absolute inset-0 duration-500 ease-out will-change-transform motion-reduce:transform-none"
        style={{
          transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
        }}
      >
        {placed.map((c) => {
          const cat = c.category as NodeCategory;
          const color = getCategoryColor(cat);
          const url = c.image_url?.trim();
          const driftStyle = {
            left: `${c.leftPct}%`,
            top: `${c.topPct}%`,
            animationDuration: `${c.durationSec}s`,
            animationDelay: `${c.delaySec}s`,
            '--landing-sc': String(c.scale),
            '--landing-rot': `${c.rotDeg}deg`,
            '--landing-dx': c.dx,
            '--landing-dy': c.dy,
          } as CSSProperties;

          return (
            <div
              key={c.key}
              className="landing-float-card absolute opacity-[0.38] motion-reduce:animate-none"
              style={driftStyle}
            >
              <div className="w-[88px] overflow-hidden rounded-lg border border-white/10 bg-[#0a0a12] shadow-lg sm:w-[104px]">
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    className="h-[52px] w-full object-cover sm:h-[60px]"
                  />
                ) : (
                  <CardImagePlaceholder
                    categoryColor={color}
                    variant="compact"
                  />
                )}
                <div className="line-clamp-2 px-1.5 py-1 text-center text-[9px] font-medium leading-tight text-white/50">
                  {c.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

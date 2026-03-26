'use client';

import { motion } from 'framer-motion';

/** Fragment décoratif : nœuds et liens factices, pulsation douce */
const NODES = [
  { x: '8%', y: '22%', size: 44, delay: 0 },
  { x: '78%', y: '18%', size: 36, delay: 0.3 },
  { x: '18%', y: '58%', size: 52, delay: 0.15 },
  { x: '62%', y: '48%', size: 40, delay: 0.45 },
  { x: '42%', y: '72%', size: 48, delay: 0.2 },
  { x: '88%', y: '68%', size: 32, delay: 0.5 },
];

const EDGES = [
  { x1: '10%', y1: '24%', x2: '40%', y2: '70%', delay: 0.1 },
  { x1: '22%', y1: '58%', x2: '60%', y2: '50%', delay: 0.25 },
  { x1: '65%', y1: '50%', x2: '80%', y2: '22%', delay: 0.35 },
];

export function HeroGraphBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <svg
        className="absolute inset-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="hero-edge" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {EDGES.map((e, i) => (
          <motion.line
            key={i}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke="url(#hero-edge)"
            strokeWidth={1.5}
            initial={{ opacity: 0.12 }}
            animate={{
              opacity: [0.12, 0.38, 0.12],
            }}
            transition={{
              duration: 4.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: e.delay,
            }}
          />
        ))}
      </svg>

      {NODES.map((n, i) => (
        <motion.div
          key={i}
          className="absolute rounded-xl border border-border/60 bg-surface-elevated/40 shadow-[0_0_24px_rgba(59,130,246,0.12)]"
          style={{
            left: n.x,
            top: n.y,
            width: n.size,
            height: n.size * 0.45,
            marginLeft: -n.size / 2,
            marginTop: (-n.size * 0.45) / 2,
          }}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{
            opacity: [0.12, 0.28, 0.12],
            scale: [1, 1.03, 1],
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: n.delay,
          }}
        />
      ))}
    </div>
  );
}

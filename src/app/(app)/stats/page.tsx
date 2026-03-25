'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useGraphStore } from '@/stores/graph-store';
import { computeStatsInsights } from '@/lib/stats-insights';
import { getCategoryColor } from '@/lib/colors';
import type { Era, NodeCategory } from '@/lib/types';
import type { CategoryCount } from '@/lib/stats-insights';

const ERA_LABELS: Record<Era, string> = {
  prehistoric: 'Préhistorique',
  ancient: 'Antiquité',
  medieval: 'Moyen Âge',
  renaissance: 'Renaissance',
  industrial: 'Industriel',
  modern: 'Moderne',
  digital: 'Numérique',
  contemporary: 'Contemporain',
};

/** Progression visuelle du temps (barres ère) */
const ERA_BAR_COLORS: Record<Era, string> = {
  prehistoric: '#475569',
  ancient: '#64748B',
  medieval: '#7C3AED',
  renaissance: '#B45309',
  industrial: '#DC2626',
  modern: '#0D9488',
  digital: '#2563EB',
  contemporary: '#10B981',
};

function formatCategoryLabel(c: NodeCategory): string {
  return String(c).replace(/_/g, ' ');
}

function CategoryDonut({ rows, total }: { rows: CategoryCount[]; total: number }) {
  const gradient = useMemo(() => {
    if (total <= 0 || rows.length === 0) return 'conic-gradient(#2A3042 0deg 360deg)';
    let angle = 0;
    const parts: string[] = [];
    for (const r of rows) {
      const deg = (r.count / total) * 360;
      const c = getCategoryColor(r.category);
      const a0 = angle;
      const a1 = angle + deg;
      parts.push(`${c} ${a0}deg ${a1}deg`);
      angle = a1;
    }
    return `conic-gradient(${parts.join(', ')})`;
  }, [rows, total]);

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
      <div
        className="relative h-44 w-44 shrink-0 rounded-full shadow-inner ring-1 ring-[#2A3042]/80"
        style={{ background: gradient }}
        role="img"
        aria-label="Répartition par catégorie"
      >
        <div className="absolute inset-[26%] rounded-full bg-[#1A1F2E] ring-1 ring-[#2A3042]/60" />
      </div>
      <ul className="grid max-h-64 w-full max-w-md gap-2 overflow-y-auto text-sm sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.category} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/15"
              style={{ backgroundColor: getCategoryColor(r.category) }}
            />
            <span className="min-w-0 flex-1 truncate capitalize text-[#E8ECF4]">
              {formatCategoryLabel(r.category)}
            </span>
            <span className="tabular-nums text-[#8B95A8]">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HorizontalBarRow({
  label,
  value,
  max,
  color,
  sub,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  sub?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm text-[#E8ECF4]" title={label}>
          {label}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-[#8B95A8]">
          {value}
          {sub ? <span className="text-[#8B95A8]/80"> {sub}</span> : null}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#111827]">
        <div
          className="h-full min-w-[2px] rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            boxShadow: `0 0 12px ${color}44`,
          }}
        />
      </div>
    </div>
  );
}

export default function StatsPage() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);

  const stats = useMemo(
    () => computeStatsInsights(nodes, edges),
    [nodes, edges]
  );

  const catTotal = stats.categoryRows.reduce((s, r) => s + r.count, 0);

  return (
    <main className="mx-auto min-h-[calc(100dvh-3.5rem)] w-full max-w-6xl flex-1 px-3 pb-12 pt-20 md:px-4 md:pb-16">
      <header className="mb-6 md:mb-10">
        <h1
          className="text-2xl font-semibold tracking-tight text-[#E8ECF4] sm:text-3xl"
          style={{
            fontFamily: 'var(--font-space-grotesk), Space Grotesk, system-ui, sans-serif',
          }}
        >
          Statistiques
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#8B95A8]">
          Aperçu du Tree de fabrication : matières premières les plus « critiques »,
          technologies les plus complexes, et répartition des nœuds.
        </p>
      </header>

      {stats.highlight ? (
        <section
          className="mb-10 rounded-xl border border-[#3B82F6]/35 bg-[#3B82F6]/[0.07] p-5 shadow-lg"
          aria-label="Fait marquant"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-[#3B82F6]">
            Fait marquant
          </p>
          <p className="mt-3 text-base leading-relaxed text-[#E8ECF4]">
            <span className="font-medium text-[#E8ECF4]">{stats.highlight.name}</span>{' '}
            s’appuie sur{' '}
            <strong className="text-[#3B82F6]">
              {stats.highlight.rawMaterialCount}
            </strong>{' '}
            matières premières distinctes et compte{' '}
            <strong className="text-[#3B82F6]">
              {stats.highlight.dependencyLevels}
            </strong>{' '}
            niveaux de dépendance
            {stats.highlight.upstreamNodeCount > 0 ? (
              <>
                {' '}
                ({stats.highlight.upstreamNodeCount} nœuds dans la chaîne amont)
              </>
            ) : null}
            .
          </p>
          <Link
            href={`/tree/${stats.highlight.nodeId}`}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#3B82F6]/50 bg-[#3B82F6]/15 px-4 py-2 text-sm font-medium text-[#3B82F6] transition-colors hover:bg-[#3B82F6]/25"
          >
            Voir l’arbre de dépendances
            <span aria-hidden>→</span>
          </Link>
        </section>
      ) : null}

      <div className="grid w-full gap-4 md:gap-6 lg:grid-cols-2">
        <section
          className="w-full rounded-xl border border-[#2A3042] bg-[#1A1F2E] p-4 shadow-xl md:p-5"
          aria-labelledby="stats-raw-title"
        >
          <h2
            id="stats-raw-title"
            className="text-sm font-semibold uppercase tracking-wider text-[#8B95A8]"
          >
            Top 10 — matières premières critiques
          </h2>
          <p className="mt-1 text-xs text-[#8B95A8]/90">
            Classées par centralité (nombre de technologies en aval dans le Tree).
          </p>
          <div className="mt-5 space-y-4">
            {stats.topRaw.map((r) => (
              <HorizontalBarRow
                key={r.id}
                label={r.name}
                value={r.score}
                max={stats.maxCentRaw}
                color={getCategoryColor(r.category)}
                sub="tech. en aval"
              />
            ))}
          </div>
        </section>

        <section
          className="w-full rounded-xl border border-[#2A3042] bg-[#1A1F2E] p-4 shadow-xl md:p-5"
          aria-labelledby="stats-complex-title"
        >
          <h2
            id="stats-complex-title"
            className="text-sm font-semibold uppercase tracking-wider text-[#8B95A8]"
          >
            Top 10 — technologies les plus complexes
          </h2>
          <p className="mt-1 text-xs text-[#8B95A8]/90">
            Classées par profondeur de dépendance (chemins vers les matières premières).
          </p>
          <div className="mt-5 space-y-4">
            {stats.topComplex.map((t) => (
              <HorizontalBarRow
                key={t.id}
                label={t.name}
                value={t.complexity_depth}
                max={stats.maxComplex}
                color={getCategoryColor(t.category)}
                sub="niveaux"
              />
            ))}
          </div>
        </section>

        <section
          className="w-full rounded-xl border border-[#2A3042] bg-[#1A1F2E] p-4 shadow-xl md:p-5 lg:col-span-2"
          aria-labelledby="stats-cat-title"
        >
          <h2
            id="stats-cat-title"
            className="text-sm font-semibold uppercase tracking-wider text-[#8B95A8]"
          >
            Répartition par catégorie
          </h2>
          <p className="mt-1 text-xs text-[#8B95A8]/90">
            {stats.totalNodes} technologies et ressources au total.
          </p>
          <div className="mt-8">
            <CategoryDonut rows={stats.categoryRows} total={catTotal} />
          </div>
        </section>

        <section
          className="w-full rounded-xl border border-[#2A3042] bg-[#1A1F2E] p-4 shadow-xl md:p-5 lg:col-span-2"
          aria-labelledby="stats-era-title"
        >
          <h2
            id="stats-era-title"
            className="text-sm font-semibold uppercase tracking-wider text-[#8B95A8]"
          >
            Répartition par époque
          </h2>
          <p className="mt-1 text-xs text-[#8B95A8]/90">
            Nombre de nœuds par ère (métadonnée du modèle).
          </p>
          <div className="mt-6 space-y-3">
            {stats.eraRows.map((r) => (
              <HorizontalBarRow
                key={r.era}
                label={ERA_LABELS[r.era] ?? r.era}
                value={r.count}
                max={stats.maxEra}
                color={ERA_BAR_COLORS[r.era] ?? '#64748B'}
                sub="nœuds"
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

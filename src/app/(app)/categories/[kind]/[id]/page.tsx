import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TechListByFilterClient } from '@/components/categories/TechListByFilterClient';
import { validateFilterParams } from '@/lib/category-filter-routes';
import {
  ERA_LABELS_FR,
  NODE_CATEGORY_LABELS_FR,
  TECH_NODE_TYPE_LABELS_FR,
} from '@/lib/node-labels';
import { Era, NodeCategory } from '@/lib/types';
import type { TechNodeType } from '@/lib/types';

type PageProps = {
  params: Promise<{ kind: string; id: string }>;
};

function pageTitle(kind: string, id: string): string {
  if (kind === 'category') {
    return NODE_CATEGORY_LABELS_FR[id as NodeCategory];
  }
  if (kind === 'era') {
    return ERA_LABELS_FR[id as Era];
  }
  return TECH_NODE_TYPE_LABELS_FR[id as TechNodeType];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { kind, id } = await params;
  const v = validateFilterParams(kind, id);
  if (!v.ok) {
    return { title: 'Catégories — Craftree' };
  }
  const label = pageTitle(v.kind, v.id);
  return {
    title: { absolute: `Technologies — ${label} — Craftree` },
    description: `Liste des technologies « ${label} » dans Craftree.`,
  };
}

export default async function CategoryFilterTechListPage({ params }: PageProps) {
  const { kind, id } = await params;
  const v = validateFilterParams(kind, id);
  if (!v.ok) notFound();

  const label = pageTitle(v.kind, v.id);
  const title = `Technologies — ${label}`;
  const subtitle =
    v.kind === 'category'
      ? 'Toutes les entrées du Tree dans cette catégorie.'
      : v.kind === 'era'
        ? 'Toutes les technologies rattachées à cette époque.'
        : 'Tous les nœuds de ce type dans le Tree.';

  return (
    <TechListByFilterClient
      kind={v.kind}
      id={v.id}
      title={title}
      subtitle={subtitle}
    />
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { TechListByFilterClient } from '@/components/categories/TechListByFilterClient';
import {
  EDITOR_DIM_KEY,
  EDITOR_LEVEL_KEY,
} from '@/components/editor/dimension-editor-keys';
import { validateFilterParams } from '@/lib/category-filter-routes';
import {
  DIMENSION_LABELS_FR,
  ERA_LABELS_FR,
  MATERIAL_LEVEL_LABELS_FR,
  NODE_CATEGORY_LABELS_FR,
} from '@/lib/node-labels';
import {
  Era,
  MaterialLevel,
  NodeCategory,
  NodeDimension,
} from '@/lib/types';

type PageProps = {
  params: Promise<{ kind: string; id: string }>;
};

function fallbackLabel(kind: string, id: string): string {
  if (kind === 'category') {
    return NODE_CATEGORY_LABELS_FR[id as NodeCategory] ?? id;
  }
  if (kind === 'era') {
    return ERA_LABELS_FR[id as Era] ?? id;
  }
  if (kind === 'dimension') {
    return DIMENSION_LABELS_FR[id as NodeDimension] ?? id;
  }
  return MATERIAL_LEVEL_LABELS_FR[id as MaterialLevel] ?? id;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { kind, id } = await params;
  const v = validateFilterParams(kind, id);
  const t = await getTranslations('categoriesPage');
  if (!v.ok) {
    return { title: t('metaTitle') };
  }
  const tCat = await getTranslations('categories');
  const tEra = await getTranslations('eras');
  const te = await getTranslations('editor');
  let label: string;
  if (v.kind === 'category') {
    label = tCat.has(v.id) ? tCat(v.id) : fallbackLabel('category', v.id);
  } else if (v.kind === 'era') {
    label = tEra.has(v.id) ? tEra(v.id) : fallbackLabel('era', v.id);
  } else if (v.kind === 'dimension') {
    const k = EDITOR_DIM_KEY[v.id as NodeDimension];
    label = k && te.has(k) ? te(k) : fallbackLabel('dimension', v.id);
  } else {
    const k = EDITOR_LEVEL_KEY[v.id as MaterialLevel];
    label = k && te.has(k) ? te(k) : fallbackLabel('materialLevel', v.id);
  }
  return {
    title: { absolute: `${t('listPageTitle', { label })} — Craftree` },
    description: t('metaDescriptionList', { label }),
  };
}

export default async function CategoryFilterTechListPage({ params }: PageProps) {
  const { kind, id } = await params;
  const v = validateFilterParams(kind, id);
  if (!v.ok) notFound();

  return <TechListByFilterClient kind={v.kind} id={v.id} />;
}

'use client';

import { useTranslations } from 'next-intl';
import type {
  CraftingLink,
  NodeCategory,
  TechNodeBasic,
  TechNodeDetails,
} from '@/lib/types';
import { RelationType } from '@/lib/types';
import { getCategoryColor } from '@/lib/colors';
import { pickNodeDisplayName } from '@/lib/node-display-name';

const RELATION_DOT: Record<RelationType, string> = {
  material: '#94A3B8',
  tool: '#A78BFA',
  energy: '#EF4444',
  knowledge: '#38BDF8',
  catalyst: 'rgba(139, 149, 168, 0.5)',
};

export function ExploreLedToRow({
  link,
  product,
  onSelectProduct,
  locale,
  detailsById,
}: {
  link: CraftingLink;
  product: TechNodeBasic;
  onSelectProduct: (id: string) => void;
  locale: string;
  detailsById: Record<string, TechNodeDetails | undefined>;
}) {
  const tRel = useTranslations('relationTypes');
  const tEx = useTranslations('explore');
  const rel = link.relation_type as RelationType;
  const dotColor =
    rel === 'material'
      ? getCategoryColor(product.category as NodeCategory)
      : RELATION_DOT[rel];
  const relLabel = tRel(rel);

  return (
    <li className="flex gap-3 rounded-md border border-border/80 bg-surface/40 px-2 py-2">
      <span
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
        style={{
          backgroundColor: dotColor,
          opacity: rel === 'catalyst' ? 0.6 : 1,
        }}
        title={relLabel}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => onSelectProduct(product.id)}
          className="text-start text-sm font-medium text-accent hover:underline"
        >
          {pickNodeDisplayName(
            locale,
            product.name,
            detailsById[product.id]?.name_en
          )}
        </button>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {relLabel}
          {link.is_optional ? ` · ${tEx('optional')}` : ''}
        </p>
        {link.notes ? (
          <p className="mt-1 text-xs italic text-muted-foreground/80">{link.notes}</p>
        ) : null}
      </div>
    </li>
  );
}

export function ExploreRecipeRow({
  link,
  getNodeById,
  onSelectIngredient,
  locale,
  detailsById,
}: {
  link: CraftingLink;
  getNodeById: (id: string) => TechNodeBasic | undefined;
  onSelectIngredient: (id: string) => void;
  locale: string;
  detailsById: Record<string, TechNodeDetails | undefined>;
}) {
  const tRel = useTranslations('relationTypes');
  const tEx = useTranslations('explore');
  const input = getNodeById(link.source_id);
  const rel = link.relation_type as RelationType;
  const dotColor =
    rel === 'material' && input
      ? getCategoryColor(input.category as NodeCategory)
      : RELATION_DOT[rel];
  const relLabel = tRel(rel);

  return (
    <li className="flex gap-3 rounded-md border border-border/80 bg-surface/40 px-2 py-2">
      <span
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/10"
        style={{
          backgroundColor: dotColor,
          opacity: rel === 'catalyst' ? 0.6 : 1,
        }}
        title={relLabel}
      />
      <div className="min-w-0 flex-1">
        {input ? (
          <button
            type="button"
            onClick={() => onSelectIngredient(input.id)}
            className="text-start text-sm font-medium text-accent hover:underline"
          >
            {pickNodeDisplayName(
              locale,
              input.name,
              detailsById[input.id]?.name_en
            )}
          </button>
        ) : (
          <span className="text-sm text-foreground">{link.source_id}</span>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {relLabel}
          {link.is_optional ? ` · ${tEx('optional')}` : ''}
        </p>
        {link.notes && (
          <p className="mt-1 text-xs italic text-muted-foreground/80">{link.notes}</p>
        )}
      </div>
    </li>
  );
}

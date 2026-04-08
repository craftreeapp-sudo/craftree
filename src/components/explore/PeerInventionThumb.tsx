'use client';

import { CardImagePlaceholder } from '@/components/explore/CardImagePlaceholder';
import { getCategoryColor } from '@/lib/colors';
import type { NodeCategory } from '@/lib/types';

type Props = {
  category: NodeCategory;
  /** `image_url` du nœud graphe ou des détails chargés */
  imageUrl?: string | null;
  imageBust?: number;
};

/**
 * Vignette carrée (liste liens) : image invention ou pastille catégorie.
 */
export function PeerInventionThumb({
  category,
  imageUrl,
  imageBust = 0,
}: Props) {
  const catColor = getCategoryColor(category);
  const raw = imageUrl?.trim();
  const busted =
    raw && imageBust > 0
      ? `${raw}${raw.includes('?') ? '&' : '?'}t=${imageBust}`
      : raw;

  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/60 bg-page">
      {busted ? (
        // eslint-disable-next-line @next/next/no-img-element -- URLs externes / uploads variés
        <img
          src={busted}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <CardImagePlaceholder
          categoryColor={catColor}
          className="h-full w-full min-h-0 rounded-none"
        />
      )}
    </div>
  );
}

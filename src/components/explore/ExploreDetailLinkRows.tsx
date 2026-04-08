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
import { normalizeRelationTypeForUi } from '@/lib/relation-display';
import {
  type InventionKindKey,
  inventionKindFromLinkAndPeer,
  relationTypeFromInventionKind,
} from '@/lib/invention-classification';
import { PeerInventionThumb } from '@/components/explore/PeerInventionThumb';
import type { ExtendedPeerInfo } from '@/lib/built-upon-utils';

/** Notes internes « AI: … » (revue auto) : non affichées sur la fiche (évite doublon / bruit). */
function peerLinkNotesForExploreFiche(
  notes: string | null | undefined
): string | null {
  const t = notes?.trim();
  if (!t) return null;
  if (t.toLowerCase().startsWith('ai:')) return null;
  return t;
}

const RELATION_DOT: Record<RelationType, string> = {
  [RelationType.MATERIAL]: '#94A3B8',
  [RelationType.COMPONENT]: '#EAB308',
  [RelationType.TOOL]: '#A78BFA',
  [RelationType.ENERGY]: '#EF4444',
  [RelationType.PROCESS]: '#38BDF8',
  [RelationType.INFRASTRUCTURE]: '#64748B',
};

function dotForInventionKind(kind: InventionKindKey, peerCat: NodeCategory) {
  if (
    kind === 'matter_raw' ||
    kind === 'matter_processed' ||
    kind === 'matter_industrial'
  ) {
    return getCategoryColor(peerCat);
  }
  return RELATION_DOT[relationTypeFromInventionKind(kind)];
}

export function ExploreLedToRow({
  link,
  product,
  onSelectProduct,
  locale,
  detailsById,
  imageBust = 0,
}: {
  link: CraftingLink;
  product: TechNodeBasic;
  onSelectProduct: (id: string) => void;
  locale: string;
  detailsById: Record<string, TechNodeDetails | undefined>;
  /** Cache-bust image (graph store), défaut 0 */
  imageBust?: number;
}) {
  const tInv = useTranslations('inventionKinds');
  const rel = normalizeRelationTypeForUi(String(link.relation_type));
  const kind = inventionKindFromLinkAndPeer(rel, product);
  const dotColor = dotForInventionKind(kind, product.category as NodeCategory);
  const relLabel = tInv(kind);
  const peerImageUrl =
    product.image_url?.trim() ?? detailsById[product.id]?.image_url?.trim() ?? null;
  const ficheNotes = peerLinkNotesForExploreFiche(link.notes);

  return (
    <li className="flex items-center gap-2.5 rounded-md border border-border/80 bg-surface/40 px-2 py-2">
      <PeerInventionThumb
        category={product.category as NodeCategory}
        imageUrl={peerImageUrl}
        imageBust={imageBust}
      />
      <span
        className="mt-0.5 h-2.5 w-2.5 shrink-0 self-start rounded-full ring-2 ring-white/10"
        style={{
          backgroundColor: dotColor,
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
        <p className="mt-0.5 text-xs text-muted-foreground">{relLabel}</p>
        {ficheNotes ? (
          <p className="mt-1 text-xs italic text-muted-foreground/80">{ficheNotes}</p>
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
  imageBust = 0,
}: {
  link: CraftingLink;
  getNodeById: (id: string) => TechNodeBasic | undefined;
  onSelectIngredient: (id: string) => void;
  locale: string;
  detailsById: Record<string, TechNodeDetails | undefined>;
  imageBust?: number;
}) {
  const tInv = useTranslations('inventionKinds');
  const input = getNodeById(link.source_id);
  const rel = normalizeRelationTypeForUi(String(link.relation_type));
  const kind = input
    ? inventionKindFromLinkAndPeer(rel, input)
    : inventionKindFromLinkAndPeer(rel, undefined);
  const dotColor = input
    ? dotForInventionKind(kind, input.category as NodeCategory)
    : RELATION_DOT[relationTypeFromInventionKind(kind)];
  const relLabel = tInv(kind);
  const peerImageUrl = input
    ? input.image_url?.trim() ??
      detailsById[input.id]?.image_url?.trim() ??
      null
    : null;
  const ficheNotes = peerLinkNotesForExploreFiche(link.notes);

  return (
    <li className="flex items-center gap-2.5 rounded-md border border-border/80 bg-surface/40 px-2 py-2">
      {input ? (
        <PeerInventionThumb
          category={input.category as NodeCategory}
          imageUrl={peerImageUrl}
          imageBust={imageBust}
        />
      ) : (
        <div
          className="h-12 w-12 shrink-0 rounded-md border border-border/40 bg-muted/20"
          aria-hidden
        />
      )}
      <span
        className="mt-0.5 h-2.5 w-2.5 shrink-0 self-start rounded-full ring-2 ring-white/10"
        style={{
          backgroundColor: dotColor,
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
        <p className="mt-0.5 text-xs text-muted-foreground">{relLabel}</p>
        {ficheNotes ? (
          <p className="mt-1 text-xs italic text-muted-foreground/80">{ficheNotes}</p>
        ) : null}
      </div>
    </li>
  );
}

/** Lien de voisinage étendu (niveau 2) — pas d’arête directe ; ligne « via … ». */
export function ExploreExtendedPeerRow({
  info,
  getNodeById,
  onSelectPeer,
  locale,
  detailsById,
  imageBust = 0,
}: {
  info: ExtendedPeerInfo;
  getNodeById: (id: string) => TechNodeBasic | undefined;
  onSelectPeer: (id: string) => void;
  locale: string;
  detailsById: Record<string, TechNodeDetails | undefined>;
  imageBust?: number;
}) {
  const tEx = useTranslations('explore');
  const peer = getNodeById(info.peerId);
  const viaNames = info.viaNodeIds.map((id) => {
    const n = getNodeById(id);
    return n
      ? pickNodeDisplayName(locale, n.name, detailsById[id]?.name_en)
      : id;
  });
  const viaText = viaNames.join(', ');
  const peerImageUrl = peer
    ? peer.image_url?.trim() ??
      detailsById[peer.id]?.image_url?.trim() ??
      null
    : null;

  return (
    <li className="flex items-center gap-2.5 rounded-md border-2 border-dashed border-white/70 bg-surface/25 px-2 py-2">
      {peer ? (
        <PeerInventionThumb
          category={peer.category as NodeCategory}
          imageUrl={peerImageUrl}
          imageBust={imageBust}
        />
      ) : (
        <div
          className="h-12 w-12 shrink-0 rounded-md border border-border/40 bg-muted/20"
          aria-hidden
        />
      )}
      <span
        className="mt-0.5 h-2.5 w-2.5 shrink-0 self-start rounded-full ring-2 ring-white/10"
        style={{ backgroundColor: '#64748B' }}
        title={tEx('linkNeighborhoodExtended')}
      />
      <div className="min-w-0 flex-1">
        {peer ? (
          <button
            type="button"
            onClick={() => onSelectPeer(peer.id)}
            className="text-start text-sm font-medium text-accent hover:underline"
          >
            {pickNodeDisplayName(
              locale,
              peer.name,
              detailsById[peer.id]?.name_en
            )}
          </button>
        ) : (
          <span className="text-sm text-foreground">{info.peerId}</span>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {tEx('linkNeighborhoodVia', { names: viaText })}
        </p>
      </div>
    </li>
  );
}

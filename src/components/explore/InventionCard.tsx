'use client';

import { useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { getCategoryColor, hexToRgba } from '@/lib/colors';
import { formatYear } from '@/lib/utils';
import type { NodeCategory, TechNodeBasic } from '@/lib/types';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { CardImagePlaceholder } from '@/components/explore/CardImagePlaceholder';
import { treeLayerDisplayIndexFromNode } from '@/lib/tree-layers';

const HOVER_DELAY_MS = 300;

type Props = {
  node: TechNodeBasic;
  variant: 'hero' | 'compact';
  /** Navigation (clic) — ignoré si `href` est défini (préférer `href` pour le SEO) */
  onClick?: () => void;
  /** Lien canonique vers `/tree/[id]` (balise `<a>` pour les moteurs) */
  href?: string;
  /** Mode explore : survol + panneau latéral */
  exploreInteractive?: boolean;
  layoutId?: string;
  imageBust?: number;
  className?: string;
};

export function InventionCard({
  node,
  variant,
  onClick,
  href,
  exploreInteractive,
  layoutId,
  imageBust = 0,
  className = '',
}: Props) {
  const locale = useLocale();
  const tCat = useTranslations('categories');
  const tExplore = useTranslations('explore');
  const ctx = useExploreCardOptional();

  const displayName = pickNodeDisplayName(
    locale,
    node.name,
    node.name_en
  );

  const rootRef = useRef<HTMLDivElement | HTMLAnchorElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const isHero = variant === 'hero';
  const url = node.image_url?.trim();
  const busted =
    url && imageBust > 0
      ? `${url}${url.includes('?') ? '&' : '?'}t=${imageBust}`
      : url;

  const cat = node.category as NodeCategory;
  const catColor = getCategoryColor(cat);
  const layerDisplay = treeLayerDisplayIndexFromNode(node);

  const canHover =
    !isHero &&
    exploreInteractive === true &&
    Boolean(ctx) &&
    ctx!.suppressHover === false &&
    ctx!.isMobile === false;

  const clearHoverTimer = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = undefined;
    }
  }, []);

  const scheduleHover = useCallback(() => {
    if (!canHover || !ctx) return;
    ctx.cancelHoverClose();
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      const el = rootRef.current;
      if (!el) return;
      ctx.setHoverPreview({
        nodeId: node.id,
        rect: el.getBoundingClientRect(),
        anchorEl: el,
      });
    }, HOVER_DELAY_MS);
  }, [canHover, ctx, clearHoverTimer, node.id]);

  const endHover = useCallback(() => {
    clearHoverTimer();
    if (ctx?.hoverPreview?.nodeId === node.id) {
      ctx.requestHoverClose();
    }
  }, [clearHoverTimer, ctx, node.id]);

  const handleCardClick = useCallback(() => {
    onClick?.();
  }, [onClick]);

  const imageAspect = 'aspect-[4/3]';

  const imageBlock = (
    <div
      className={`relative w-full shrink-0 overflow-hidden bg-page ${imageAspect}`}
    >
      {busted ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={busted}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <CardImagePlaceholder categoryColor={catColor} className="h-full w-full" />
      )}
    </div>
  );

  const textBlock = (
    <div className="flex w-full min-w-0 flex-col gap-2.5 border-t border-border bg-surface-elevated px-3.5 py-3 sm:px-4 sm:py-3.5">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 sm:gap-x-2">
        <h3
          className="min-h-[2.625rem] min-w-0 line-clamp-2 text-sm font-bold leading-snug text-foreground"
          title={displayName}
        >
          {displayName}
        </h3>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 text-xs font-semibold tabular-nums text-foreground"
          style={{
            borderColor: catColor,
            backgroundColor: hexToRgba(catColor, 0.12),
          }}
          title={tExplore('layerShort', { layer: layerDisplay })}
        >
          {layerDisplay}
        </span>
      </div>
      <span className="w-fit rounded-full bg-border/20 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
        {formatYear(node.year_approx ?? null)}
      </span>
      <span
        className="w-fit max-w-full rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
        style={{ backgroundColor: hexToRgba(catColor, 0.42) }}
      >
        {safeCategoryLabel(tCat, cat)}
      </span>
    </div>
  );

  const inner = (
    <div className="flex min-h-0 flex-col">
      {imageBlock}
      {textBlock}
    </div>
  );

  const isInteractive = !isHero && (!!href || !!onClick);
  /** Pas de scale au survol si aperçu latéral : le transform déplace les bords sous le curseur et peut provoquer pointerleave/enter en boucle. */
  const scaleHoverClass =
    isInteractive && !canHover ? 'hover:scale-[1.02] active:scale-[0.99]' : '';
  const cardClass = `relative flex flex-col overflow-hidden rounded-xl glass-card transition-[border-color,transform,box-shadow] duration-200 hover:border-[var(--card-cat)] hover:shadow-lg ${scaleHoverClass} ${isHero ? 'w-full max-w-[min(100%,23rem)] sm:max-w-[min(100%,27rem)]' : 'w-full min-w-0'} ${isInteractive ? 'cursor-pointer' : ''} ${className}`;

  const clickProps =
    !href && exploreInteractive && onClick
      ? {
          onClick: handleCardClick,
          role: 'button' as const,
          tabIndex: 0,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          },
        }
      : !href && !exploreInteractive && onClick
        ? {
            onClick,
            role: 'button' as const,
            tabIndex: 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            },
          }
        : {};

  const hoverPointerHandlers = canHover
    ? {
        onPointerEnter: scheduleHover,
        onPointerLeave: endHover,
      }
    : {};

  const style = { '--card-cat': catColor } as React.CSSProperties;

  if (href) {
    const linkEl = (
      <Link
        ref={rootRef as React.Ref<HTMLAnchorElement>}
        href={href}
        scroll={false}
        className={cardClass}
        style={style}
        onClick={onClick}
        {...hoverPointerHandlers}
      >
        {inner}
      </Link>
    );

    if (layoutId) {
      return (
        <motion.div
          layout
          layoutId={layoutId}
          className="w-full min-w-0"
        >
          {linkEl}
        </motion.div>
      );
    }
    return linkEl;
  }

  const commonDivProps = {
    ref: rootRef as React.Ref<HTMLDivElement>,
    className: cardClass,
    style,
    ...clickProps,
    ...hoverPointerHandlers,
  };

  const body = inner;

  if (layoutId) {
    return (
      <motion.div
        layout
        layoutId={layoutId}
        {...commonDivProps}
      >
        {body}
      </motion.div>
    );
  }

  return (
    <div {...commonDivProps}>
      {body}
    </div>
  );
}

'use client';

import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { getCategoryColor, hexToRgba } from '@/lib/colors';
import { formatYear } from '@/lib/utils';
import type { NodeCategory, TechNodeBasic } from '@/lib/types';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { safeCategoryLabel } from '@/lib/safe-category-label';

const HOVER_DELAY_MS = 300;

type Props = {
  node: TechNodeBasic;
  directDeps: number;
  variant: 'hero' | 'compact';
  /** Navigation (clic sur la carte) */
  onClick?: () => void;
  /** Mode explore : survol + panneau latéral */
  exploreInteractive?: boolean;
  layoutId?: string;
  imageBust?: number;
  className?: string;
};

export function InventionCard({
  node,
  directDeps,
  variant,
  onClick,
  exploreInteractive,
  layoutId,
  imageBust = 0,
  className = '',
}: Props) {
  const locale = useLocale();
  const tCat = useTranslations('categories');
  const tTypes = useTranslations('types');
  const tExplore = useTranslations('explore');
  const ctx = useExploreCardOptional();

  const displayName = pickNodeDisplayName(
    locale,
    node.name,
    node.name_en
  );

  const rootRef = useRef<HTMLDivElement>(null);
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
        <div
          className="flex h-full w-full items-center justify-center text-2xl font-bold text-muted-foreground/60 sm:text-3xl"
          style={{ backgroundColor: hexToRgba(catColor, 0.22) }}
          aria-hidden
        >
          {displayName.trim().charAt(0).toUpperCase() || '?'}
        </div>
      )}
    </div>
  );

  const textBlock = (
    <div className="flex w-full min-w-0 flex-col gap-2.5 border-t border-border bg-surface-elevated p-3 sm:p-3.5">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h3
          className="min-h-[2.625rem] min-w-0 flex-1 line-clamp-2 text-sm font-bold leading-snug text-foreground"
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
          title={tExplore('directDepsBadgeTitle')}
        >
          {directDeps}
        </span>
      </div>
      <span className="w-fit rounded-full bg-border/20 px-2.5 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
        {formatYear(node.year_approx ?? null)}
      </span>
      <span
        className="w-fit max-w-full rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
        style={{ backgroundColor: hexToRgba(catColor, 0.42) }}
      >
        {safeCategoryLabel(tCat, cat, tTypes)}
      </span>
    </div>
  );

  const inner = (
    <div className="flex min-h-0 flex-col">
      {imageBlock}
      {textBlock}
    </div>
  );

  const cardClass = `relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-md transition-[border-color,transform,box-shadow] duration-200 hover:border-[var(--card-cat)] hover:shadow-lg ${!isHero && onClick ? 'hover:scale-[1.02] active:scale-[0.99]' : ''} ${isHero ? 'w-full max-w-[min(100%,21rem)] sm:max-w-[min(100%,24rem)]' : 'w-full min-w-0'} ${onClick ? 'cursor-pointer' : ''} ${className}`;

  const clickProps =
    exploreInteractive && onClick
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
      : !exploreInteractive && onClick
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

  const commonDivProps = {
    ref: rootRef,
    className: cardClass,
    style: { '--card-cat': catColor } as React.CSSProperties,
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

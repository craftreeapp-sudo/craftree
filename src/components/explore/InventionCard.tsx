'use client';

import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { getCategoryColor } from '@/lib/colors';
import { formatYear } from '@/lib/utils';
import type { NodeCategory, TechNodeBasic } from '@/lib/types';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';

const HOVER_DELAY_MS = 300;
const LONG_PRESS_MS = 500;

type Props = {
  node: TechNodeBasic;
  directDeps: number;
  variant: 'hero' | 'compact';
  /** Navigation (clic sur la carte, hors bouton info) */
  onClick?: () => void;
  /** Mode explore : survol + panneau latéral */
  exploreInteractive?: boolean;
  /** Ouvre le panneau détail (bouton i, clic long, clic droit) */
  onOpenDetail?: () => void;
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
  onOpenDetail,
  layoutId,
  imageBust = 0,
  className = '',
}: Props) {
  const tCat = useTranslations('categories');
  const tExplore = useTranslations('explore');
  const ctx = useExploreCardOptional();

  const rootRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );
  const longPressRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const isHero = variant === 'hero';
  const imgSize = isHero ? 'h-36 w-36 sm:h-44 sm:w-44' : 'h-20 w-20 sm:h-24 sm:w-24';
  const url = node.image_url?.trim();
  const busted =
    url && imageBust > 0
      ? `${url}${url.includes('?') ? '&' : '?'}t=${imageBust}`
      : url;

  const cat = node.category as NodeCategory;
  const catColor = getCategoryColor(cat);

  const canHover =
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

  const clearLongPress = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = undefined;
    }
  }, []);

  const scheduleHover = useCallback(() => {
    if (!canHover || !ctx) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => {
      const el = rootRef.current;
      if (!el) return;
      ctx.setHoverPreview({
        nodeId: node.id,
        rect: el.getBoundingClientRect(),
      });
    }, HOVER_DELAY_MS);
  }, [canHover, ctx, clearHoverTimer, node.id]);

  const endHover = useCallback(() => {
    clearHoverTimer();
    if (ctx?.hoverPreview?.nodeId === node.id) {
      ctx.setHoverPreview(null);
    }
  }, [clearHoverTimer, ctx, node.id]);

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('[data-invention-card-info]')) return;
      onClick?.();
    },
    [onClick]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!exploreInteractive || !onOpenDetail) return;
      e.preventDefault();
      onOpenDetail();
    },
    [exploreInteractive, onOpenDetail]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (
        !exploreInteractive ||
        !onOpenDetail ||
        ctx?.isMobile ||
        e.button !== 0
      ) {
        return;
      }
      const t = e.target as HTMLElement;
      if (t.closest('[data-invention-card-info]')) return;
      clearLongPress();
      longPressRef.current = setTimeout(() => {
        longPressRef.current = undefined;
        onOpenDetail();
      }, LONG_PRESS_MS);
    },
    [exploreInteractive, onOpenDetail, ctx?.isMobile, clearLongPress]
  );

  const imageBlock = (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-[#12121f] ${imgSize}`}
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
          className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/40 sm:text-3xl"
          style={{ backgroundColor: `${catColor}33` }}
          aria-hidden
        >
          {node.name.trim().charAt(0).toUpperCase() || '?'}
        </div>
      )}
    </div>
  );

  const textBlock = (
    <div
      className={`flex min-w-0 flex-1 flex-col gap-1 ${isHero ? 'items-center text-center' : 'text-left'}`}
    >
      <h3
        className={`font-semibold leading-tight text-white ${isHero ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'}`}
      >
        {node.name}
      </h3>
      <div
        className={`flex flex-wrap items-center gap-2 text-xs text-white/60 sm:text-sm ${isHero ? 'justify-center' : ''}`}
      >
        <span
          className="rounded-md bg-white/10 px-2 py-0.5 font-mono tabular-nums text-white/90"
          title="Direct dependencies"
        >
          {directDeps}
        </span>
        <span className="tabular-nums">
          {formatYear(node.year_approx ?? null)}
        </span>
      </div>
      <span
        className={`mt-1 inline-flex w-fit max-w-full truncate rounded-md border px-2 py-0.5 text-[10px] font-medium sm:text-xs ${isHero ? '' : 'mt-auto'}`}
        style={{
          borderColor: catColor,
          color: catColor,
        }}
      >
        {tCat(cat)}
      </span>
    </div>
  );

  const inner = isHero ? (
    <>
      {imageBlock}
      {textBlock}
    </>
  ) : (
    <>
      {imageBlock}
      {textBlock}
    </>
  );

  const infoBtn =
    exploreInteractive && onOpenDetail ? (
      <button
        type="button"
        data-invention-card-info
        aria-label={tExplore('cardInfoAria')}
        title={tExplore('cardInfoAria')}
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetail();
        }}
        className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#0f0f18]/90 text-sm font-semibold text-white/90 shadow-md backdrop-blur-sm transition-colors hover:border-white/35 hover:bg-[#1a1a2e]"
      >
        i
      </button>
    ) : null;

  const cardClass = `relative flex rounded-lg border border-white/10 bg-[#1a1a2e] p-3 shadow-md transition-[transform,box-shadow] duration-200 hover:border-white/20 hover:shadow-lg ${onClick ? 'hover:scale-[1.02] active:scale-[0.99]' : ''} ${isHero ? 'max-w-md flex-col items-center gap-4 sm:max-w-lg' : 'max-w-[200px] flex-col gap-2 sm:max-w-[220px]'} ${onClick ? 'cursor-pointer' : ''} ${className}`;

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
        onPointerLeave: () => {
          endHover();
          clearLongPress();
        },
      }
    : {};

  const detailGestureHandlers =
    exploreInteractive && onOpenDetail
      ? {
          onContextMenu: handleContextMenu,
          onPointerDown: handlePointerDown,
          onPointerUp: clearLongPress,
        }
      : {};

  const commonDivProps = {
    ref: rootRef,
    className: cardClass,
    ...clickProps,
    ...hoverPointerHandlers,
    ...detailGestureHandlers,
  };

  const body = (
    <>
      {infoBtn}
      {inner}
    </>
  );

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

'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { getCategoryColor, hexToRgba } from '@/lib/colors';
import { formatYear } from '@/lib/utils';
import type { NodeCategory, TechNodeBasic } from '@/lib/types';
import { useExploreCardOptional } from '@/components/explore/explore-card-context';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { CardImagePlaceholder } from '@/components/explore/CardImagePlaceholder';
import { BuiltUponBadgePopover } from '@/components/explore/BuiltUponBadgePopover';
import { useGraphStore } from '@/stores/graph-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';

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
  const tCommon = useTranslations('common');
  const tEditor = useTranslations('editor');
  const ctx = useExploreCardOptional();
  const router = useRouter();
  const { isAdmin } = useAuthStore();
  const pushToast = useToastStore((s) => s.pushToast);
  const refreshData = useGraphStore((s) => s.refreshData);
  const [deleteBusy, setDeleteBusy] = useState(false);

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
  const getRecipeForNode = useGraphStore((s) => s.getRecipeForNode);
  const builtUponCount = useMemo(
    () => getRecipeForNode(node.id).length,
    [getRecipeForNode, node.id]
  );

  const canHover =
    !isHero &&
    exploreInteractive === true &&
    Boolean(ctx) &&
    ctx!.suppressHover === false &&
    ctx!.isMobile === false;

  const showAdminTreeActions =
    isAdmin &&
    !isHero &&
    exploreInteractive === true &&
    Boolean(ctx) &&
    ctx!.isMobile === false;

  const handleAdminDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (deleteBusy) return;
      if (!window.confirm(tEditor('confirmDelete'))) return;
      setDeleteBusy(true);
      try {
        const res = await fetch(
          `/api/nodes/${encodeURIComponent(node.id)}`,
          { method: 'DELETE' }
        );
        if (!res.ok) {
          pushToast(tEditor('toastDeleteFailed'), 'error');
          return;
        }
        pushToast(tEditor('toastNodeDeleted'), 'success');
        await refreshData();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('craftree:editor-refresh'));
        }
        router.refresh();
      } catch {
        pushToast(tEditor('toastNetworkError'), 'error');
      } finally {
        setDeleteBusy(false);
      }
    },
    [
      deleteBusy,
      node.id,
      pushToast,
      refreshData,
      router,
      tEditor,
    ]
  );

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

  const openAdminEditInPanel = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!ctx) return;
      ctx.openDetail(node.id);
      ctx.openAdminEditSubview();
    },
    [ctx, node.id]
  );

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
      <h3
        className="flex min-h-[2.625rem] min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm font-bold leading-snug text-foreground"
        title={displayName}
      >
        <span className="min-w-0 line-clamp-2">{displayName}</span>
        <BuiltUponBadgePopover count={builtUponCount} borderColor={catColor} />
      </h3>
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

  const cardBody = (
    <div className="flex min-h-0 flex-col">
      {imageBlock}
      {textBlock}
    </div>
  );

  const isInteractive = !isHero && (!!href || !!onClick);
  /** Pas de scale au survol si aperçu latéral : le transform déplace les bords sous le curseur et peut provoquer pointerleave/enter en boucle. */
  const scaleHoverClass =
    isInteractive && !canHover ? 'hover:scale-[1.02] active:scale-[0.99]' : '';
  /** `group` sur la carte seulement si pas de barre admin (sinon le groupe est sur le wrapper). */
  const groupClass = showAdminTreeActions ? '' : 'group ';
  const cardClass = `${groupClass}relative flex flex-col overflow-hidden rounded-xl glass-card transition-[border-color,transform,box-shadow] duration-200 hover:border-[var(--card-cat)] hover:shadow-lg ${scaleHoverClass} ${isHero ? 'w-full max-w-[min(100%,23rem)] sm:max-w-[min(100%,27rem)]' : 'w-full min-w-0'} ${isInteractive ? 'cursor-pointer' : ''} ${className}`;

  const adminToolbar =
    showAdminTreeActions ? (
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="pointer-events-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-border/35 hover:text-foreground"
          title={tCommon('edit')}
          aria-label={tCommon('edit')}
          onClick={openAdminEditInPanel}
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
        <button
          type="button"
          disabled={deleteBusy}
          title={tCommon('delete')}
          aria-label={tCommon('delete')}
          className="pointer-events-auto rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
          onClick={handleAdminDelete}
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
    ) : null;

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
    const linkCard = (
      <Link
        ref={rootRef as React.Ref<HTMLAnchorElement>}
        href={href}
        scroll={false}
        className={cardClass}
        style={style}
        onClick={onClick}
        {...hoverPointerHandlers}
      >
        {cardBody}
      </Link>
    );

    const linkEl = showAdminTreeActions ? (
      <div className="group relative w-full min-w-0 pt-8">
        {adminToolbar}
        {linkCard}
      </div>
    ) : (
      linkCard
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

  const divCard = <div {...commonDivProps}>{cardBody}</div>;

  const body = showAdminTreeActions ? (
    <div className="group relative w-full min-w-0 pt-8">
      {adminToolbar}
      {divCard}
    </div>
  ) : (
    divCard
  );

  if (layoutId) {
    return (
      <motion.div
        layout
        layoutId={layoutId}
        className="w-full min-w-0"
      >
        {body}
      </motion.div>
    );
  }

  return body;
}

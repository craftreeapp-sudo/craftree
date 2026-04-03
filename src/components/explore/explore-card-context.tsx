'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** Délai après sortie carte/popup avant fermeture (permet d’atteindre le portail). */
export const HOVER_LEAVE_DELAY_MS = 220;

export type ExploreHoverPreview = {
  nodeId: string;
  /** Instantané au survol (secours si l’élément disparaît). */
  rect: DOMRect;
  /** Élément carte : repositionnement au scroll / resize. */
  anchorEl: HTMLElement | null;
};

export type ExploreDetailSubview = 'detail' | 'suggest' | 'adminEdit';

export type ExploreCardContextValue = {
  detailNodeId: string | null;
  /** Vue dans le panneau latéral explore : fiche ou formulaire de suggestion (sans fermer la fiche). */
  detailSubview: ExploreDetailSubview;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  openSuggestSubview: () => void;
  closeSuggestSubview: () => void;
  /** Admin : formulaire d’édition directe (reste sur /tree). */
  openAdminEditSubview: () => void;
  legendOpen: boolean;
  openLegend: () => void;
  closeLegend: () => void;
  hoverPreview: ExploreHoverPreview | null;
  setHoverPreview: (v: ExploreHoverPreview | null) => void;
  /** Annule une fermeture différée (ex. entrée dans la popover ou autre carte). */
  cancelHoverClose: () => void;
  /** Ferme le survol après un court délai (sortie carte ou popover). */
  requestHoverClose: () => void;
  suppressHover: boolean;
  isMobile: boolean;
};

const ExploreCardContext = createContext<ExploreCardContextValue | null>(null);

export function ExploreCardProvider({
  children,
  isMobile,
}: {
  children: ReactNode;
  isMobile: boolean;
}) {
  const [detailNodeId, setDetailNodeId] = useState<string | null>(null);
  const [detailSubview, setDetailSubview] =
    useState<ExploreDetailSubview>('detail');
  const [legendOpen, setLegendOpen] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<ExploreHoverPreview | null>(
    null
  );
  const hoverPreviewRef = useRef<ExploreHoverPreview | null>(null);
  hoverPreviewRef.current = hoverPreview;
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHoverClose = useCallback(() => {
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  }, []);

  const requestHoverClose = useCallback(() => {
    cancelHoverClose();
    hoverLeaveTimerRef.current = setTimeout(() => {
      hoverLeaveTimerRef.current = null;
      setHoverPreview(null);
    }, HOVER_LEAVE_DELAY_MS);
  }, [cancelHoverClose]);

  /** Clic en dehors de la carte source et du popup : ferme l’aperçu tout de suite. */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onPointerDownCapture = (e: PointerEvent) => {
      const p = hoverPreviewRef.current;
      if (!p) return;
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest('[data-explore-hover-popup]')) {
        return;
      }
      if (p.anchorEl?.isConnected && p.anchorEl.contains(target)) {
        return;
      }
      cancelHoverClose();
      setHoverPreview(null);
    };
    document.addEventListener('pointerdown', onPointerDownCapture, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDownCapture, true);
    };
  }, [cancelHoverClose]);

  const closeLegend = useCallback(() => {
    setLegendOpen(false);
  }, []);

  const openLegend = useCallback(() => {
    setLegendOpen(true);
    cancelHoverClose();
    setHoverPreview(null);
  }, [cancelHoverClose]);

  const openDetail = useCallback(
    (id: string) => {
      cancelHoverClose();
      setDetailNodeId(id);
      setDetailSubview('detail');
      setLegendOpen(false);
      setHoverPreview(null);
    },
    [cancelHoverClose]
  );

  const closeDetail = useCallback(() => {
    setDetailNodeId(null);
    setDetailSubview('detail');
  }, []);

  const openSuggestSubview = useCallback(() => {
    setDetailSubview('suggest');
  }, []);

  const closeSuggestSubview = useCallback(() => {
    setDetailSubview('detail');
  }, []);

  const openAdminEditSubview = useCallback(() => {
    setDetailSubview('adminEdit');
  }, []);

  const suppressHover = legendOpen;

  const value = useMemo(
    (): ExploreCardContextValue => ({
      detailNodeId,
      detailSubview,
      openDetail,
      closeDetail,
      openSuggestSubview,
      closeSuggestSubview,
      openAdminEditSubview,
      legendOpen,
      openLegend,
      closeLegend,
      hoverPreview,
      setHoverPreview,
      cancelHoverClose,
      requestHoverClose,
      suppressHover,
      isMobile,
    }),
    [
      detailNodeId,
      detailSubview,
      openDetail,
      closeDetail,
      openSuggestSubview,
      closeSuggestSubview,
      openAdminEditSubview,
      legendOpen,
      openLegend,
      closeLegend,
      hoverPreview,
      cancelHoverClose,
      requestHoverClose,
      suppressHover,
      isMobile,
    ]
  );

  return (
    <ExploreCardContext.Provider value={value}>
      {children}
    </ExploreCardContext.Provider>
  );
}

export function useExploreCardOptional() {
  return useContext(ExploreCardContext);
}

export function useExploreCard(): ExploreCardContextValue {
  const v = useContext(ExploreCardContext);
  if (!v) {
    throw new Error('useExploreCard must be used within ExploreCardProvider');
  }
  return v;
}

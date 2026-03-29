'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ExploreHoverPreview = { nodeId: string; rect: DOMRect };

export type ExploreDetailSubview = 'detail' | 'suggest';

export type ExploreCardContextValue = {
  detailNodeId: string | null;
  /** Vue dans le panneau latéral explore : fiche ou formulaire de suggestion (sans fermer la fiche). */
  detailSubview: ExploreDetailSubview;
  openDetail: (id: string) => void;
  closeDetail: () => void;
  openSuggestSubview: () => void;
  closeSuggestSubview: () => void;
  legendOpen: boolean;
  openLegend: () => void;
  closeLegend: () => void;
  hoverPreview: ExploreHoverPreview | null;
  setHoverPreview: (v: ExploreHoverPreview | null) => void;
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

  const closeLegend = useCallback(() => {
    setLegendOpen(false);
  }, []);

  const openLegend = useCallback(() => {
    setLegendOpen(true);
    setHoverPreview(null);
  }, []);

  const openDetail = useCallback((id: string) => {
    setDetailNodeId(id);
    setDetailSubview('detail');
    setLegendOpen(false);
    setHoverPreview(null);
  }, []);

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

  const suppressHover = legendOpen;

  const value = useMemo(
    (): ExploreCardContextValue => ({
      detailNodeId,
      detailSubview,
      openDetail,
      closeDetail,
      openSuggestSubview,
      closeSuggestSubview,
      legendOpen,
      openLegend,
      closeLegend,
      hoverPreview,
      setHoverPreview,
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
      legendOpen,
      openLegend,
      closeLegend,
      hoverPreview,
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

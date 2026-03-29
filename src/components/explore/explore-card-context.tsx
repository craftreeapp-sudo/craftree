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

export type ExploreCardContextValue = {
  detailNodeId: string | null;
  openDetail: (id: string) => void;
  closeDetail: () => void;
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
    setLegendOpen(false);
    setHoverPreview(null);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailNodeId(null);
  }, []);

  const suppressHover = legendOpen;

  const value = useMemo(
    (): ExploreCardContextValue => ({
      detailNodeId,
      openDetail,
      closeDetail,
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
      openDetail,
      closeDetail,
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

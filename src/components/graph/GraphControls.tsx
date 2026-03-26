'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MiniMap, useReactFlow, useStore } from '@xyflow/react';
import { useUIStore } from '@/stores/ui-store';
import { getCategoryColor } from '@/lib/colors';
import type { TechNodeData } from './TechNode';

const SIDEBAR_W = 340;
const SIDEBAR_GAP = 20;
const BTN =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-[#2A3042] bg-[#1A1F2E] text-[#E8ECF4] transition-colors hover:border-[#3B82F6]';

function ZoomInIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35M11 8v6M8 11h6" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35M8 11h6" />
    </svg>
  );
}

function FullscreenIcon({ exit }: { exit: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {exit ? (
        <>
          <path d="M8 3v3a2 2 0 0 1-2 2H3" />
          <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
          <path d="M3 16h3a2 2 0 0 1 2 2v3" />
          <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
        </>
      ) : (
        <>
          <path d="M8 3H5a2 2 0 0 0-2 2v3" />
          <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
          <path d="M3 16v3a2 2 0 0 0 2 2h3" />
          <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </>
      )}
    </svg>
  );
}

function ConnectionsIcon({ on }: { on: boolean }) {
  return on ? (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.38 13.38 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function EdgeStyleIcon({ angular }: { angular: boolean }) {
  return angular ? (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 18h6v-6h6V6" />
    </svg>
  ) : (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 18c6-6 10-6 16-12" />
    </svg>
  );
}

export function GraphControls({
  showConnections,
  onToggleConnections,
  graphContainerRef,
}: {
  showConnections: boolean;
  onToggleConnections: () => void;
  graphContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const tg = useTranslations('graphControls');
  const { zoomIn, zoomOut } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const zoomPercent = Math.round(zoom * 100);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const edgeStyle = useUIStore((s) => s.edgeStyle);
  const toggleEdgeStyle = useUIStore((s) => s.toggleEdgeStyle);

  const focused = Boolean(selectedNodeId && isSidebarOpen);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const onFs = () => setFs(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = graphContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  }, [graphContainerRef]);

  const zoomInClick = useCallback(() => {
    zoomIn({ duration: 200 });
  }, [zoomIn]);

  const zoomOutClick = useCallback(() => {
    zoomOut({ duration: 200 });
  }, [zoomOut]);

  const toolbar = (
    <>
      <span
        className="flex min-w-[2.75rem] shrink-0 select-none items-center justify-center rounded-[8px] border border-[#2A3042] bg-[#1A1F2E] px-2 py-1.5 text-xs tabular-nums text-[#8B95A8]"
        aria-live="polite"
        title={tg('zoomTitle')}
      >
        {zoomPercent}%
      </span>
      <button
        type="button"
        className={BTN}
        onClick={zoomInClick}
        aria-label={tg('zoomIn')}
        title={tg('zoomIn')}
      >
        <ZoomInIcon />
      </button>
      <button
        type="button"
        className={BTN}
        onClick={zoomOutClick}
        aria-label={tg('zoomOut')}
        title={tg('zoomOut')}
      >
        <ZoomOutIcon />
      </button>
      <button
        type="button"
        className={BTN}
        onClick={onToggleConnections}
        aria-pressed={showConnections}
        title={
          showConnections ? tg('hideConnections') : tg('showConnections')
        }
        aria-label={
          showConnections
            ? tg('hideConnectionsAria')
            : tg('showConnectionsAria')
        }
      >
        <ConnectionsIcon on={showConnections} />
      </button>
      {!focused ? (
        <button
          type="button"
          className={BTN}
          onClick={toggleFullscreen}
          aria-label={fs ? tg('exitFullscreen') : tg('fullscreen')}
          title={fs ? tg('exitFullscreen') : tg('fullscreen')}
        >
          <FullscreenIcon exit={fs} />
        </button>
      ) : null}
      <button
        type="button"
        className={BTN}
        onClick={toggleEdgeStyle}
        title={
          edgeStyle === 'angular' ? tg('edgeAngular') : tg('edgeSmooth')
        }
        aria-label={
          edgeStyle === 'angular'
            ? tg('edgeAngularAria')
            : tg('edgeSmoothAria')
        }
      >
        <EdgeStyleIcon angular={edgeStyle === 'angular'} />
      </button>
    </>
  );

  return (
    <div
      className="pointer-events-auto absolute z-[45] flex flex-row flex-nowrap items-end justify-end gap-2 transition-[right] duration-300 ease-out"
      style={{
        bottom: 20,
        right: focused ? SIDEBAR_W + SIDEBAR_GAP : 20,
      }}
    >
      {/*
        Vue globale : barre horizontale à gauche, mini-map à droite (même ligne, bas aligné).
        Le host CSS neutralise le Panel absolute de MiniMap pour qu’il suive le flex.
      */}
      <div className="relative z-20 flex shrink-0 flex-row flex-nowrap items-center gap-1.5">
        {toolbar}
      </div>
      {!focused ? (
        <div className="graph-controls-minimap-host relative z-10 shrink-0">
          <MiniMap
            style={{ width: 200, height: 150 }}
            nodeColor={(node) => {
              if (
                node.type === 'layerLabel' ||
                node.type === 'addButton' ||
                node.type === 'searchPopup'
              ) {
                return 'rgba(0,0,0,0)';
              }
              const data = node.data as unknown as TechNodeData;
              return getCategoryColor(data?.category ?? 'material');
            }}
            maskColor="rgba(10, 14, 23, 0.8)"
            className="!bg-[#1A1F2E] !border border-[#2A3042]"
          />
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TechGraph } from '@/components/graph/TechGraph';
import { ExploreCategoryPanel } from '@/components/explore/ExploreCategoryPanel';
import { ExploreMobile } from '@/components/explore/ExploreMobile';
import { NodeDetailSidebar } from '@/components/ui/NodeDetailSidebar';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';

function ExploreInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const node = searchParams.get('node');
  const selectNode = useUIStore((s) => s.selectNode);
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const refreshData = useGraphStore((s) => s.refreshData);
  const isMobile = useIsMobileBreakpoint();
  const [dataReady, setDataReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void refreshData().then(() => setDataReady(true));
  }, [refreshData]);

  useEffect(() => {
    if (!toast) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setToast(null);
    }, 2000);
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [toast]);

  useEffect(() => {
    if (!dataReady) return;

    if (!node) {
      closeSidebar();
      return;
    }

    const found = useGraphStore.getState().getNodeById(node);
    if (!found) {
      setToast('Invention non trouvée');
      router.replace('/explore');
      closeSidebar();
      return;
    }

    const ui = useUIStore.getState();
    if (ui.selectedNodeId === node && ui.isSidebarOpen) {
      // Déjà sélectionné (ex. clic graphe + replaceState) — ne pas réécraser center: false
      return;
    }

    selectNode(node, {
      center: true,
      ...(isMobile ? { exploreMode: 'root' as const } : {}),
    });
  }, [dataReady, node, selectNode, isMobile, closeSidebar, router]);

  return (
    <main className="relative flex h-full min-h-0 min-h-[calc(100dvh-3.5rem)] flex-1 flex-col overflow-hidden bg-[#0A0E17] pt-14">
      {toast ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-[#2A3042] bg-[#1A1F2E] px-4 py-2.5 text-sm text-[#E8ECF4] shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <ExploreMobile />
      </div>
      <div className="relative hidden min-h-0 flex-1 flex-col md:flex">
        <ExploreCategoryPanel />
        <TechGraph />
      </div>
      <NodeDetailSidebar />
    </main>
  );
}

export function ExploreClient() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-[50vh] flex-1 bg-[#0A0E17] pt-14" />
      }
    >
      <ExploreInner />
    </Suspense>
  );
}

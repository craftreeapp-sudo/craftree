'use client';

import { Suspense, use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BuiltUponView } from '@/components/explore/BuiltUponView';
import { NodeDetailSidebar } from '@/components/ui/NodeDetailSidebar';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import type { CraftingLink, SeedNode } from '@/lib/types';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';

function TreeExploreInner({
  inventionId,
  initialGraph,
}: {
  inventionId: string;
  initialGraph: { nodes: SeedNode[]; links: CraftingLink[] } | null;
}) {
  const router = useRouter();
  const tEx = useTranslations('explore');
  const selectNode = useUIStore((s) => s.selectNode);
  const closeSidebar = useUIStore((s) => s.closeSidebar);
  const refreshData = useGraphStore((s) => s.refreshData);
  const hydrateFromRaw = useGraphStore((s) => s.hydrateFromRaw);
  const [dataReady, setDataReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialGraph) {
      hydrateFromRaw(initialGraph.nodes, initialGraph.links);
      queueMicrotask(() => setDataReady(true));
      return;
    }
    void refreshData().then(() => queueMicrotask(() => setDataReady(true)));
  }, [refreshData, hydrateFromRaw, initialGraph]);

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

    const found = useGraphStore.getState().getNodeById(inventionId);
    if (!found) {
      queueMicrotask(() => setToast('Invention non trouvée'));
      router.replace(treeInventionPath(getDefaultTreeNodeId()));
      closeSidebar();
      return;
    }

    const ui = useUIStore.getState();
    if (ui.selectedNodeId === inventionId && ui.isSidebarOpen) {
      return;
    }

    selectNode(inventionId, {
      center: false,
      openSidebar: false,
    });
  }, [dataReady, inventionId, selectNode, closeSidebar, router]);

  return (
    <main className="relative flex h-full min-h-0 min-h-[calc(100dvh-3.5rem)] flex-1 flex-col overflow-hidden bg-page pt-14">
      {toast ? (
        <div
          className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-foreground shadow-lg"
          role="status"
        >
          {toast}
        </div>
      ) : null}
      {dataReady ? (
        <BuiltUponView focusId={inventionId} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {tEx('builtUponLoading')}
        </div>
      )}
      <NodeDetailSidebar />
    </main>
  );
}

export function TreePageClient({
  params,
  initialGraph,
}: {
  params: Promise<{ id: string }>;
  initialGraph: { nodes: SeedNode[]; links: CraftingLink[] } | null;
}) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50dvh] flex-1 items-center justify-center pt-14 text-muted-foreground">
          …
        </div>
      }
    >
      <TreeExploreInner inventionId={id} initialGraph={initialGraph} />
    </Suspense>
  );
}

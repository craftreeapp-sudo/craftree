'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useGraphStore } from '@/stores/graph-store';
import { useExploreFocusTransitionStore } from '@/stores/explore-focus-transition-store';
import {
  getDirectPredecessors,
  getDirectSuccessors,
} from '@/lib/graph-adjacency';

/** Navigation /explore + sync URL (?node=) sans rechargement complet */
export function useExploreNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const selectNode = useUIStore((s) => s.selectNode);
  const closeSidebar = useUIStore((s) => s.closeSidebar);

  const navigateToNode = useCallback(
    (
      id: string,
      opts?: {
        center?: boolean;
        exploreMode?: 'root' | 'push';
        openEdit?: boolean;
        openSuggest?: boolean;
        /** Forcer navigation immédiate (ex. fin d’animation focus) */
        skipFocusTransition?: boolean;
        /** Même animation que voisin direct (ex. panneau « même catégorie ») */
        forceFocusTransition?: boolean;
      }
    ) => {
      const selected = useUIStore.getState().selectedNodeId;
      const sidebarOpen = useUIStore.getState().isSidebarOpen;
      const anim = useUIStore.getState().isAnimating;
      const edges = useGraphStore.getState().edges;

      if (
        opts?.skipFocusTransition !== true &&
        !anim &&
        sidebarOpen &&
        selected &&
        selected !== id
      ) {
        const preds = getDirectPredecessors(selected, edges);
        const succs = getDirectSuccessors(selected, edges);
        const isNeighbor = preds.includes(id) || succs.includes(id);
        if (isNeighbor || opts?.forceFocusTransition === true) {
          useExploreFocusTransitionStore.getState().requestTransition(
            selected,
            id,
            {
              openEdit: opts?.openEdit === true,
              openSuggest: opts?.openSuggest === true,
            }
          );
          return;
        }
      }

      router.replace(`/explore?node=${encodeURIComponent(id)}`);
      selectNode(id, {
        center: opts?.center === true,
        exploreMode: opts?.exploreMode,
        openEdit: opts?.openEdit === true,
        openSuggest: opts?.openSuggest === true,
      });
    },
    [router, selectNode]
  );

  const closeDetail = useCallback(() => {
    closeSidebar();
    if (pathname === '/explore') {
      router.replace('/explore');
    }
  }, [closeSidebar, pathname, router]);

  return { navigateToNode, closeDetail };
}

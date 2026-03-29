'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { parseExploreViewMode } from '@/lib/explore-view-mode';
import { treeInventionPath } from '@/lib/tree-routes';

/** Navigation vers `/tree/[id]` + sync query `view=` */
export function useExploreNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
        openSidebar?: boolean;
        exploreView?: 'built-upon' | 'led-to';
      }
    ) => {
      const view = opts?.exploreView ?? parseExploreViewMode(searchParams);
      router.replace(treeInventionPath(id, view));
      selectNode(id, {
        center: opts?.center === true,
        exploreMode: opts?.exploreMode,
        openEdit: opts?.openEdit === true,
        openSuggest: opts?.openSuggest === true,
        openSidebar: opts?.openSidebar,
      });
    },
    [router, searchParams, selectNode]
  );

  const closeDetail = useCallback(() => {
    closeSidebar();
    if (pathname?.startsWith('/tree/')) {
      const base = pathname.split('?')[0] ?? pathname;
      router.replace(base);
    }
  }, [closeSidebar, pathname, router]);

  return { navigateToNode, closeDetail };
}

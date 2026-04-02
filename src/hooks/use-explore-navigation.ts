'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { treeInventionPath } from '@/lib/tree-routes';

/** Navigation vers `/tree/[id]` (sans query ; `?view=led-to` sert uniquement au scroll initial). */
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
      }
    ) => {
      router.push(treeInventionPath(id));
      selectNode(id, {
        center: opts?.center === true,
        exploreMode: opts?.exploreMode,
      });
    },
    [router, selectNode]
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

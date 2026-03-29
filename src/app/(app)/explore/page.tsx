import { redirect } from 'next/navigation';
import { getDefaultTreeNodeId, treeInventionPath } from '@/lib/tree-routes';

/** Ancienne URL /explore → redirection canonique vers `/tree/[id]`. */
export default function ExploreRedirectPage() {
  redirect(treeInventionPath(getDefaultTreeNodeId()));
}

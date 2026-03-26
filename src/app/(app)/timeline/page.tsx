'use client';

import { TechTimeline } from '@/components/graph/TechTimeline';
import { NodeDetailSidebar } from '@/components/ui/NodeDetailSidebar';

export default function TimelinePage() {
  return (
    <main className="relative min-h-[calc(100dvh-3.5rem)] flex-1 overflow-hidden bg-page pt-14">
      <TechTimeline />
      <NodeDetailSidebar />
    </main>
  );
}

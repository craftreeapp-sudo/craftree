'use client';

import { supabase } from '@/lib/supabase';

let sessionId: string | null = null;

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
}

/**
 * Enregistre un événement analytics (fire-and-forget, ne bloque pas l’UI).
 */
export function trackEvent(
  eventType: string,
  nodeId?: string,
  metadata?: Record<string, unknown>
): void {
  if (typeof window === 'undefined') return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

  void supabase
    .from('analytics_events')
    .insert({
      event_type: eventType,
      node_id: nodeId ?? null,
      session_id: getSessionId(),
      metadata: metadata ?? {},
    })
    .then(
      () => {
        /* résultat ignoré */
      },
      () => {
        /* réseau / RLS / hors-ligne : ne pas polluer la console */
      }
    );
}

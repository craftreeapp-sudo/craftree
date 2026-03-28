/**
 * Notifications contributeur après modération (Resend + templates dashboard).
 *
 * Variables d’environnement :
 * - RESEND_API_KEY (déjà utilisé pour l’admin)
 * - RESEND_FROM_EMAIL
 * - RESEND_TEMPLATE_SUGGESTION_APPROVED — id ou alias du template « approuvé »
 * - RESEND_TEMPLATE_SUGGESTION_REJECTED — id ou alias du template « rejeté »
 *
 * Variables passées au template (toutes des chaînes, adaptables dans Resend) :
 * - suggestion_id, suggestion_type, status (approved | rejected)
 * - node_id, admin_comment
 * - site_url, explore_url (lien vers /explore ou nœud si node_id)
 */
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';

type SuggestionRow = {
  id: string;
  user_id: string | null;
  suggestion_type: string;
  node_id: string | null;
  data: unknown;
};

export async function notifyContributorSuggestionResult(params: {
  status: 'approved' | 'rejected';
  row: SuggestionRow;
  adminComment?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const templateId =
    params.status === 'approved'
      ? process.env.RESEND_TEMPLATE_SUGGESTION_APPROVED?.trim()
      : process.env.RESEND_TEMPLATE_SUGGESTION_REJECTED?.trim();

  if (!apiKey || !from || !templateId) {
    console.warn(
      '[notifyContributorSuggestionResult] skipped: missing RESEND_API_KEY, RESEND_FROM_EMAIL, or RESEND_TEMPLATE_SUGGESTION_' +
        (params.status === 'approved' ? 'APPROVED' : 'REJECTED')
    );
    return;
  }

  const sb = createSupabaseServiceRoleClient();
  const to = await resolveContributorEmail(sb, params.row);
  if (!to) {
    console.warn(
      '[notifyContributorSuggestionResult] no contributor email for suggestion',
      params.row.id
    );
    return;
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://www.craftree.app';
  const nodeId = params.row.node_id?.trim() ?? '';
  const exploreUrl = nodeId
    ? `${origin}/explore?node=${encodeURIComponent(nodeId)}`
    : `${origin}/explore`;

  const dataObj =
    params.row.data && typeof params.row.data === 'object'
      ? (params.row.data as Record<string, unknown>)
      : {};

  /** Resend Send Email API: `template.id` + `template.variables` (alias du corps « template » ; pas de HTML brut). */
  const templateVariables: Record<string, string> = {
    suggestion_id: params.row.id,
    suggestion_type: String(params.row.suggestion_type),
    status: params.status,
    node_id: nodeId,
    admin_comment: String(params.adminComment ?? '').trim(),
    site_url: origin,
    explore_url: exploreUrl,
    contributor_message: extractContributorMessagePreview(dataObj),
  };

  console.log(
    '[notifyContributorSuggestionResult] contributor email (before send):',
    to
  );

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        template: {
          id: templateId,
          variables: templateVariables,
        },
      }),
    });
    const rawText = await res.text();
    let parsed: unknown = rawText;
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = rawText;
    }
    console.log('Resend response:', { status: res.status, body: parsed });
    if (!res.ok) {
      console.error(
        '[notifyContributorSuggestionResult] Resend error:',
        res.status,
        parsed
      );
    }
  } catch (e) {
    console.error('[notifyContributorSuggestionResult]', e);
  }
}

async function resolveContributorEmail(
  sb: ReturnType<typeof createSupabaseServiceRoleClient>,
  row: SuggestionRow
): Promise<string | null> {
  const uid = row.user_id;
  if (uid) {
    const { data: pr } = await sb
      .from('profiles')
      .select('email')
      .eq('id', uid)
      .maybeSingle();
    const e = (pr as { email?: string | null } | null)?.email?.trim();
    if (e && e.includes('@')) return e.slice(0, 320);
  }
  const data =
    row.data && typeof row.data === 'object'
      ? (row.data as Record<string, unknown>)
      : {};
  const contact = data.contactEmail;
  if (typeof contact === 'string' && contact.includes('@')) {
    return contact.trim().slice(0, 320);
  }
  const anon = data.email;
  if (typeof anon === 'string' && anon.includes('@')) {
    return anon.trim().slice(0, 320);
  }
  return null;
}

function extractContributorMessagePreview(data: Record<string, unknown>): string {
  const m = data.contributorMessage;
  if (typeof m !== 'string' || !m.trim()) return '';
  return m.trim().slice(0, 500);
}

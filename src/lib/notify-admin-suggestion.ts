/**
 * Notification e-mail admin lors d’une nouvelle suggestion (optionnel).
 * Configurez RESEND_API_KEY, RESEND_FROM_EMAIL, et ADMIN_NOTIFY_EMAIL ou NEXT_PUBLIC_ADMIN_EMAIL.
 */
export async function notifyAdminNewSuggestion(params: {
  suggestionId: string;
  suggestionType: string;
  isAnonymous: boolean;
  contributorIp: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to =
    process.env.ADMIN_NOTIFY_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !to || !from) {
    if (process.env.NODE_ENV === 'development') {
      console.info(
        '[notifyAdminNewSuggestion] skipped (set RESEND_API_KEY, RESEND_FROM_EMAIL, ADMIN_NOTIFY_EMAIL)'
      );
    }
    return;
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://craftree.app';
  const adminUrl = `${origin}/admin`;

  const who = params.isAnonymous
    ? `Anonyme (IP : ${params.contributorIp ?? 'inconnue'})`
    : 'Contributeur connecté';

  const subject = `[Craftree] Nouvelle suggestion (${params.suggestionType})`;
  const html = `
    <p>${who}</p>
    <p>Type : <strong>${escapeHtml(params.suggestionType)}</strong></p>
    <p>ID : <code>${escapeHtml(params.suggestionId)}</code></p>
    <p><a href="${escapeHtml(adminUrl)}">Ouvrir l’administration</a></p>
  `;

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
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error('[notifyAdminNewSuggestion] Resend error:', res.status, err);
    }
  } catch (e) {
    console.error('[notifyAdminNewSuggestion]', e);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

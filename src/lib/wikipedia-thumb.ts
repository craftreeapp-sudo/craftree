/**
 * Récupère l’URL du thumbnail principal d’une page Wikipédia (API REST v1).
 */
export async function fetchWikipediaThumbnailUrl(
  wikipediaUrl: string
): Promise<string | null> {
  const trimmed = wikipediaUrl.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (!/\.wikipedia\.org$/i.test(u.hostname)) return null;
    const m = /\/wiki\/([^#?]+)/.exec(u.pathname);
    if (!m) return null;
    const titleSeg = m[1]!;
    const title = decodeURIComponent(titleSeg.replace(/_/g, ' '));
    const apiUrl = `${u.origin}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(apiUrl, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { thumbnail?: { source?: string } };
    const src = json?.thumbnail?.source;
    return typeof src === 'string' && src.startsWith('http') ? src : null;
  } catch {
    return null;
  }
}

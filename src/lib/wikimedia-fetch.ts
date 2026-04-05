/**
 * Résolution d’URL d’illustration via l’API Wikipedia / MediaWiki (sans téléchargement local).
 */

export const WIKIMEDIA_USER_AGENT =
  'Craftree/1.0 (educational project; craftree.app)';

export async function fetchWikipediaImageUrl(
  wikipediaUrl: string | null | undefined
): Promise<string | null> {
  if (!wikipediaUrl?.trim()) return null;
  try {
    const urlObj = new URL(wikipediaUrl);
    const lang = urlObj.hostname.split('.')[0];
    const title = decodeURIComponent(urlObj.pathname.replace('/wiki/', ''));

    if (!title || /:/.test(title)) return null;

    const apiUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=400&origin=*`;

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': WIKIMEDIA_USER_AGENT },
    });

    if (!response.ok) return null;
    const data = (await response.json()) as {
      query?: { pages?: Record<string, { missing?: boolean; thumbnail?: { source?: string } }> };
    };
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || page.missing === true) return null;

    const imageUrl = page?.thumbnail?.source;

    if (!imageUrl) return null;
    return imageUrl.replace(/\/\d+px-/, '/600px-');
  } catch {
    return null;
  }
}

export async function searchWikipediaImage(
  name: string,
  nameEn?: string
): Promise<string | null> {
  for (const [lang, query] of [
    ['fr', name],
    ['en', nameEn || name],
  ] as const) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': WIKIMEDIA_USER_AGENT },
      });
      const data = (await res.json()) as {
        query?: { search?: { title?: string }[] };
      };
      const firstResult = data.query?.search?.[0]?.title;
      if (!firstResult) continue;

      const imgUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(firstResult)}&prop=pageimages&format=json&pithumbsize=400&origin=*`;
      const imgRes = await fetch(imgUrl, {
        headers: { 'User-Agent': WIKIMEDIA_USER_AGENT },
      });
      const imgData = (await imgRes.json()) as {
        query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
      };
      const page = Object.values(imgData.query?.pages || {})[0];
      if (page?.thumbnail?.source) {
        return page.thumbnail.source.replace(/\/\d+px-/, '/600px-');
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Résolution d’URL d’illustration via l’API Wikipedia / MediaWiki (sans téléchargement local).
 */

export const WIKIMEDIA_USER_AGENT =
  'Craftree/1.0 (educational project; craftree.app)';

/**
 * @param {string} wikipediaUrl
 * @returns {Promise<string|null>}
 */
export async function fetchWikipediaImageUrl(wikipediaUrl) {
  if (!wikipediaUrl) return null;
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
    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0];
    if (!page || page.missing === true) return null;

    const imageUrl = page?.thumbnail?.source;

    if (!imageUrl) return null;
    const largerUrl = imageUrl.replace(/\/\d+px-/, '/600px-');
    return largerUrl;
  } catch {
    return null;
  }
}

/**
 * @param {string} name
 * @param {string} [nameEn]
 * @returns {Promise<string|null>}
 */
export async function searchWikipediaImage(name, nameEn) {
  for (const [lang, query] of [
    ['fr', name],
    ['en', nameEn || name],
  ]) {
    try {
      const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
      const res = await fetch(searchUrl, {
        headers: { 'User-Agent': WIKIMEDIA_USER_AGENT },
      });
      const data = await res.json();
      const firstResult = data.query?.search?.[0]?.title;
      if (!firstResult) continue;

      const imgUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(firstResult)}&prop=pageimages&format=json&pithumbsize=400&origin=*`;
      const imgRes = await fetch(imgUrl, {
        headers: { 'User-Agent': WIKIMEDIA_USER_AGENT },
      });
      const imgData = await imgRes.json();
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

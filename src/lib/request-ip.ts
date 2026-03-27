/**
 * IP client derrière proxy (Vercel, Cloudflare, etc.).
 * Ne pas faire confiance au client pour l’IP.
 */
export function getClientIpFromHeaders(request: Request): string | null {
  const h = request.headers;
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = h.get('x-real-ip');
  if (real?.trim()) return real.trim();
  return null;
}

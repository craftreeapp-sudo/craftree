export type ExploreViewMode = 'built-upon' | 'led-to';

/** URL `view=` : défaut built-upon ; `led` conservé pour anciens liens. */
export function parseExploreViewMode(
  searchParams: { get: (key: string) => string | null }
): ExploreViewMode {
  const v = searchParams.get('view');
  if (v === 'led-to' || v === 'led') return 'led-to';
  return 'built-upon';
}

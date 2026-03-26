/** Diff simple pour l’admin (champs modifiés). */
export function computeDiff<T extends Record<string, unknown>>(
  original: T,
  proposed: T
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(original), ...Object.keys(proposed)]);
  for (const k of keys) {
    const a = original[k];
    const b = proposed[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out[k] = { from: a, to: b };
    }
  }
  return out;
}

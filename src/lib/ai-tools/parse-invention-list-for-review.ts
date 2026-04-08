/**
 * Liste saisie dans l’outil « AI Review lot » : ids (slug) ou noms de fiches.
 * Une ligne = une entrée (nom avec espaces). Virgules / point-virgules sur une ligne = plusieurs entrées.
 */
export function parseInventionIdOrNameList(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  const lines = s.split(/\n/);
  const parts: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/[,;]/.test(t)) {
      parts.push(
        ...t
          .split(/[,;]+/)
          .map((x) => x.trim())
          .filter(Boolean)
      );
    } else {
      parts.push(t);
    }
  }
  return [...new Set(parts)];
}

/**
 * Remplace une entrée exacte par une autre dans le texte saisi (lignes et virgules / point-virgules).
 */
export function replaceInventionTokenInRaw(
  raw: string,
  from: string,
  to: string
): string {
  const lines = raw.split(/\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    if (/[,;]/.test(t)) {
      const parts = t.split(/[,;]+/).map((x) => x.trim());
      const replaced = parts.map((p) => (p === from ? to : p));
      out.push(replaced.join(', '));
    } else {
      out.push(t === from ? to : line);
    }
  }
  return out.join('\n');
}

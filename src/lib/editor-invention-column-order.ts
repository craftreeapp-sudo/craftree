/**
 * Ordre des colonnes du tableau « Inventions » de l’éditeur (persisté localStorage).
 */

export const EDITOR_INVENTION_COLUMN_STORAGE_KEY =
  'craftree:editor-inventions-column-order';

export const EDITOR_INVENTION_COLUMN_IDS = [
  'select',
  'image',
  'name',
  'upstream',
  'category',
  'dimension',
  'materialLevel',
  'era',
  'date',
  'origin',
  'naturalOrigins',
  'chemicalNature',
  'links',
  'actions',
] as const;

export type EditorInventionColumnId =
  (typeof EDITOR_INVENTION_COLUMN_IDS)[number];

export const DEFAULT_EDITOR_INVENTION_COLUMN_ORDER: EditorInventionColumnId[] =
  [...EDITOR_INVENTION_COLUMN_IDS];

function isColumnId(x: unknown): x is EditorInventionColumnId {
  return (
    typeof x === 'string' &&
    (EDITOR_INVENTION_COLUMN_IDS as readonly string[]).includes(x)
  );
}

/** Valide qu’on a exactement une fois chaque id (ordre permutable). */
export function parseEditorInventionColumnOrder(
  raw: unknown
): EditorInventionColumnId[] | null {
  if (!Array.isArray(raw) || raw.length !== EDITOR_INVENTION_COLUMN_IDS.length) {
    return null;
  }
  const seen = new Set<string>();
  const out: EditorInventionColumnId[] = [];
  for (const item of raw) {
    if (!isColumnId(item) || seen.has(item)) return null;
    seen.add(item);
    out.push(item);
  }
  return out.length === EDITOR_INVENTION_COLUMN_IDS.length ? out : null;
}

export function loadEditorInventionColumnOrder(): EditorInventionColumnId[] {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_INVENTION_COLUMN_ORDER;
  try {
    const raw = localStorage.getItem(EDITOR_INVENTION_COLUMN_STORAGE_KEY);
    if (!raw) return DEFAULT_EDITOR_INVENTION_COLUMN_ORDER;
    const parsed = parseEditorInventionColumnOrder(JSON.parse(raw));
    return parsed ?? DEFAULT_EDITOR_INVENTION_COLUMN_ORDER;
  } catch {
    return DEFAULT_EDITOR_INVENTION_COLUMN_ORDER;
  }
}

export function moveColumnInOrder(
  order: EditorInventionColumnId[],
  fromId: EditorInventionColumnId,
  toId: EditorInventionColumnId
): EditorInventionColumnId[] {
  const from = order.indexOf(fromId);
  const to = order.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Classes `<th>` par défaut (alignées sur l’ordre initial du tableau). */
export const EDITOR_INVENTION_COLUMN_TH_CLASS: Record<
  EditorInventionColumnId,
  string
> = {
  select: 'w-10 px-1 py-1 text-center text-muted-foreground',
  image: 'w-12 px-1 py-1 text-center text-muted-foreground',
  name: 'w-[200px] px-3 py-1 text-foreground',
  upstream: 'w-[72px] px-2 py-1 text-center tabular-nums',
  category: 'w-[130px] px-3 py-1',
  dimension: 'w-[100px] px-3 py-1',
  materialLevel: 'w-[100px] px-3 py-1',
  era: 'w-[120px] px-3 py-1',
  date: 'w-[80px] px-3 py-1',
  origin: 'w-[150px] px-3 py-1',
  naturalOrigins:
    'w-[120px] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground',
  chemicalNature:
    'w-[120px] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground',
  links: 'w-[60px] px-3 py-1 text-center',
  actions: 'min-w-[188px] w-[188px] px-3 py-1 text-end',
};

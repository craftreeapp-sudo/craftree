'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { suggestInputClass } from '@/components/ui/suggest-form-classes';

function parseTagsCsv(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function serializeTagsCsv(tags: string[]): string {
  return tags.join(', ');
}

type Props = {
  tagsCsv: string;
  onTagsCsvChange: (csv: string) => void;
  dirty?: boolean;
  suggested?: boolean;
  error?: string;
  comfortableText?: boolean;
};

/**
 * Champ tags identique au formulaire « Ajouter une carte » (saisie + pastilles).
 */
export function SuggestionTagsField({
  tagsCsv,
  onTagsCsvChange,
  dirty = false,
  suggested = false,
  error,
  comfortableText = false,
}: Props) {
  const tExplore = useTranslations('explore');
  const graphNodes = useGraphStore((s) => s.nodes);
  const detailsById = useNodeDetailsStore((s) => s.byId);

  const tagVocabulary = useMemo(() => {
    const byLower = new Map<string, string>();
    const add = (raw: string) => {
      const x = raw.trim();
      if (!x) return;
      const key = x.toLowerCase();
      if (byLower.has(key)) return;
      byLower.set(key, x);
    };
    for (const n of graphNodes) {
      for (const t of n.tags ?? []) add(String(t));
    }
    for (const d of Object.values(detailsById)) {
      for (const t of d?.tags ?? []) add(String(t));
    }
    return Array.from(byLower.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [graphNodes, detailsById]);

  const [tagQuery, setTagQuery] = useState('');
  const selectedTags = useMemo(() => parseTagsCsv(tagsCsv), [tagsCsv]);
  const selectedLower = useMemo(
    () => new Set(selectedTags.map((t) => t.toLowerCase())),
    [selectedTags]
  );

  const tagSuggestions = useMemo(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return [];
    const out: string[] = [];
    for (const t of tagVocabulary) {
      if (selectedLower.has(t.toLowerCase())) continue;
      if (!t.toLowerCase().includes(q)) continue;
      out.push(t);
      if (out.length >= 60) break;
    }
    return out;
  }, [tagVocabulary, tagQuery, selectedLower]);

  const addTag = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      const cur = parseTagsCsv(tagsCsv);
      if (cur.some((c) => c.toLowerCase() === t.toLowerCase())) return;
      onTagsCsvChange(serializeTagsCsv([...cur, t]));
      setTagQuery('');
    },
    [onTagsCsvChange, tagsCsv]
  );

  const removeTag = useCallback(
    (tag: string) => {
      const cur = parseTagsCsv(tagsCsv);
      onTagsCsvChange(serializeTagsCsv(cur.filter((x) => x !== tag)));
    },
    [onTagsCsvChange, tagsCsv]
  );

  const inputDirty = dirty || suggested;

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="text"
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const q = tagQuery.trim();
                if (!q) return;
                addTag(q);
              }
            }}
            placeholder="Tags..."
            className={suggestInputClass({
              suggested: inputDirty,
              comfortableText,
              error,
            })}
            autoComplete="off"
            aria-autocomplete="list"
            aria-label={tExplore('suggestTagsSearchAria')}
            aria-invalid={Boolean(error)}
          />
          {tagSuggestions.length > 0 ? (
            <ul
              className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md glass-surface py-1 shadow-lg"
              role="listbox"
            >
              {tagSuggestions.map((t) => (
                <li key={t} role="option">
                  <button
                    type="button"
                    className="w-full px-2.5 py-1.5 text-left text-[12px] text-foreground hover:bg-border/30"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addTag(t)}
                  >
                    {t}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {tagQuery.trim() ? (
          <button
            type="button"
            onClick={() => addTag(tagQuery)}
            className="shrink-0 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-500"
          >
            {tExplore('suggestTagsValidateButton')}
          </button>
        ) : null}
      </div>
      {selectedTags.length > 0 ? (
        <div className="mb-1 flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="group relative inline-flex max-w-full items-center overflow-visible rounded-md border border-border/80 bg-surface-elevated/80 py-0.5 pl-2 pr-2.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-[#F59E0B]/50 hover:bg-surface-elevated hover:text-foreground"
              title={tExplore('suggestTagRemoveTitle')}
            >
              <span className="min-w-0 truncate">{tag}</span>
              <span
                className="pointer-events-none absolute -right-1 -top-1 z-10 flex h-3.5 w-3.5 items-center justify-center text-[11px] font-bold leading-none text-red-500 opacity-0 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)] transition-opacity group-hover:opacity-100"
                aria-hidden
              >
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <p className="mt-1 text-[10px] text-muted-foreground">
        {tExplore('suggestTagsHint')}
      </p>
      {error ? (
        <p className="mt-1 text-[10px] text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

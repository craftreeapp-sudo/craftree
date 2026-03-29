'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { ERA_ORDER } from '@/lib/node-labels';
import { PRIMARY_CARD_CATEGORY_ORDER } from '@/lib/card-primary-categories';
import {
  CHEMICAL_NATURE_ORDER,
  NATURAL_ORIGIN_ORDER,
} from '@/lib/suggest-nature-fields';
import type {
  NodeCategory,
  Era,
  NaturalOrigin,
  ChemicalNature,
} from '@/lib/types';

export type SuggestNodeFormState = {
  name: string;
  description: string;
  category: NodeCategory;
  era: Era;
  year_approx: string;
  origin: string;
  /** Tags séparés par des virgules (comme sur la fiche produit). */
  tags: string;
  naturalOrigin: NaturalOrigin | '';
  chemicalNature: ChemicalNature | '';
};

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
  form: SuggestNodeFormState;
  setForm: React.Dispatch<React.SetStateAction<SuggestNodeFormState>>;
  /** État initial après chargement ; sert à surligner les champs modifiés (bordure orangée). */
  baselineForm: SuggestNodeFormState | null;
};

function isFieldDirty(
  baseline: SuggestNodeFormState | null,
  current: SuggestNodeFormState,
  key: keyof SuggestNodeFormState
): boolean {
  if (!baseline) return false;
  return baseline[key] !== current[key];
}

function inputClass(dirty: boolean): string {
  return `w-full rounded-md border-[0.5px] bg-surface px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-[#F59E0B] ${
    dirty
      ? 'border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30'
      : 'border-border'
  }`;
}

function selectClass(dirty: boolean): string {
  return `w-full appearance-none rounded-md border-[0.5px] bg-surface px-2.5 py-2 pr-9 text-[13px] text-foreground outline-none focus:border-[#F59E0B] ${
    dirty
      ? 'border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30'
      : 'border-border'
  }`;
}

export function SuggestionNodeForm({ form, setForm, baselineForm }: Props) {
  const tCat = useTranslations('categories');
  const tEra = useTranslations('eras');
  const tSidebar = useTranslations('sidebar');
  const te = useTranslations('editor');
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
  const selectedTags = useMemo(
    () => parseTagsCsv(form.tags),
    [form.tags]
  );
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
      setForm((f) => {
        const cur = parseTagsCsv(f.tags);
        if (cur.some((c) => c.toLowerCase() === t.toLowerCase())) return f;
        return { ...f, tags: serializeTagsCsv([...cur, t]) };
      });
      setTagQuery('');
    },
    [setForm]
  );

  const removeTag = useCallback(
    (tag: string) => {
      setForm((f) => {
        const cur = parseTagsCsv(f.tags);
        return {
          ...f,
          tags: serializeTagsCsv(cur.filter((x) => x !== tag)),
        };
      });
    },
    [setForm]
  );

  const fd = (key: keyof SuggestNodeFormState) =>
    isFieldDirty(baselineForm, form, key);
  const natureDirty =
    Boolean(baselineForm) &&
    (baselineForm!.naturalOrigin !== form.naturalOrigin ||
      baselineForm!.chemicalNature !== form.chemicalNature);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('name')}</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={inputClass(fd('name'))}
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('date')}</label>
        <input
          type="text"
          inputMode="numeric"
          value={form.year_approx}
          onChange={(e) =>
            setForm((f) => ({ ...f, year_approx: e.target.value }))
          }
          className={inputClass(fd('year_approx'))}
          placeholder="—"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('category')}</label>
        <select
          value={form.category}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              category: e.target.value as NodeCategory,
            }))
          }
          className={selectClass(fd('category'))}
        >
          {PRIMARY_CARD_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {tCat(c)}
            </option>
          ))}
        </select>
      </div>

      <div
        className={`rounded-md border bg-surface/30 p-3 ${
          natureDirty
            ? 'border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30'
            : 'border-border/60'
        }`}
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {tExplore('detailTagNature')}
        </p>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              {tExplore('suggestNaturalOriginLabel')}
            </label>
            <select
              value={form.naturalOrigin}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  naturalOrigin: e.target.value as NaturalOrigin | '',
                }))
              }
              className={selectClass(fd('naturalOrigin'))}
            >
              <option value="">—</option>
              {NATURAL_ORIGIN_ORDER.map((v) => (
                <option key={v} value={v}>
                  {tExplore(`suggestNaturalOrigin_${v}` as const)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              {tExplore('suggestChemicalNatureLabel')}
            </label>
            <select
              value={form.chemicalNature}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  chemicalNature: e.target.value as ChemicalNature | '',
                }))
              }
              className={selectClass(fd('chemicalNature'))}
            >
              <option value="">—</option>
              {CHEMICAL_NATURE_ORDER.map((v) => (
                <option key={v} value={v}>
                  {tExplore(`suggestChemicalNature_${v}` as const)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {tExplore('detailTagsHeading')}
        </label>
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
              className={inputClass(fd('tags'))}
              autoComplete="off"
              aria-autocomplete="list"
              aria-label={tExplore('suggestTagsSearchAria')}
            />
            {tagSuggestions.length > 0 ? (
              <ul
                className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-md border border-border bg-surface-elevated py-1 shadow-lg"
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
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('era')}</label>
        <p className="mb-1.5 text-[10px] text-muted-foreground">{tExplore('suggestEraHint')}</p>
        <select
          value={form.era}
          onChange={(e) =>
            setForm((f) => ({ ...f, era: e.target.value as Era }))
          }
          className={selectClass(fd('era'))}
        >
          {ERA_ORDER.map((c) => (
            <option key={c} value={c}>
              {tEra(c)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('origin')}</label>
        <input
          type="text"
          value={form.origin}
          onChange={(e) =>
            setForm((f) => ({ ...f, origin: e.target.value }))
          }
          className={inputClass(fd('origin'))}
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">
          {tSidebar('description')}
        </label>
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          className={inputClass(fd('description'))}
        />
      </div>
    </div>
  );
}

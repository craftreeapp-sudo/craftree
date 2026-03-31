'use client';

import { useCallback, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useGraphStore } from '@/stores/graph-store';
import { useNodeDetailsStore } from '@/stores/node-details-store';
import { eraLabelFromMessages } from '@/lib/era-display';
import { ERA_ORDER } from '@/lib/node-labels';
import { PRIMARY_CARD_CATEGORY_ORDER } from '@/lib/card-primary-categories';
import {
  CHEMICAL_NATURE_ORDER,
  NATURAL_ORIGIN_ORDER,
} from '@/lib/suggest-nature-fields';
import {
  NodeCategory as NC,
  Era as EraEnum,
  type NodeCategory,
  type Era,
  type NaturalOrigin,
  type ChemicalNature,
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

export function createEmptySuggestNodeFormState(): SuggestNodeFormState {
  return {
    name: '',
    description: '',
    category: NC.ENERGY,
    era: EraEnum.MODERN,
    year_approx: '',
    origin: '',
    tags: '',
    naturalOrigin: '',
    chemicalNature: '',
  };
}

type Props = {
  form: SuggestNodeFormState;
  setForm: React.Dispatch<React.SetStateAction<SuggestNodeFormState>>;
  /** État initial après chargement ; sert à surligner les champs modifiés (bordure orangée). */
  baselineForm: SuggestNodeFormState | null;
  /** Image de la carte (fiche / graphe), au-dessus du champ nom. */
  cardImageUrl?: string | null;
  /** Noms de cartes existantes proches de la saisie (ex. ajout de carte). */
  similarNameMatches?: { id: string; name: string }[];
  /** Textes d’aide pour classer la carte (formulaire « ajouter une carte »). */
  showFieldHints?: boolean;
  /** Erreurs de validation par champ (ex. ajout de carte). */
  fieldErrors?: Partial<Record<keyof SuggestNodeFormState, string>>;
};

function isFieldDirty(
  baseline: SuggestNodeFormState | null,
  current: SuggestNodeFormState,
  key: keyof SuggestNodeFormState
): boolean {
  if (!baseline) return false;
  return baseline[key] !== current[key];
}

function inputClass(dirty: boolean, error?: string): string {
  if (error) {
    return 'w-full rounded-md border-[0.5px] border-red-500/80 bg-surface px-2.5 py-2 text-[13px] text-foreground outline-none ring-1 ring-red-500/35';
  }
  return `w-full rounded-md border-[0.5px] bg-surface px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-[#F59E0B] ${
    dirty
      ? 'border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30'
      : 'border-border'
  }`;
}

function selectClass(dirty: boolean, error?: string): string {
  if (error) {
    return 'w-full appearance-none rounded-md border-[0.5px] border-red-500/80 bg-surface px-2.5 py-2 pr-9 text-[13px] text-foreground outline-none ring-1 ring-red-500/35';
  }
  return `w-full appearance-none rounded-md border-[0.5px] bg-surface px-2.5 py-2 pr-9 text-[13px] text-foreground outline-none focus:border-[#F59E0B] ${
    dirty
      ? 'border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30'
      : 'border-border'
  }`;
}

export function SuggestionNodeForm({
  form,
  setForm,
  baselineForm,
  cardImageUrl = null,
  similarNameMatches,
  showFieldHints = false,
  fieldErrors,
}: Props) {
  const locale = useLocale();
  const tCat = useTranslations('categories');
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
  const natureBlockError =
    fieldErrors?.naturalOrigin || fieldErrors?.chemicalNature;

  return (
    <div className="space-y-4">
      <div>
        {cardImageUrl ? (
          <div className="mb-3 overflow-hidden rounded-lg border border-border bg-page">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cardImageUrl}
              alt=""
              className="aspect-[16/10] w-full object-cover"
            />
          </div>
        ) : null}
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('name')}</label>
        {showFieldHints ? (
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
            {te('addCardHintName')}
          </p>
        ) : null}
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={inputClass(fd('name'), fieldErrors?.name)}
          autoComplete="off"
          aria-invalid={Boolean(fieldErrors?.name)}
        />
        {fieldErrors?.name ? (
          <p className="mt-1 text-[10px] text-red-400">{fieldErrors.name}</p>
        ) : null}
        {similarNameMatches !== undefined && similarNameMatches.length > 0 ? (
          <div
            className="mt-1.5 rounded-md border border-amber-600/35 bg-amber-950/20 px-2.5 py-2"
            role="region"
            aria-label={te('similarNameMatches')}
          >
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-amber-200/90">
              {te('similarNameMatches')}
            </p>
            <ul className="max-h-36 space-y-1 overflow-y-auto" role="list">
              {similarNameMatches.map((n) => (
                <li
                  key={n.id}
                  role="listitem"
                  className="truncate text-[12px] text-foreground/95"
                >
                  {n.name}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('date')}</label>
        {showFieldHints ? (
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
            {te('addCardHintDate')}
          </p>
        ) : null}
        <input
          type="text"
          inputMode="numeric"
          value={form.year_approx}
          onChange={(e) =>
            setForm((f) => ({ ...f, year_approx: e.target.value }))
          }
          className={inputClass(fd('year_approx'), fieldErrors?.year_approx)}
          placeholder="—"
          aria-invalid={Boolean(fieldErrors?.year_approx)}
        />
        {fieldErrors?.year_approx ? (
          <p className="mt-1 text-[10px] text-red-400">
            {fieldErrors.year_approx}
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('category')}</label>
        {showFieldHints ? (
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
            {te('addCardHintCategory')}
          </p>
        ) : null}
        <select
          value={form.category}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              category: e.target.value as NodeCategory,
            }))
          }
          className={selectClass(fd('category'), fieldErrors?.category)}
          aria-invalid={Boolean(fieldErrors?.category)}
        >
          {PRIMARY_CARD_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {tCat(c)}
            </option>
          ))}
        </select>
        {fieldErrors?.category ? (
          <p className="mt-1 text-[10px] text-red-400">
            {fieldErrors.category}
          </p>
        ) : null}
      </div>

      <div
        className={`rounded-md border bg-surface/30 p-3 ${
          natureBlockError
            ? 'border-red-500/80 ring-1 ring-red-500/35'
            : natureDirty
              ? 'border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30'
              : 'border-border/60'
        }`}
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {tExplore('detailTagNature')}
        </p>
        {showFieldHints ? (
          <p className="mb-3 text-[10px] leading-snug text-muted-foreground">
            {te('addCardHintNature')}
          </p>
        ) : null}
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
              className={selectClass(
                fd('naturalOrigin'),
                fieldErrors?.naturalOrigin
              )}
              aria-invalid={Boolean(fieldErrors?.naturalOrigin)}
            >
              <option value="">—</option>
              {NATURAL_ORIGIN_ORDER.map((v) => (
                <option key={v} value={v}>
                  {tExplore(`suggestNaturalOrigin_${v}` as const)}
                </option>
              ))}
            </select>
            {fieldErrors?.naturalOrigin ? (
              <p className="mt-1 text-[10px] text-red-400">
                {fieldErrors.naturalOrigin}
              </p>
            ) : null}
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
              className={selectClass(
                fd('chemicalNature'),
                fieldErrors?.chemicalNature
              )}
              aria-invalid={Boolean(fieldErrors?.chemicalNature)}
            >
              <option value="">—</option>
              {CHEMICAL_NATURE_ORDER.map((v) => (
                <option key={v} value={v}>
                  {tExplore(`suggestChemicalNature_${v}` as const)}
                </option>
              ))}
            </select>
            {fieldErrors?.chemicalNature ? (
              <p className="mt-1 text-[10px] text-red-400">
                {fieldErrors.chemicalNature}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {tExplore('detailTagsHeading')}
        </label>
        {showFieldHints ? (
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
            {te('addCardHintTags')}
          </p>
        ) : null}
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
              className={inputClass(fd('tags'), fieldErrors?.tags)}
              autoComplete="off"
              aria-autocomplete="list"
              aria-label={tExplore('suggestTagsSearchAria')}
              aria-invalid={Boolean(fieldErrors?.tags)}
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
        {fieldErrors?.tags ? (
          <p className="mt-1 text-[10px] text-red-400">{fieldErrors.tags}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('era')}</label>
        <p className="mb-1.5 text-[10px] text-muted-foreground">
          {showFieldHints ? te('addCardHintEra') : tExplore('suggestEraHint')}
        </p>
        <select
          value={form.era}
          onChange={(e) =>
            setForm((f) => ({ ...f, era: e.target.value as Era }))
          }
          title={eraLabelFromMessages(locale, form.era)}
          className={selectClass(fd('era'), fieldErrors?.era)}
          aria-invalid={Boolean(fieldErrors?.era)}
        >
          {ERA_ORDER.map((c) => (
            <option key={c} value={c}>
              {eraLabelFromMessages(locale, c)}
            </option>
          ))}
        </select>
        {fieldErrors?.era ? (
          <p className="mt-1 text-[10px] text-red-400">{fieldErrors.era}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('origin')}</label>
        {showFieldHints ? (
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
            {te('addCardHintOrigin')}
          </p>
        ) : null}
        <input
          type="text"
          value={form.origin}
          onChange={(e) =>
            setForm((f) => ({ ...f, origin: e.target.value }))
          }
          className={inputClass(fd('origin'), fieldErrors?.origin)}
          aria-invalid={Boolean(fieldErrors?.origin)}
        />
        {fieldErrors?.origin ? (
          <p className="mt-1 text-[10px] text-red-400">{fieldErrors.origin}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">
          {tSidebar('description')}
        </label>
        {showFieldHints ? (
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
            {te('addCardHintDescription')}
          </p>
        ) : null}
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
          className={inputClass(fd('description'), fieldErrors?.description)}
          aria-invalid={Boolean(fieldErrors?.description)}
        />
        {fieldErrors?.description ? (
          <p className="mt-1 text-[10px] text-red-400">
            {fieldErrors.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

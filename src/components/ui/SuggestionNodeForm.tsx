'use client';

import { useLocale, useTranslations } from 'next-intl';
import { eraLabelFromMessages } from '@/lib/era-display';
import { ERA_ORDER } from '@/lib/node-labels';
import { PRIMARY_CARD_CATEGORY_ORDER } from '@/lib/card-primary-categories';
import {
  CHEMICAL_NATURE_ORDER,
  NATURAL_ORIGIN_ORDER,
} from '@/lib/suggest-nature-fields';
import {
  suggestFormLabelClass,
  suggestFormLabelSectionClass,
  suggestFormNatureSectionTitleClass,
  suggestInputClass,
  suggestNatureBlockWrapClass,
  suggestSelectClass,
} from '@/components/ui/suggest-form-classes';
import { SuggestionTagsField } from '@/components/ui/SuggestionTagsField';
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

  const fd = (key: keyof SuggestNodeFormState) =>
    isFieldDirty(baselineForm, form, key);
  const natureDirty =
    Boolean(baselineForm) &&
    (baselineForm!.naturalOrigin !== form.naturalOrigin ||
      baselineForm!.chemicalNature !== form.chemicalNature);
  const natureBlockError =
    fieldErrors?.naturalOrigin || fieldErrors?.chemicalNature;

  const inputClass = (dirty: boolean, error?: string) =>
    suggestInputClass({ suggested: dirty, error, comfortableText: false });
  const selectClass = (dirty: boolean, error?: string) =>
    suggestSelectClass({ suggested: dirty, error, comfortableText: false });

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
        <label className={suggestFormLabelClass(false)}>{te('name')}</label>
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
        <label className={suggestFormLabelClass(false)}>{te('date')}</label>
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
        <label className={suggestFormLabelClass(false)}>{te('category')}</label>
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
        className={suggestNatureBlockWrapClass({
          error: Boolean(natureBlockError),
          suggested: natureDirty && !natureBlockError,
        })}
      >
        <p className={suggestFormNatureSectionTitleClass(false)}>
          {tExplore('detailTagNature')}
        </p>
        {showFieldHints ? (
          <p className="mb-3 text-[10px] leading-snug text-muted-foreground">
            {te('addCardHintNature')}
          </p>
        ) : null}
        <div className="space-y-3">
          <div>
            <label className={suggestFormLabelClass(false)}>
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
            <label className={suggestFormLabelClass(false)}>
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
        <label className={suggestFormLabelSectionClass(false)}>
          {tExplore('detailTagsHeading')}
        </label>
        {showFieldHints ? (
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
            {te('addCardHintTags')}
          </p>
        ) : null}
        <SuggestionTagsField
          tagsCsv={form.tags}
          onTagsCsvChange={(csv) =>
            setForm((f) => ({ ...f, tags: csv }))
          }
          dirty={fd('tags')}
          error={fieldErrors?.tags}
        />
      </div>

      <div>
        <label className={suggestFormLabelClass(false)}>{te('era')}</label>
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
        <label className={suggestFormLabelClass(false)}>{te('origin')}</label>
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
        <label className={suggestFormLabelClass(false)}>
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

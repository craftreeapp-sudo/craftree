'use client';

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslations } from 'next-intl';
import {
  NODE_CATEGORY_ORDER,
  ERA_DATE_RANGES,
  ERA_ORDER,
  TECH_NODE_TYPE_ORDER,
} from '@/lib/node-labels';
import { slugify } from '@/lib/utils';
import {
  NodeCategory as NC,
  Era as EraEnum,
  RelationType as RT,
  type CraftingLink,
  type NodeCategory,
  type RelationType,
  type SeedNode,
  type TechNodeType,
  type Era,
} from '@/lib/types';
import { SearchableSelect, type SearchableOption } from './SearchableSelect';
import {
  RELATION_BADGE_COLORS,
  RELATION_TYPES_LIST,
} from './editor-relation-styles';
import { ImageUploader } from '@/components/ui/ImageUploader';

export interface NodeEditFormState {
  name: string;
  name_en: string;
  description: string;
  category: NodeCategory;
  type: TechNodeType;
  era: Era;
  year_approx: string;
  origin: string;
  tags: string;
  wikipedia_url: string;
}

export function createEmptyFormState(): NodeEditFormState {
  return {
    name: '',
    name_en: '',
    description: '',
    category: NC.MATERIAL,
    type: 'component' as TechNodeType,
    era: EraEnum.MODERN,
    year_approx: '',
    origin: '',
    tags: '',
    wikipedia_url: '',
  };
}

export function seedNodeToFormState(n: SeedNode): NodeEditFormState {
  return {
    name: n.name,
    name_en: n.name_en ?? '',
    description: n.description ?? '',
    category: n.category as NodeCategory,
    type: n.type as TechNodeType,
    era: n.era as Era,
    year_approx:
      n.year_approx === null || n.year_approx === undefined
        ? ''
        : String(n.year_approx),
    origin: n.origin ?? '',
    tags: (n.tags ?? []).join(', '),
    wikipedia_url: n.wikipedia_url ?? '',
  };
}

type Props = {
  editingId: string | null;
  form: NodeEditFormState;
  setForm: React.Dispatch<React.SetStateAction<NodeEditFormState>>;
  nodes: SeedNode[];
  links: CraftingLink[];
  onRefreshData: () => Promise<void>;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  /** Affiche les boutons Sauvegarder / Annuler (false si gérés ailleurs) */
  showFooter?: boolean;
  /** Upload image (édition seulement) */
  currentImageUrl?: string | null;
  onImageUploadSuccess?: (url: string) => void;
};

export function NodeEditForm({
  editingId,
  form,
  setForm,
  nodes,
  links,
  onRefreshData,
  onSave,
  onCancel,
  showFooter = true,
  currentImageUrl = null,
  onImageUploadSuccess,
}: Props) {
  const te = useTranslations('editor');
  const tCat = useTranslations('categories');
  const tEra = useTranslations('eras');
  const tType = useTranslations('types');
  const tRel = useTranslations('relationTypes');
  const tc = useTranslations('common');

  const previewId = editingId ?? slugify(form.name);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  const nodeOptions: SearchableOption[] = useMemo(
    () =>
      [...nodes]
        .filter((n) => (editingId ? n.id !== editingId : true))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
        .map((n) => ({
          value: n.id,
          label: n.name,
          category: n.category as NodeCategory,
        })),
    [nodes, editingId]
  );

  const incomingLinks = useMemo(
    () =>
      editingId
        ? links.filter((l) => l.target_id === editingId)
        : [],
    [links, editingId]
  );

  const outgoingLinks = useMemo(
    () =>
      editingId
        ? links.filter((l) => l.source_id === editingId)
        : [],
    [links, editingId]
  );

  const [builtSource, setBuiltSource] = useState('');
  const [builtRel, setBuiltRel] = useState<RelationType>(RT.MATERIAL);
  const [ledRel, setLedRel] = useState<RelationType>(RT.MATERIAL);
  const [ledTarget, setLedTarget] = useState('');
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const syncDescriptionHeight = useCallback(() => {
    const el = descriptionRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    syncDescriptionHeight();
  }, [form.description, editingId, syncDescriptionHeight]);

  const addBuiltUpon = useCallback(async () => {
    if (!editingId || !builtSource || builtSource === editingId) return;
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: builtSource,
        target_id: editingId,
        relation_type: builtRel,
      }),
    });
    if (res.ok) {
      setBuiltSource('');
      setBuiltRel(RT.MATERIAL);
      await onRefreshData();
    }
  }, [editingId, builtSource, builtRel, onRefreshData, setBuiltSource, setBuiltRel]);

  const addLedTo = useCallback(async () => {
    if (!editingId || !ledTarget || ledTarget === editingId) return;
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: editingId,
        target_id: ledTarget,
        relation_type: ledRel,
      }),
    });
    if (res.ok) {
      setLedTarget('');
      setLedRel(RT.MATERIAL);
      await onRefreshData();
    }
  }, [editingId, ledTarget, ledRel, onRefreshData, setLedTarget, setLedRel]);

  const removeLink = useCallback(
    async (linkId: string) => {
      const res = await fetch(`/api/links/${encodeURIComponent(linkId)}`, {
        method: 'DELETE',
      });
      if (res.ok) await onRefreshData();
    },
    [onRefreshData]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {te('labelName')}
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {te('idPreview', { id: previewId || '—' })}
          </p>
        </div>
        {editingId && onImageUploadSuccess ? (
          <div className="w-full">
            <label className="mb-1 block text-xs text-muted-foreground">
              {te('imageLabel')}
            </label>
            <ImageUploader
              nodeId={editingId}
              currentImageUrl={currentImageUrl}
              onUploadSuccess={onImageUploadSuccess}
              size="medium"
            />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {te('labelCategory')}
          </label>
          <select
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                category: e.target.value as NodeCategory,
              }))
            }
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {NODE_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {tCat(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {te('labelType')}
          </label>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value as TechNodeType,
              }))
            }
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {TECH_NODE_TYPE_ORDER.map((nt) => (
              <option key={nt} value={nt}>
                {tType(nt)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {te('labelEra')}
          </label>
          <select
            value={form.era}
            onChange={(e) =>
              setForm((f) => ({ ...f, era: e.target.value as Era }))
            }
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {ERA_ORDER.map((era) => (
              <option key={era} value={era}>
                {tEra(era)} ({ERA_DATE_RANGES[era]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{te('date')}</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.year_approx}
            onChange={(e) =>
              setForm((f) => ({ ...f, year_approx: e.target.value }))
            }
            placeholder={te('datePlaceholder')}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{te('origin')}</label>
          <input
            value={form.origin}
            onChange={(e) =>
              setForm((f) => ({ ...f, origin: e.target.value }))
            }
            placeholder={te('originPlaceholder')}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {te('labelDescription')}
          </label>
          <textarea
            ref={descriptionRef}
            rows={1}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder={te('descriptionPlaceholder')}
            className="min-h-[3rem] w-full resize-none overflow-hidden rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{te('tags')}</label>
          <input
            value={form.tags}
            onChange={(e) =>
              setForm((f) => ({ ...f, tags: e.target.value }))
            }
            placeholder={te('tagsPlaceholder')}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {te('wikipediaUrl')}
          </label>
          <input
            type="url"
            value={form.wikipedia_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, wikipedia_url: e.target.value }))
            }
            placeholder={te('wikipediaPlaceholder')}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{te('nameEn')}</label>
          <input
            value={form.name_en}
            onChange={(e) =>
              setForm((f) => ({ ...f, name_en: e.target.value }))
            }
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {editingId ? (
          <>
            <hr className="border-border" />
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {te('builtUponSection')}
              </h3>
              <ul className="mb-3 space-y-2">
                {incomingLinks.map((l) => {
                  const src = nodeById.get(l.source_id);
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-2 rounded border border-border bg-surface/60 px-2 py-1.5"
                    >
                      <span
                        className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${RELATION_BADGE_COLORS[l.relation_type]}`}
                      >
                        {tRel(l.relation_type)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {src?.name ?? l.source_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeLink(l.id)}
                        className="shrink-0 rounded p-1 text-[#EF4444] transition-colors hover:text-[#F87171]"
                        aria-label={te('removeLinkAria')}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[120px] flex-1">
                  <SearchableSelect
                    options={nodeOptions}
                    value={builtSource}
                    onChange={setBuiltSource}
                    placeholder={te('placeholderInventionSource')}
                  />
                </div>
                <div className="w-[130px]">
                  <select
                    value={builtRel}
                    onChange={(e) =>
                      setBuiltRel(e.target.value as RelationType)
                    }
                    className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-xs text-foreground outline-none focus:border-accent"
                  >
                    {RELATION_TYPES_LIST.map((r) => (
                      <option key={r} value={r}>
                        {tRel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void addBuiltUpon()}
                  className="rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white hover:bg-[#2563eb]"
                >
                  {te('addLink')}
                </button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {te('ledToSection')}
              </h3>
              <ul className="mb-3 space-y-2">
                {outgoingLinks.map((l) => {
                  const tgt = nodeById.get(l.target_id);
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-2 rounded border border-border bg-surface/60 px-2 py-1.5"
                    >
                      <span
                        className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${RELATION_BADGE_COLORS[l.relation_type]}`}
                      >
                        {tRel(l.relation_type)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {tgt?.name ?? l.target_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeLink(l.id)}
                        className="shrink-0 rounded p-1 text-[#EF4444] transition-colors hover:text-[#F87171]"
                        aria-label={te('removeLinkAria')}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-[130px]">
                  <select
                    value={ledRel}
                    onChange={(e) =>
                      setLedRel(e.target.value as RelationType)
                    }
                    className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-xs text-foreground outline-none focus:border-accent"
                  >
                    {RELATION_TYPES_LIST.map((r) => (
                      <option key={r} value={r}>
                        {tRel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[120px] flex-1">
                  <SearchableSelect
                    options={nodeOptions}
                    value={ledTarget}
                    onChange={setLedTarget}
                    placeholder={te('placeholderInventionTarget')}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void addLedTo()}
                  className="rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white hover:bg-[#2563eb]"
                >
                  {te('addLink')}
                </button>
              </div>
            </section>
          </>
        ) : null}

        <hr className="border-border" />
      </div>

      {showFooter ? (
        <div className="mt-4 flex shrink-0 gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => void onSave()}
            className="flex-1 rounded-lg bg-[#3B82F6] py-2 text-sm font-medium text-white hover:bg-[#2563eb]"
          >
            {tc('save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm text-muted-foreground hover:bg-border"
          >
            {tc('cancel')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

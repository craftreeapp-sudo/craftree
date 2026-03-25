'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  NODE_CATEGORY_LABELS_FR,
  NODE_CATEGORY_ORDER,
  ERA_LABELS_FR,
  ERA_DATE_RANGES,
  ERA_ORDER,
  TECH_NODE_TYPE_LABELS_FR,
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
  }, [editingId, builtSource, builtRel, onRefreshData]);

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
  }, [editingId, ledTarget, ledRel, onRefreshData]);

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
          <label className="mb-1 block text-xs text-[#8B95A8]">Nom *</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm text-[#E8ECF4] outline-none focus:border-[#3B82F6]"
          />
          <p className="mt-1 text-xs text-[#5A6175]">id: {previewId || '—'}</p>
        </div>
        {editingId && onImageUploadSuccess ? (
          <div className="w-full">
            <label className="mb-1 block text-xs text-[#8B95A8]">Image</label>
            <ImageUploader
              nodeId={editingId}
              currentImageUrl={currentImageUrl}
              onUploadSuccess={onImageUploadSuccess}
              size="medium"
            />
          </div>
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-[#8B95A8]">Catégorie *</label>
          <select
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                category: e.target.value as NodeCategory,
              }))
            }
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
          >
            {NODE_CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {NODE_CATEGORY_LABELS_FR[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B95A8]">Type *</label>
          <select
            value={form.type}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                type: e.target.value as TechNodeType,
              }))
            }
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
          >
            {TECH_NODE_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {TECH_NODE_TYPE_LABELS_FR[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B95A8]">Époque *</label>
          <select
            value={form.era}
            onChange={(e) =>
              setForm((f) => ({ ...f, era: e.target.value as Era }))
            }
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
          >
            {ERA_ORDER.map((e) => (
              <option key={e} value={e}>
                {ERA_LABELS_FR[e]} ({ERA_DATE_RANGES[e]})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B95A8]">Date</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.year_approx}
            onChange={(e) =>
              setForm((f) => ({ ...f, year_approx: e.target.value }))
            }
            placeholder="ex: 1954 ou -3000"
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B95A8]">Origine</label>
          <input
            value={form.origin}
            onChange={(e) =>
              setForm((f) => ({ ...f, origin: e.target.value }))
            }
            placeholder="Inventeur, entreprise ou pays"
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B95A8]">Description *</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            placeholder="Description courte (2–3 phrases)"
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B95A8]">Tags</label>
          <input
            value={form.tags}
            onChange={(e) =>
              setForm((f) => ({ ...f, tags: e.target.value }))
            }
            placeholder="tag1, tag2, tag3"
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B95A8]">URL Wikipedia</label>
          <input
            type="url"
            value={form.wikipedia_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, wikipedia_url: e.target.value }))
            }
            placeholder="https://fr.wikipedia.org/wiki/..."
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#8B95A8]">Nom (EN)</label>
          <input
            value={form.name_en}
            onChange={(e) =>
              setForm((f) => ({ ...f, name_en: e.target.value }))
            }
            className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-3 py-2 text-sm outline-none focus:border-[#3B82F6]"
          />
        </div>

        {editingId ? (
          <>
            <hr className="border-[#2A3042]" />
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8B95A8]">
                Obtenu grâce à
              </h3>
              <ul className="mb-3 space-y-2">
                {incomingLinks.map((l) => {
                  const src = nodeById.get(l.source_id);
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-2 rounded border border-[#2A3042] bg-[#111827]/60 px-2 py-1.5"
                    >
                      <span
                        className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${RELATION_BADGE_COLORS[l.relation_type]}`}
                      >
                        {String(l.relation_type).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-[#E8ECF4]">
                        {src?.name ?? l.source_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeLink(l.id)}
                        className="shrink-0 rounded p-1 text-[#EF4444] transition-colors hover:text-[#F87171]"
                        aria-label="Supprimer le lien"
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
                    placeholder="Invention source"
                  />
                </div>
                <div className="w-[130px]">
                  <select
                    value={builtRel}
                    onChange={(e) =>
                      setBuiltRel(e.target.value as RelationType)
                    }
                    className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-2 py-2 text-xs text-[#E8ECF4] outline-none focus:border-[#3B82F6]"
                  >
                    {RELATION_TYPES_LIST.map((r) => (
                      <option key={r} value={r}>
                        {String(r).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => void addBuiltUpon()}
                  className="rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white hover:bg-[#2563eb]"
                >
                  + Ajouter
                </button>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#8B95A8]">
                A conduit à
              </h3>
              <ul className="mb-3 space-y-2">
                {outgoingLinks.map((l) => {
                  const tgt = nodeById.get(l.target_id);
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-2 rounded border border-[#2A3042] bg-[#111827]/60 px-2 py-1.5"
                    >
                      <span
                        className={`inline-block shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${RELATION_BADGE_COLORS[l.relation_type]}`}
                      >
                        {String(l.relation_type).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-[#E8ECF4]">
                        {tgt?.name ?? l.target_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => void removeLink(l.id)}
                        className="shrink-0 rounded p-1 text-[#EF4444] transition-colors hover:text-[#F87171]"
                        aria-label="Supprimer le lien"
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
                    className="w-full rounded-lg border border-[#2A3042] bg-[#111827] px-2 py-2 text-xs text-[#E8ECF4] outline-none focus:border-[#3B82F6]"
                  >
                    {RELATION_TYPES_LIST.map((r) => (
                      <option key={r} value={r}>
                        {String(r).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[120px] flex-1">
                  <SearchableSelect
                    options={nodeOptions}
                    value={ledTarget}
                    onChange={setLedTarget}
                    placeholder="Invention cible"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void addLedTo()}
                  className="rounded-lg bg-[#3B82F6] px-3 py-2 text-xs font-medium text-white hover:bg-[#2563eb]"
                >
                  + Ajouter
                </button>
              </div>
            </section>
          </>
        ) : null}

        <hr className="border-[#2A3042]" />
      </div>

      {showFooter ? (
        <div className="mt-4 flex shrink-0 gap-2 border-t border-[#2A3042] pt-4">
          <button
            type="button"
            onClick={() => void onSave()}
            className="flex-1 rounded-lg bg-[#3B82F6] py-2 text-sm font-medium text-white hover:bg-[#2563eb]"
          >
            Sauvegarder
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[#2A3042] bg-transparent px-4 py-2 text-sm text-[#8B95A8] hover:bg-[#2A3042]"
          >
            Annuler
          </button>
        </div>
      ) : null}
    </div>
  );
}

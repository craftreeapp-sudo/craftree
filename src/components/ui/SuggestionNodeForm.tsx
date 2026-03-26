'use client';

import { useTranslations } from 'next-intl';
import {
  NODE_CATEGORY_ORDER,
  ERA_ORDER,
  TECH_NODE_TYPE_ORDER,
} from '@/lib/node-labels';
import type { NodeCategory, TechNodeType, Era } from '@/lib/types';

export type SuggestNodeFormState = {
  name: string;
  description: string;
  category: NodeCategory;
  type: TechNodeType;
  era: Era;
  year_approx: string;
  origin: string;
};

const SELECT =
  'w-full appearance-none rounded-md border-[0.5px] border-border bg-surface px-2.5 py-2 pr-9 text-[13px] text-foreground outline-none focus:border-[#F59E0B]';

type Props = {
  form: SuggestNodeFormState;
  setForm: React.Dispatch<React.SetStateAction<SuggestNodeFormState>>;
};

export function SuggestionNodeForm({ form, setForm }: Props) {
  const tCat = useTranslations('categories');
  const tType = useTranslations('types');
  const tEra = useTranslations('eras');
  const tSidebar = useTranslations('sidebar');
  const te = useTranslations('editor');

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('name')}</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="w-full rounded-md border-[0.5px] border-border bg-surface px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-[#F59E0B]"
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
          className="w-full rounded-md border-[0.5px] border-border bg-surface px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-[#F59E0B]"
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
          className={SELECT}
        >
          {NODE_CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {tCat(c)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('type')}</label>
        <select
          value={form.type}
          onChange={(e) =>
            setForm((f) => ({ ...f, type: e.target.value as TechNodeType }))
          }
          className={SELECT}
        >
          {TECH_NODE_TYPE_ORDER.map((c) => (
            <option key={c} value={c}>
              {tType(c)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('era')}</label>
        <select
          value={form.era}
          onChange={(e) =>
            setForm((f) => ({ ...f, era: e.target.value as Era }))
          }
          className={SELECT}
        >
          {ERA_ORDER.map((c) => (
            <option key={c} value={c}>
              {tEra(c)}
            </option>
          ))}
        </select>
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
          className="w-full rounded-md border-[0.5px] border-border bg-surface px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-[#F59E0B]"
          placeholder="—"
        />
      </div>
      <div>
        <label className="mb-1 block text-[11px] text-muted-foreground">{te('origin')}</label>
        <input
          type="text"
          value={form.origin}
          onChange={(e) =>
            setForm((f) => ({ ...f, origin: e.target.value }))
          }
          className="w-full rounded-md border-[0.5px] border-border bg-surface px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-[#F59E0B]"
        />
      </div>
    </div>
  );
}

'use client';

import { RelationType as RT, type RelationType } from '@/lib/types';

const ITEMS: { type: RelationType; label: string; color: string }[] = [
  { type: RT.MATERIAL, label: 'Matériau', color: '#14B8A6' },
  { type: RT.TOOL, label: 'Outil', color: '#A78BFA' },
  { type: RT.ENERGY, label: 'Énergie', color: '#EF4444' },
  { type: RT.KNOWLEDGE, label: 'Connaissance', color: '#38BDF8' },
  { type: RT.CATALYST, label: 'Catalyseur', color: '#8B95A8' },
];

type Props = {
  onPick: (relationType: RelationType) => void;
};

export function RelationTypePicker({ onPick }: Props) {
  return (
    <div className="px-3 pb-3 pt-2">
      <p className="mb-2 text-xs font-medium text-[#8B95A8]">
        Type de relation
      </p>
      <div className="flex flex-wrap gap-2">
        {ITEMS.map(({ type, label, color }) => (
          <button
            key={type}
            type="button"
            onClick={() => onPick(type)}
            className="flex items-center gap-1.5 rounded-md border border-[#2A3042] bg-[#111827] px-2 py-1.5 text-xs font-medium text-[#E8ECF4] transition-colors hover:border-[#3B82F6] hover:bg-[#1A1F2E]"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: color }}
            />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

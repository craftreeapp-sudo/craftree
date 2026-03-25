import { RelationType as RT, type RelationType } from '@/lib/types';

export const RELATION_BADGE_COLORS: Record<RelationType, string> = {
  [RT.MATERIAL]: 'bg-teal-500/20 text-teal-200 border-teal-500/40',
  [RT.TOOL]: 'bg-violet-500/20 text-violet-200 border-violet-500/40',
  [RT.ENERGY]: 'bg-red-500/20 text-red-200 border-red-500/40',
  [RT.KNOWLEDGE]: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
  [RT.CATALYST]: 'bg-slate-500/20 text-slate-200 border-slate-500/40',
};

export const RELATION_TYPES_LIST = [
  RT.MATERIAL,
  RT.TOOL,
  RT.ENERGY,
  RT.KNOWLEDGE,
  RT.CATALYST,
] as const;

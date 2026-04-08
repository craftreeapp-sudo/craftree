import type { MaterialLevel, NodeDimension } from '@/lib/types';

/** Clés i18n `editor.*` pour les sélecteurs et le tableau. */
export const EDITOR_DIM_KEY: Record<
  NodeDimension,
  | 'dimensionMatter'
  | 'dimensionComposant'
  | 'dimensionTool'
  | 'dimensionEnergy'
  | 'dimensionProcess'
  | 'dimensionInfrastructure'
> = {
  matter: 'dimensionMatter',
  composant: 'dimensionComposant',
  tool: 'dimensionTool',
  energy: 'dimensionEnergy',
  process: 'dimensionProcess',
  infrastructure: 'dimensionInfrastructure',
};

export const EDITOR_LEVEL_KEY: Record<
  MaterialLevel,
  'levelRaw' | 'levelProcessed' | 'levelIndustrial' | 'levelComponent'
> = {
  raw: 'levelRaw',
  processed: 'levelProcessed',
  industrial: 'levelIndustrial',
  component: 'levelComponent',
};

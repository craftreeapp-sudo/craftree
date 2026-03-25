import { create } from 'zustand';
import type { TechNodeDetails } from '@/lib/types';
import type { SeedNode } from '@/lib/types';

type DetailsMap = Record<string, TechNodeDetails>;

function buildDetailsMap(nodes: SeedNode[]): DetailsMap {
  const m: DetailsMap = {};
  for (const n of nodes) {
    m[n.id] = {
      name_en: n.name_en ?? '',
      description: n.description ?? '',
      image_url: n.image_url,
      wikipedia_url: n.wikipedia_url,
      origin: n.origin,
      tags: n.tags,
      ...(n._ai_built_upon ? { _ai_built_upon: n._ai_built_upon } : {}),
      ...(n._ai_led_to ? { _ai_led_to: n._ai_led_to } : {}),
    };
  }
  return m;
}

interface NodeDetailsStore {
  byId: DetailsMap;
  /** Conservé pour compat ; les détails viennent de getNodeDetails + mergeDetail. */
  load: () => Promise<void>;
  /** Après édition / refresh API */
  hydrateFromSeedNodes: (nodes: SeedNode[]) => void;
  /** Détails chargés depuis nodes-details.json ou API partielle */
  mergeDetail: (id: string, detail: TechNodeDetails) => void;
  /** Un nœud créé depuis le graphe (sans recharger tout le seed). */
  mergeNodeDetail: (node: SeedNode) => void;
  /** Mise à jour partielle (ex. image après upload). */
  patchDetail: (id: string, patch: Partial<TechNodeDetails>) => void;
}

export const useNodeDetailsStore = create<NodeDetailsStore>((set) => ({
  byId: {},
  load: async () => {},

  hydrateFromSeedNodes: (nodes) => {
    set({ byId: buildDetailsMap(nodes) });
  },

  mergeDetail: (id, detail) =>
    set((s) => ({
      byId: {
        ...s.byId,
        [id]: { ...(s.byId[id] ?? {}), ...detail } as TechNodeDetails,
      },
    })),

  mergeNodeDetail: (node) =>
    set((s) => ({
      byId: {
        ...s.byId,
        [node.id]: {
          name_en: node.name_en ?? '',
          description: node.description ?? '',
          image_url: node.image_url,
          wikipedia_url: node.wikipedia_url,
          origin: node.origin,
          tags: node.tags,
          ...(node._ai_built_upon ? { _ai_built_upon: node._ai_built_upon } : {}),
          ...(node._ai_led_to ? { _ai_led_to: node._ai_led_to } : {}),
        },
      },
    })),

  patchDetail: (id, patch) =>
    set((s) => {
      const cur = s.byId[id] ?? {
        name_en: '',
        description: '',
        image_url: undefined,
        wikipedia_url: undefined,
      };
      return {
        byId: {
          ...s.byId,
          [id]: { ...cur, ...patch },
        },
      };
    }),
}));

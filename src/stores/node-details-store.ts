import { create } from 'zustand';
import type { TechNodeDetails } from '@/lib/types';
import type { SeedNode } from '@/lib/types';

type DetailsMap = Record<string, TechNodeDetails>;

function buildDetailsMap(nodes: SeedNode[]): DetailsMap {
  const m: DetailsMap = {};
  for (const n of nodes) {
    m[n.id] = seedNodeToDetailEntry(n);
  }
  return m;
}

function seedNodeToDetailEntry(n: SeedNode): TechNodeDetails {
  return {
    name_en: n.name_en ?? '',
    description: n.description ?? '',
    description_en: n.description_en,
    image_url: n.image_url,
    wikipedia_url: n.wikipedia_url,
    origin: n.origin,
    tags: n.tags,
    ...(n._ai_built_upon ? { _ai_built_upon: n._ai_built_upon } : {}),
    ...(n._ai_led_to ? { _ai_led_to: n._ai_led_to } : {}),
  };
}

/**
 * L’hydratation graphe utilise souvent une projection minimale (sans textes longs).
 * On conserve les champs déjà chargés via /api/nodes/[id] pour ne pas effacer le panneau détail.
 */
function mergeHydratePreserve(
  prev: TechNodeDetails | undefined,
  incoming: TechNodeDetails
): TechNodeDetails {
  if (!prev) return incoming;
  const out = { ...incoming };
  if (!incoming.description?.trim() && prev.description?.trim()) {
    out.description = prev.description;
  }
  if (!incoming.description_en?.trim() && prev.description_en?.trim()) {
    out.description_en = prev.description_en;
  }
  if (!incoming.name_en?.trim() && prev.name_en?.trim()) {
    out.name_en = prev.name_en;
  }
  if (!incoming.wikipedia_url?.trim() && prev.wikipedia_url?.trim()) {
    out.wikipedia_url = prev.wikipedia_url;
  }
  if (!incoming.origin?.trim() && prev.origin?.trim()) {
    out.origin = prev.origin;
  }
  if ((!incoming.tags || incoming.tags.length === 0) && prev.tags?.length) {
    out.tags = prev.tags;
  }
  return out;
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
    set((s) => {
      const out: DetailsMap = {};
      for (const n of nodes) {
        const incoming = seedNodeToDetailEntry(n);
        out[n.id] = mergeHydratePreserve(s.byId[n.id], incoming);
      }
      return { byId: out };
    });
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
          description_en: node.description_en,
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

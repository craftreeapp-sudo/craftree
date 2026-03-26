import nodesDetails from '@/data/nodes-details.json';

const details = nodesDetails as unknown as Record<
  string,
  { name_en?: string }
>;

/** Nom anglais depuis nodes-details (pour affichage hors FR). */
export function getNameEnForNode(id: string): string | undefined {
  const en = details[id]?.name_en?.trim();
  return en || undefined;
}

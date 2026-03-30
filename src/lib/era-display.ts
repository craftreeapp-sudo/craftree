import type { Era } from '@/lib/types';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';

/**
 * Libellé d’époque (nom + plages entre parenthèses) pour l’UI.
 * Lit directement les JSON pour que les `<option>` et listes affichent toujours
 * le texte complet — aligné sur `src/i18n/request.ts` (messages FR ou EN).
 */
export function eraLabelFromMessages(appLocale: string, era: Era): string {
  const table = appLocale === 'fr' ? fr.eras : en.eras;
  const raw = table[era as keyof typeof table];
  return typeof raw === 'string' ? raw : era;
}

/**
 * Styles alignés sur `SuggestionNodeForm` (modal Ajouter une carte).
 * Variante `suggested` = même surlignage que « champ modifié » (bordure ambre).
 */
export function suggestFormLabelClass(comfortableText: boolean) {
  return comfortableText
    ? 'mb-1 block text-[13px] text-muted-foreground'
    : 'mb-1 block text-[11px] text-muted-foreground';
}

export function suggestFormNatureSectionTitleClass(comfortableText: boolean) {
  return comfortableText
    ? 'mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground'
    : 'mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground';
}

export function suggestFormLabelSectionClass(comfortableText: boolean) {
  return comfortableText
    ? 'mb-1 block text-[13px] font-semibold uppercase tracking-wider text-muted-foreground'
    : 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground';
}

export function suggestInputClass(opts: {
  suggested?: boolean;
  comfortableText?: boolean;
  error?: string;
}) {
  const size = opts.comfortableText ? 'text-[15px]' : 'text-[13px]';
  const base = `w-full rounded-md border-[0.5px] bg-surface px-2.5 py-2 ${size} text-foreground outline-none`;
  if (opts.error) {
    return `${base} border-red-500/80 ring-1 ring-red-500/35`;
  }
  if (opts.suggested) {
    return `${base} border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30`;
  }
  return `${base} border-border focus:border-[#F59E0B]`;
}

export function suggestSelectClass(opts: {
  suggested?: boolean;
  comfortableText?: boolean;
  error?: string;
}) {
  const size = opts.comfortableText ? 'text-[15px]' : 'text-[13px]';
  const base = `w-full appearance-none rounded-md border-[0.5px] bg-surface px-2.5 py-2 pr-9 ${size} text-foreground outline-none`;
  if (opts.error) {
    return `${base} border-red-500/80 ring-1 ring-red-500/35`;
  }
  if (opts.suggested) {
    return `${base} border-[#F59E0B]/80 ring-1 ring-[#F59E0B]/30`;
  }
  return `${base} border-border focus:border-[#F59E0B]`;
}

export function suggestNatureBlockWrapClass(opts: {
  suggested?: boolean;
  error?: boolean;
}) {
  if (opts.error) {
    return 'rounded-md border border-red-500/80 bg-surface/30 p-3 ring-1 ring-red-500/35';
  }
  if (opts.suggested) {
    return 'rounded-md border border-[#F59E0B]/80 bg-surface/30 p-3 ring-1 ring-[#F59E0B]/30';
  }
  return 'rounded-md border border-border/60 bg-surface/30 p-3';
}

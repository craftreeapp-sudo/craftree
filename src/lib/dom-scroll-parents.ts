/**
 * Ancêtres d’un élément susceptibles d’émettre des événements `scroll`
 * (overflow auto / scroll / overlay sur au moins un axe).
 */
export function getScrollableAncestors(el: HTMLElement | null): HTMLElement[] {
  const out: HTMLElement[] = [];
  let p: HTMLElement | null = el;
  while (p) {
    const st = getComputedStyle(p);
    const oy = st.overflowY;
    const ox = st.overflowX;
    const o = st.overflow;
    const scrollableY =
      /(auto|scroll|overlay)/.test(oy) || /(auto|scroll|overlay)/.test(o);
    const scrollableX =
      /(auto|scroll|overlay)/.test(ox) || /(auto|scroll|overlay)/.test(o);
    if (scrollableY || scrollableX) {
      out.push(p);
    }
    p = p.parentElement;
  }
  return out;
}

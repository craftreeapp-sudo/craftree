/** Pool concurrent avec espacement minimal entre le début de chaque tâche. */
export async function mapPoolWithStagger<T, R>(
  items: T[],
  poolSize: number,
  staggerMs: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  let lastStart = -Infinity;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      const gap = Math.max(0, lastStart + staggerMs - Date.now());
      await new Promise((r) => setTimeout(r, gap));
      lastStart = Date.now();
      results[i] = await fn(items[i]!, i);
    }
  }

  const n = Math.min(poolSize, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}

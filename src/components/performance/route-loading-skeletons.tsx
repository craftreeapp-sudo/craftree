/**
 * Squelettes pour imports dynamiques : réserve l’espace (CLS) pendant le chargement des chunks lourds.
 */

export function TreeExploreSkeleton() {
  return (
    <main
      className="relative flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col overflow-hidden bg-page pt-14"
      aria-busy
      aria-label="Chargement"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
        <div className="h-36 animate-pulse rounded-xl bg-muted/30 md:h-44" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-lg bg-muted/25"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

export function TechListPageSkeleton() {
  return (
    <main
      className="flex min-h-[calc(100dvh-3.5rem)] flex-1 flex-col bg-page px-4 pt-20 sm:px-8"
      aria-busy
      aria-label="Chargement"
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 h-9 max-w-md animate-pulse rounded-lg bg-muted/30 md:h-11" />
        <div className="mb-8 h-4 max-w-lg animate-pulse rounded bg-muted/20" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] animate-pulse rounded-xl bg-muted/25"
            />
          ))}
        </div>
      </div>
    </main>
  );
}

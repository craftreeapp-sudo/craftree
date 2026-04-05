'use client';

export function AIProgressBar({
  indeterminate,
  ratio,
}: {
  indeterminate?: boolean;
  ratio?: number;
}) {
  const width =
    indeterminate || ratio === undefined
      ? '40%'
      : `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full bg-violet-500 ${indeterminate ? 'animate-pulse' : ''}`}
        style={{
          width,
          transition: indeterminate ? undefined : 'width 0.3s ease',
        }}
      />
    </div>
  );
}

import type { JSX } from "react";

import type { SessionProgress } from "@/lib/session-progress";

export type { SessionProgress } from "@/lib/session-progress";

/** Header text plus a thin bar across a multi-part session. */
export function SessionHeaderProgress({
  progress,
}: {
  progress: SessionProgress;
}): JSX.Element {
  const percent = Math.round(Math.min(Math.max(progress.fraction, 0), 1) * 100);
  return (
    <div className="ml-auto flex min-w-0 shrink-0 items-center gap-3">
      <span className="hidden truncate text-xs tabular-nums text-muted-foreground sm:inline">
        {progress.label}
      </span>
      <div
        role="progressbar"
        aria-label={`Session progress: ${progress.label}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:w-40"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

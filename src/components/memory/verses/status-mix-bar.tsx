import { MEMORY_STATUS_STYLE } from "@/lib/memory-status-style";
import type { MemoryStatus } from "@/lib/memory-scheduler";
import { cn } from "@/lib/utils";

/**
 * Verses by status as one bar in the Memory status colors; Up next is the
 * empty track. Decorative: callers say the counts in words.
 */
export function StatusMixBar({
  segments,
  className,
}: {
  segments: readonly { status: MemoryStatus; count: number }[];
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-1.5 overflow-hidden rounded-full bg-muted",
        className,
      )}
    >
      {total > 0
        ? segments.map((segment) =>
            segment.status === "new" || segment.count === 0 ? null : (
              <span
                key={segment.status}
                className={cn(
                  "h-full",
                  MEMORY_STATUS_STYLE[segment.status].bar,
                )}
                style={{ width: `${(segment.count / total) * 100}%` }}
              />
            ),
          )
        : null}
    </div>
  );
}

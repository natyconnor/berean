import { Button } from "@/components/ui/button";
import type { ScopeHeartPreviewState } from "@/hooks/use-scope-heart-preview";
import type { ProposedHeartGroup } from "@/lib/memory-span-group";
import { cn } from "@/lib/utils";

interface ScopeHeartPreviewProps {
  /** Scope summary, used as the preview's lead-in ("Psalm 23 · 6 verses …"). */
  scopeLabel: string;
  preview: ScopeHeartPreviewState;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function groupLabel(group: ProposedHeartGroup): string {
  return group.startVerse === group.endVerse
    ? `${group.startVerse}`
    : `${group.startVerse}\u2013${group.endVerse}`;
}

function LegendSwatch({ kind }: { kind: ProposedHeartGroup["kind"] }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-2 w-2.5 rounded-[3px] border",
        kind === "kept"
          ? "border-dashed border-border bg-muted"
          : "border-primary/40 bg-primary/15",
      )}
    />
  );
}

function PreviewSkeleton() {
  return (
    <div role="status" aria-label="Loading verse preview" className="space-y-2">
      <div className="h-3 w-52 max-w-full animate-pulse rounded bg-muted" />
      <div className="space-y-1.5" aria-hidden>
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-1.5">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-4 w-9 animate-pulse rounded bg-muted" />
            <div className="h-4 w-7 animate-pulse rounded bg-muted" />
            <div className="h-4 w-11 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The proposal itself: a one-line summary and a chip per memory unit, grouped
 * by chapter. Kept hearts render muted so a glance separates what is new from
 * what already exists.
 */
function HeartProposal({ scopeLabel, preview }: ScopeHeartPreviewProps) {
  const {
    loading,
    error,
    chapters,
    verseCount,
    proposedCount,
    keptCount,
    retry,
  } = preview;

  if (error) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-destructive" role="alert">
          Couldn&apos;t load the verse text for this scope.
        </p>
        <Button size="xs" variant="outline" onClick={retry}>
          Retry
        </Button>
      </div>
    );
  }

  if (loading) return <PreviewSkeleton />;

  if (chapters.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No verses to heart in this scope.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{scopeLabel}</span>
        {` · ${plural(verseCount, "verse")} \u2192 `}
        <span className="font-medium text-foreground">
          {plural(proposedCount, "new passage")}
        </span>
        {keptCount > 0 ? ` · ${keptCount} already hearted` : ""}
      </p>

      <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
        {chapters.map((chapter) => (
          <div
            key={`${chapter.book}-${chapter.chapter}`}
            className="flex items-start gap-2"
          >
            <span className="w-20 shrink-0 truncate pt-[3px] text-[11px] font-medium text-muted-foreground">
              {chapter.label}
            </span>
            <div className="flex min-w-0 flex-wrap gap-1">
              {chapter.groups.map((group) => (
                <span
                  key={`${group.startVerse}-${group.endVerse}-${group.kind}`}
                  className={cn(
                    "rounded border px-1.5 py-0.5 text-[11px] leading-tight tabular-nums",
                    group.kind === "kept"
                      ? "border-dashed border-border bg-muted text-muted-foreground"
                      : "border-primary/40 bg-primary/15 text-foreground",
                  )}
                  title={
                    group.kind === "kept"
                      ? `${chapter.label}:${groupLabel(group)} — already hearted`
                      : `${chapter.label}:${groupLabel(group)} — ${plural(group.wordCount, "word")}`
                  }
                >
                  {groupLabel(group)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        {proposedCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <LegendSwatch kind="proposed" />
            New passage
          </span>
        )}
        {keptCount > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <LegendSwatch kind="kept" />
            Kept — already hearted
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * The auto-heart proposal for a scope pack. Used in the Memorize whole passage
 * dialog after the caller has already committed to hearting.
 */
export function ScopeHeartPreview({
  scopeLabel,
  preview,
}: ScopeHeartPreviewProps) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <HeartProposal scopeLabel={scopeLabel} preview={preview} />
    </div>
  );
}

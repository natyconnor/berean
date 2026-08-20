import { useCallback, useEffect, useRef, useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { useMutation } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { MemoryDashboardCard } from "@/components/memory/memory-surface";

type SeedSummary = {
  verseCount: number;
  packCount: number;
  reviewLogCount: number;
  dueReviewCount: number;
  learningDueCount: number;
  verses: Array<{
    id: string;
    label: string;
    howToTry: string;
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
  }>;
  packs: Array<{
    name: string;
    description: string;
    verseCount: number;
  }>;
};

export function PreviewMemorySeedCard({
  now,
  heartedTotal,
  enabled,
  autoSeed = false,
}: {
  now: number;
  /** Hearted verse count from `memoryStats.total`. Undefined while loading. */
  heartedTotal: number | undefined;
  /** Preview deploys and local `pnpm dev`. Hidden in production. */
  enabled: boolean;
  /** Vercel preview: load the sample set when the account is empty. */
  autoSeed?: boolean;
}) {
  const seedPreviewMemory = useMutation(
    api.seedPreviewMemory.seedPreviewMemory,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SeedSummary | null>(null);
  const autoAttempted = useRef(false);

  const runSeed = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await seedPreviewMemory({ now });
      setSummary(result);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Couldn't load sample memory data.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }, [now, seedPreviewMemory]);

  useEffect(() => {
    if (!enabled || !autoSeed) return;
    if (heartedTotal !== 0) return;
    if (autoAttempted.current) return;
    autoAttempted.current = true;
    void runSeed();
  }, [autoSeed, enabled, heartedTotal, runSeed]);

  if (!enabled) return null;

  return (
    <MemoryDashboardCard className="border-amber-500/40 bg-amber-500/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
            <FlaskConical
              className="h-4 w-4 text-amber-700 dark:text-amber-300"
              aria-hidden
            />
            Sample memory data
          </h2>
          <p className="text-sm text-muted-foreground">
            Loads hearted verses at every stage — new, each learning band, due
            review (several queued), later review, and mastered — plus three
            packs. Replaces this account&apos;s hearted verses.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void runSeed()}
          disabled={busy}
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {summary ? "Reload sample verses" : "Load sample verses"}
        </Button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {summary && (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-muted-foreground">
            {summary.dueReviewCount} due for Review · {summary.learningDueCount}{" "}
            to learn today · {summary.verseCount} hearted · {summary.packCount}{" "}
            packs
          </p>
          <ul className="divide-y rounded-lg border bg-background/70 text-left">
            {summary.verses.map((verse) => (
              <li key={verse.id} className="px-3 py-2">
                <p className="font-medium">
                  {formatVerseRef(verse)}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {verse.label}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {verse.howToTry}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </MemoryDashboardCard>
  );
}

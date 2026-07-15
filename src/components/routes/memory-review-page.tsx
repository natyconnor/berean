import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Clock3, Loader2 } from "lucide-react";
import { useState } from "react";

import { api } from "../../../convex/_generated/api";
import {
  ReviewPlayer,
  type ReviewItem,
} from "@/components/memory/review-player";
import { Button } from "@/components/ui/button";
import { useLiveNow } from "@/hooks/use-live-now";
import { hasReviewVerseScope } from "@/lib/memory-review-search";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { Route } from "@/routes/memory/review";

export function MemoryReviewPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const now = useLiveNow();
  const hasScope = hasReviewVerseScope(search);
  const scopedDue = useQuery(
    api.verseMemory.dueForVerse,
    hasScope
      ? {
          now,
          book: search.book,
          chapter: search.chapter,
          startVerse: search.startVerse,
          endVerse: search.endVerse,
        }
      : "skip",
  );

  // Freeze the scoped due row once it first resolves so Check → reschedule
  // doesn't bounce this page to "Not due yet" mid-session.
  const [scopedSnapshot, setScopedSnapshot] = useState<
    ReviewItem | null | undefined
  >(undefined);
  if (hasScope && scopedDue !== undefined && scopedSnapshot === undefined) {
    setScopedSnapshot(scopedDue);
  }

  if (!hasScope) {
    return <ReviewPlayer onExit={() => void navigate({ to: "/memory" })} />;
  }

  if (scopedSnapshot === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (scopedSnapshot === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Clock3 className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <div className="max-w-sm space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Not due yet</h1>
          <p className="text-sm text-muted-foreground">
            {formatVerseRef(search)} isn&apos;t due for review right now.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void navigate({ to: "/memory" })}
        >
          Back to memory
        </Button>
      </div>
    );
  }

  const dueItems: ReviewItem[] = [scopedSnapshot];

  return (
    <ReviewPlayer
      title={formatVerseRef(search)}
      doneLabel="Back to memory"
      source={{
        dueItems,
        // Live remaining: once the verse leaves the due set, remaining is 0.
        remainingDue: scopedDue === null ? 0 : 1,
      }}
      onExit={() => void navigate({ to: "/memory" })}
    />
  );
}

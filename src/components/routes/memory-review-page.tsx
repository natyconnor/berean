import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import {
  ReviewPlayer,
  type ReviewItem,
} from "@/components/memory/review-player";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  hasReviewVerseScope,
  type MemoryReviewVerseScope,
} from "@/lib/memory-review-search";
import { formatVerseRef } from "@/lib/verse-ref-utils";
import { Route } from "@/routes/memory/review";

const SINGLE_VERSE_REVIEW_LIMIT = 500;

export function MemoryReviewPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const now = useLiveNow();
  const hasScope = hasReviewVerseScope(search);
  const scopedDue = useQuery(
    api.verseMemory.dueQueue,
    hasScope ? { now, limit: SINGLE_VERSE_REVIEW_LIMIT } : "skip",
  );
  const scopedDueItems = useMemo(
    () =>
      hasScope && scopedDue !== undefined
        ? scopedDue.filter((item) => matchesScope(item, search))
        : undefined,
    [hasScope, scopedDue, search],
  );

  if (!hasScope) {
    return <ReviewPlayer onExit={() => void navigate({ to: "/memory" })} />;
  }

  return (
    <ReviewPlayer
      title={formatVerseRef(search)}
      doneLabel="Back to memory"
      source={{
        dueItems: scopedDueItems,
        remainingDue: scopedDueItems?.length,
      }}
      onExit={() => void navigate({ to: "/memory" })}
    />
  );
}

function matchesScope(
  item: ReviewItem,
  scope: MemoryReviewVerseScope,
): boolean {
  return (
    item.book === scope.book &&
    item.chapter === scope.chapter &&
    item.startVerse === scope.startVerse &&
    item.endVerse === scope.endVerse
  );
}

import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, Loader2, SearchX, Sparkles } from "lucide-react";

import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { toPracticeVerse } from "@/components/memory/to-practice-verse";
import { Button } from "@/components/ui/button";
import { useLiveNow } from "@/hooks/use-live-now";
import { Route } from "@/routes/memory_.$packId.review";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function MemoryPackReviewPage() {
  const navigate = useNavigate();
  const { packId } = Route.useParams();
  const typedPackId = packId as Id<"packs">;
  const now = useLiveNow();
  const [sessionEpoch, setSessionEpoch] = useState(0);

  const pack = useQuery(api.packs.get, { id: typedPackId });
  const members = useQuery(api.packs.resolveMembers, {
    id: typedPackId,
    now,
  });

  const dueMembers = useMemo(
    () => (members ?? []).filter((member) => member.isDue),
    [members],
  );
  const reviewVerses = useMemo<PracticeVerse[]>(
    () =>
      members === undefined
        ? []
        : dueMembers.map((member) => toPracticeVerse(member)),
    [members, dueMembers],
  );

  const onExit = () =>
    void navigate({
      to: "/memory/$packId",
      params: { packId: typedPackId },
    });

  if (pack === undefined || members === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pack === null) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6">
        <div className="max-w-sm space-y-3 text-center">
          <SearchX
            aria-hidden
            className="mx-auto h-8 w-8 text-muted-foreground/70"
          />
          <h1 className="text-base font-semibold tracking-tight">
            Pack not found
          </h1>
          <p className="text-sm text-muted-foreground">
            This pack may have been deleted, or the link points at a pack that
            isn&apos;t yours.
          </p>
          <Link
            to="/memory"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Memory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <MemorySessionRunner
      key={`pack-review-${sessionEpoch}`}
      kind="review"
      verses={reviewVerses}
      scopeLabel={pack.name}
      onExit={onExit}
      exitTooltip="Go back to the pack"
      exitLabel="Back to pack"
      remainingDue={dueMembers.length}
      onContinueSession={() => setSessionEpoch((value) => value + 1)}
      emptyState={
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div className="max-w-sm space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">
              All caught up
            </h1>
            <p className="text-sm text-muted-foreground">
              No verses in this pack are due for review right now.
            </p>
          </div>
          <Button variant="outline" onClick={onExit}>
            Back to pack
          </Button>
        </div>
      }
    />
  );
}

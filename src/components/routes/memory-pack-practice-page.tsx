import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, Loader2, SearchX } from "lucide-react";

import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import { useLiveNow } from "@/hooks/use-live-now";
import {
  isMemorySessionCandidate,
  type MemorySessionKind,
} from "@/lib/memory-session";
import { Route } from "@/routes/memory_.$packId.practice";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function MemoryPackPracticePage() {
  const { packId } = Route.useParams();

  return (
    <MemoryPackSessionPage kind="practice" packId={packId as Id<"packs">} />
  );
}

export function MemoryPackSessionPage({
  kind,
  packId: typedPackId,
}: {
  kind: MemorySessionKind;
  packId: Id<"packs">;
}) {
  const navigate = useNavigate();
  const now = useLiveNow();

  const pack = useQuery(api.packs.get, { id: typedPackId });
  const members = useQuery(api.packs.resolveMembers, {
    id: typedPackId,
    now,
  });

  const sessionVerses = useMemo<PracticeVerse[]>(
    () =>
      (members ?? [])
        .map((m) => ({
          reference: {
            book: m.book,
            chapter: m.chapter,
            startVerse: m.startVerse,
            endVerse: m.endVerse,
          },
          learnStage: m.learnStage,
          stageReps: m.stageReps ?? 0,
          status: m.status,
          dueAt: m.dueAt,
          lastReviewedAt: m.lastReviewedAt,
        }))
        .filter((verse) =>
          isMemorySessionCandidate(verse, kind, now, kind === "learning"),
        ),
    [members, kind, now],
  );
  const isLearning = kind === "learning";

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
      kind={kind}
      verses={sessionVerses}
      scopeLabel={pack.name}
      exitTooltip="Go back to the pack"
      exitLabel="Back to Pack"
      onExit={() =>
        void navigate({
          to: "/memory/$packId",
          params: { packId: typedPackId },
        })
      }
      emptyState={
        <div className="flex h-full items-center justify-center bg-background px-6">
          <div className="max-w-sm space-y-3 text-center">
            <h1 className="text-base font-semibold tracking-tight">
              {isLearning
                ? "Nothing to learn right now"
                : "Nothing to practice"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLearning
                ? "No in-progress verses in this pack are ready for Learning."
                : "Verses in this pack become available after they finish Learning."}
            </p>
            <Link
              to="/memory/$packId"
              params={{ packId: typedPackId }}
              className="inline-flex text-sm font-medium text-primary hover:underline"
            >
              Back to Pack
            </Link>
          </div>
        </div>
      }
    />
  );
}

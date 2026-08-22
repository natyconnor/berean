import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeft,
  GraduationCap,
  Loader2,
  SearchX,
  Sparkles,
} from "lucide-react";

import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import type { PracticeVerse } from "@/components/memory/practice/practice-board";
import type { CardReference } from "@/components/study/study-card-model";
import { toPracticeVerse } from "@/components/memory/to-practice-verse";
import { Button } from "@/components/ui/button";
import { useLiveNow } from "@/hooks/use-live-now";
import { isReviewPhase, type MemorySchedule } from "@/lib/memory-scheduler";
import { canonicalUnifiedSchedule } from "@/lib/unified-review-schedule";
import { Route } from "@/routes/memory_.$packId.review";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type PackMember = FunctionReturnType<typeof api.packs.resolveMembers>[number];

function memberReference(member: PackMember): CardReference {
  return {
    book: member.book,
    chapter: member.chapter,
    startVerse: member.startVerse,
    endVerse: member.endVerse,
  };
}

function memberSchedule(member: PackMember): MemorySchedule {
  return {
    status: member.status,
    learnStage: member.learnStage,
    stageReps: member.stageReps,
    ease: member.ease,
    intervalDays: member.intervalDays,
    dueAt: member.dueAt,
    consecutiveCorrect: member.consecutiveCorrect,
    lapses: member.lapses,
    earlyReviewApplied: member.earlyReviewApplied ?? false,
  };
}

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

  const unifiedEnabled = pack?.unifiedReviewEnabled === true;
  // A flagged pack can still pick up an ungraduated member — a new heart inside
  // the scope, or a lapse back into learning. The recitation needs every member
  // in review phase, and grading the spans one at a time is not a fallback: it
  // would write per-verse schedules the pack UI still presents as one item.
  const unifiedBlocked =
    unifiedEnabled &&
    members !== undefined &&
    (members.length === 0 ||
      !members.every((member) => isReviewPhase(member.status)));

  // Unified recitation: the pack is one card, not N due spans. Enabling already
  // pulled every member to today and synced their schedules, so the whole pack
  // recites together — the conservative canonical schedule (same helper the
  // mutation uses) drives the card's "next review in N days" preview.
  const compositeVerse = useMemo<PracticeVerse | null>(() => {
    if (pack?.unifiedReviewEnabled !== true) return null;
    if (members === undefined || members.length === 0) return null;
    if (!members.every((member) => isReviewPhase(member.status))) return null;
    if (dueMembers.length === 0) return null;

    const canonical = canonicalUnifiedSchedule(
      members.map(memberSchedule),
      now,
    );
    return {
      reference: memberReference(members[0]),
      learnStage: canonical.learnStage,
      stageReps: canonical.stageReps,
      status: canonical.status,
      dueAt: canonical.dueAt,
      ease: canonical.ease,
      intervalDays: canonical.intervalDays,
      consecutiveCorrect: canonical.consecutiveCorrect,
      lapses: canonical.lapses,
      earlyReviewApplied: canonical.earlyReviewApplied,
      composite: {
        packId: typedPackId,
        members: members.map(memberReference),
      },
    };
  }, [
    pack?.unifiedReviewEnabled,
    members,
    dueMembers.length,
    now,
    typedPackId,
  ]);

  const reviewVerses = useMemo<PracticeVerse[]>(() => {
    if (members === undefined) return [];
    // While the flag is on, the recitation is the only way to review this pack:
    // either the one composite card or nothing at all.
    if (unifiedEnabled) return compositeVerse ? [compositeVerse] : [];
    return dueMembers.map((member) => toPracticeVerse(member));
  }, [members, dueMembers, compositeVerse, unifiedEnabled]);

  // One recitation is one due item, matching the pack list's 0|1 due count.
  const remainingDue = unifiedEnabled
    ? compositeVerse
      ? 1
      : 0
    : dueMembers.length;

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

  const learningCount = members.filter(
    (member) => !isReviewPhase(member.status),
  ).length;

  return (
    <MemorySessionRunner
      key={`pack-review-${sessionEpoch}`}
      kind="review"
      verses={reviewVerses}
      scopeLabel={pack.name}
      onExit={onExit}
      exitTooltip="Go back to the pack"
      exitLabel="Back to pack"
      remainingDue={remainingDue}
      onContinueSession={() => setSessionEpoch((value) => value + 1)}
      emptyState={
        unifiedBlocked ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <GraduationCap className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <div className="max-w-sm space-y-1">
              <h1 className="text-xl font-semibold tracking-tight">
                {learningCount > 0
                  ? "Finish learning this pack first"
                  : "Nothing to recite yet"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {learningCount > 0
                  ? `${pack.name} recites as one passage, so every unit has to graduate before it comes back. ${learningCount} ${learningCount === 1 ? "unit is" : "units are"} still learning.`
                  : `${pack.name} has no hearted verses right now. Heart verses inside this scope and they join the recitation.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {learningCount > 0 ? (
                <Button
                  onClick={() =>
                    void navigate({
                      to: "/memory/$packId/learn",
                      params: { packId: typedPackId },
                    })
                  }
                >
                  Learn this pack
                </Button>
              ) : null}
              <Button variant="outline" onClick={onExit}>
                Back to pack
              </Button>
            </div>
          </div>
        ) : (
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
        )
      }
    />
  );
}

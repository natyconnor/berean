import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  GraduationCap,
  Loader2,
  SearchX,
  Sparkles,
} from "lucide-react";

import { packReviewSession } from "@/components/memory/pack-session-verses";
import { PassageSession } from "@/components/memory/passage/passage-session";
import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import { Button } from "@/components/ui/button";
import { useLiveNow } from "@/hooks/use-live-now";
import { useFrozenQuery } from "@/hooks/use-frozen-query";
import { useMemoryExit } from "@/hooks/use-memory-back";
import { isReviewPhase } from "@/lib/memory-scheduler";
import { remainingDueAfterQueue } from "@/lib/memory-session";
import { Route } from "@/routes/memory_.$packId.review";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function MemoryPackReviewPage() {
  const navigate = useNavigate();
  const { packId } = Route.useParams();
  const { return: returnTo } = Route.useSearch();
  const typedPackId = packId as Id<"packs">;
  const now = useLiveNow();
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const packHref = `/memory/${encodeURIComponent(packId)}`;
  const exit = useMemoryExit(returnTo, packHref);
  const onExit = exit.go;
  const backLabel = exit.label;

  const pack = useQuery(api.packs.get, { id: typedPackId });
  const members = useFrozenQuery(api.packs.resolveMembers, {
    id: typedPackId,
    now,
  });
  const passage = useQuery(api.passageMemory.getForPack, {
    packId: typedPackId,
    now,
    tzOffsetMinutes: new Date(now).getTimezoneOffset(),
  });

  const review = useMemo(
    () =>
      packReviewSession({
        packId: typedPackId,
        packName: pack?.name ?? "",
        unifiedReviewEnabled: pack?.unifiedReviewEnabled === true,
        members: members ?? [],
        now,
      }),
    [pack?.name, pack?.unifiedReviewEnabled, members, now, typedPackId],
  );
  const unifiedBlocked = members !== undefined && review.unifiedBlocked;
  const remainingDue = remainingDueAfterQueue(
    review.dueCount,
    review.verses.length,
  );

  if (pack === undefined || passage === undefined) {
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
            Back to Today
          </Link>
        </div>
      </div>
    );
  }

  if (passage) {
    return (
      <PassageSession
        packId={typedPackId}
        view={passage}
        packName={pack.name}
        onExit={onExit}
        backLabel={backLabel}
      />
    );
  }

  if (members === undefined) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
      verses={review.verses}
      scopeLabel={pack.name}
      onExit={onExit}
      backLabel={backLabel}
      returnTo={returnTo}
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
                  : `${pack.name} has no verses being memorized right now.`}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {learningCount > 0 ? (
                <Button
                  onClick={() =>
                    void navigate({
                      to: "/memory/$packId/learn",
                      params: { packId: typedPackId },
                      ...(returnTo === undefined
                        ? {}
                        : { search: { return: returnTo } }),
                    })
                  }
                >
                  Learn this pack
                </Button>
              ) : null}
              <Button variant="outline" onClick={onExit}>
                {backLabel}
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
              {backLabel}
            </Button>
          </div>
        )
      }
    />
  );
}

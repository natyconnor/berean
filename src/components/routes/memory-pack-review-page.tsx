import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, Loader2, SearchX } from "lucide-react";

import {
  ReviewPlayer,
  type ReviewItem,
} from "@/components/memory/review-player";
import { useLiveNow } from "@/hooks/use-live-now";
import { Route } from "@/routes/memory_.$packId.review";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function MemoryPackReviewPage() {
  const navigate = useNavigate();
  const { packId } = Route.useParams();
  const typedPackId = packId as Id<"packs">;
  const now = useLiveNow();

  const pack = useQuery(api.packs.get, { id: typedPackId });
  const members = useQuery(api.packs.resolveMembers, {
    id: typedPackId,
    now,
  });

  const dueMembers = useMemo(
    () => (members ?? []).filter((m) => m.isDue),
    [members],
  );
  const reviewDueItems = useMemo<ReviewItem[]>(
    () =>
      members === undefined
        ? []
        : dueMembers.map((m) => ({
            verseRefId: m.verseRefId,
            book: m.book,
            chapter: m.chapter,
            startVerse: m.startVerse,
            endVerse: m.endVerse,
            status: m.status,
            learnStage: m.learnStage,
          })),
    [members, dueMembers],
  );

  if (pack === undefined) {
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
    <ReviewPlayer
      title={pack.name}
      backLabel="Pack"
      source={{
        dueItems: members === undefined ? undefined : reviewDueItems,
        remainingDue: members === undefined ? undefined : dueMembers.length,
      }}
      onExit={() =>
        void navigate({
          to: "/memory/$packId",
          params: { packId: typedPackId },
        })
      }
    />
  );
}

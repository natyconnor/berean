import { useCallback, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import type { FunctionReturnType } from "convex/server";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { exactSpanMatch, type VerseSpan } from "@/lib/hearted-verse-coverage";
import { planMemorizeTransition } from "@/lib/memorize-transition";
import { stepShortLabel } from "@/lib/memory-copy";
import {
  isLearningLocked,
  isReviewPhase,
  type MemoryStatus,
} from "@/lib/memory-scheduler";
import { reviewPhaseListAction } from "@/lib/memory-session";

import { api } from "../../../convex/_generated/api";
import { PackVersePicker } from "./packs/pack-verse-picker";
import {
  packVerseKey,
  type HeartedVerse,
  type PackableVerse,
} from "./packs/pack-verse-types";
import type { PracticeVerse } from "./practice/practice-board";
import { toPracticeVerse } from "./to-practice-verse";

type SavedVerseRow = FunctionReturnType<typeof api.savedVerses.listAll>[number];

function practiceVerseFromSpan(
  span: VerseSpan,
  memory?: {
    status: MemoryStatus;
    learnStage: number;
    stageReps?: number;
    dueAt?: number;
    lastReviewedAt?: number;
  },
  verseRefId?: SavedVerseRow["verseRefId"],
): PracticeVerse {
  return toPracticeVerse({
    ...span,
    ...(verseRefId ? { verseRefId } : {}),
    status: memory?.status ?? "new",
    learnStage: memory?.learnStage ?? 0,
    stageReps: memory?.stageReps,
    dueAt: memory?.dueAt,
    lastReviewedAt: memory?.lastReviewedAt,
  });
}

function findExactHeartedRow(
  span: VerseSpan,
  rows: ReadonlyArray<SavedVerseRow>,
): SavedVerseRow | null {
  return rows.find((row) => exactSpanMatch(span, [row]) !== null) ?? null;
}

/**
 * Dashboard Learn picker: Browse-first, confirmLabel Learn. Memorizes the
 * picked span (which hearts it when no heart covers it), then routes like
 * library row CTAs (Learn vs Review vs Practice vs stay put).
 */
export function LearnVerseDialog({
  open,
  onOpenChange,
  now,
  onLearnVerse,
  onReviewVerse,
  onPracticeVerse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  now: number;
  onLearnVerse: (verse: PracticeVerse) => void;
  onReviewVerse: (verse: PracticeVerse) => void;
  onPracticeVerse: (verse: PracticeVerse) => void;
}) {
  const savedVerses = useQuery(api.savedVerses.listAll, open ? {} : "skip");
  const memorize = useMutation(api.verseMemory.memorize);
  const { submit } = useSubmitLock();

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const heartedVerses = useMemo<HeartedVerse[]>(
    () =>
      (savedVerses ?? []).map((v) => ({
        verseRefId: v.verseRefId,
        book: v.book,
        chapter: v.chapter,
        startVerse: v.startVerse,
        endVerse: v.endVerse,
        memory: v.memory?.inMemory
          ? {
              status: v.memory.status,
              dueAt: v.memory.dueAt,
              lastReviewedAt: v.memory.lastReviewedAt,
            }
          : undefined,
      })),
    [savedVerses],
  );

  const handleSelect = useCallback(
    (span: PackableVerse) => {
      if (savedVerses === undefined) return;
      submit(async () => {
        const match = findExactHeartedRow(span, savedVerses);
        const before = match?.memory;
        const key = packVerseKey(span);
        setError(null);
        setPendingKey(key);
        try {
          const result = await memorize({
            spans: [
              {
                book: span.book,
                chapter: span.chapter,
                startVerse: span.startVerse,
                endVerse: span.endVerse,
              },
            ],
            now,
          });
          const verseRefId = result.verseRefIds[0] ?? match?.verseRefId;

          // Memorizing keeps the schedule; a `new` verse starts learning now.
          const status = planMemorizeTransition(
            before
              ? { status: before.status, inMemory: before.inMemory }
              : null,
            false,
          ).status;
          const memory = before
            ? {
                ...before,
                status,
                dueAt: status === before.status ? before.dueAt : now,
              }
            : undefined;

          if (memory && isReviewPhase(memory.status)) {
            onOpenChange(false);
            const practiceVerse = practiceVerseFromSpan(
              span,
              memory,
              verseRefId,
            );
            if (reviewPhaseListAction(practiceVerse, now) === "review") {
              onReviewVerse(practiceVerse);
            } else {
              onPracticeVerse(practiceVerse);
            }
            return;
          }

          if (
            memory &&
            isLearningLocked(
              {
                status: memory.status,
                dueAt: memory.dueAt,
                lastReviewedAt: memory.lastReviewedAt,
              },
              now,
            )
          ) {
            setError(
              `You've done today's step for this verse. Tomorrow: ${stepShortLabel(memory.learnStage)}.`,
            );
            return;
          }

          onOpenChange(false);
          onLearnVerse(practiceVerseFromSpan(span, memory, verseRefId));
        } catch {
          setError("Couldn't start that verse. Please try again.");
        } finally {
          setPendingKey(null);
        }
      });
    },
    [
      memorize,
      now,
      onLearnVerse,
      onOpenChange,
      onPracticeVerse,
      onReviewVerse,
      savedVerses,
      submit,
    ],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setError(null);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Learn a verse</DialogTitle>
          <DialogDescription>
            Pick a verse to memorize. You don&apos;t need to heart it first.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <PackVersePicker
          heartedVerses={heartedVerses}
          isLoadingHearted={open && savedVerses === undefined}
          defaultTab="browse"
          confirmLabel="Learn"
          now={now}
          isSelected={() => false}
          isPending={(verse) =>
            savedVerses === undefined || pendingKey === packVerseKey(verse)
          }
          onSelect={handleSelect}
        />
      </DialogContent>
    </Dialog>
  );
}

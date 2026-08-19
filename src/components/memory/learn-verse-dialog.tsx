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
import { isLearningLocked, type MemoryStatus } from "@/lib/memory-scheduler";

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
): PracticeVerse {
  return toPracticeVerse({
    ...span,
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
 * Dashboard Learn picker: Browse-first, confirmLabel Learn. Hearts unhearted
 * spans then routes like library row CTAs (Learn vs Review vs stay put).
 */
export function LearnVerseDialog({
  open,
  onOpenChange,
  now,
  onLearnVerse,
  onReviewVerse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  now: number;
  onLearnVerse: (verse: PracticeVerse) => void;
  onReviewVerse: (verse: PracticeVerse) => void;
}) {
  const savedVerses = useQuery(api.savedVerses.listAll, open ? {} : "skip");
  const toggleSaved = useMutation(api.savedVerses.toggle);
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
      })),
    [savedVerses],
  );

  const handleSelect = useCallback(
    (span: PackableVerse) => {
      if (savedVerses === undefined) return;
      submit(async () => {
        const match = findExactHeartedRow(span, savedVerses);
        const memory = match?.memory;
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
            "Come back tomorrow. Today's session for this verse is done.",
          );
          return;
        }

        const key = packVerseKey(span);
        setError(null);
        setPendingKey(key);
        try {
          if (!match) {
            const result = await toggleSaved({
              book: span.book,
              chapter: span.chapter,
              startVerse: span.startVerse,
              endVerse: span.endVerse,
            });
            if (result !== "added") {
              setError("Couldn't start that verse. Please try again.");
              return;
            }
            onOpenChange(false);
            onLearnVerse(practiceVerseFromSpan(span));
            return;
          }

          if (
            memory &&
            (memory.status === "reviewing" || memory.status === "mastered")
          ) {
            onOpenChange(false);
            onReviewVerse(practiceVerseFromSpan(span, memory));
            return;
          }

          onOpenChange(false);
          onLearnVerse(practiceVerseFromSpan(span, memory));
        } catch {
          setError("Couldn't start that verse. Please try again.");
        } finally {
          setPendingKey(null);
        }
      });
    },
    [
      now,
      onLearnVerse,
      onOpenChange,
      onReviewVerse,
      savedVerses,
      submit,
      toggleSaved,
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
            Browse or pick a hearted verse. Unhearted verses are saved, then
            learning starts.
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

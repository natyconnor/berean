import { useCallback, useMemo } from "react";
import { useQuery } from "convex-helpers/react/cache";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";

import { api } from "../../../convex/_generated/api";
import { PackVersePicker } from "./packs/pack-verse-picker";
import type { HeartedVerse, PackableVerse } from "./packs/pack-verse-types";

/**
 * Library "Memorize a verse" picker: Browse-first. Picking a verse closes the
 * picker and hands the span to `onPick`, which opens the Memorize sheet.
 */
export function LearnVerseDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (span: VerseSpan) => void;
}) {
  const savedVerses = useQuery(api.savedVerses.listAll, open ? {} : "skip");

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
    (verse: PackableVerse) => {
      onOpenChange(false);
      onPick({
        book: verse.book,
        chapter: verse.chapter,
        startVerse: verse.startVerse,
        endVerse: verse.endVerse,
      });
    },
    [onOpenChange, onPick],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Memorize a verse</DialogTitle>
          <DialogDescription>
            Pick a verse to memorize. You don&apos;t need to heart it first.
          </DialogDescription>
        </DialogHeader>
        <PackVersePicker
          heartedVerses={heartedVerses}
          isLoadingHearted={open && savedVerses === undefined}
          defaultTab="browse"
          confirmLabel="Memorize"
          isSelected={() => false}
          onSelect={handleSelect}
        />
      </DialogContent>
    </Dialog>
  );
}

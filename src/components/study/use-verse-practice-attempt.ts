import { useCallback, useRef } from "react";

import type { DiffToken } from "@/lib/diff-words";
import type { MemorySchedule } from "@/lib/memory-scheduler";

import type { CardReference } from "./study-card-model";
import {
  useRecordVerseAttempt,
  type RecordVerseAttemptOptions,
  type VerseAttemptMode,
} from "./use-record-verse-attempt";
import type { Id } from "../../../convex/_generated/dataModel";

interface RecordAttemptArgs {
  reference: CardReference;
  verseRefId?: Id<"verseRefs">;
  tokens: ReadonlyArray<DiffToken>;
  stage: number;
  wordCount?: number;
  hint?: "first-letters";
  holdSchedule?: boolean;
}

interface UseVersePracticeAttemptReturn {
  resolveVerseRefId: (reference: CardReference) => Id<"verseRefs"> | null;
  /**
   * Bump per-verse seq, record, and adopt only the newest successful schedule.
   * Used by multi-verse Practice.
   */
  recordWithSeqAdopt: (
    verseKey: string,
    args: RecordAttemptArgs,
    onAdopt: (next: MemorySchedule) => void,
  ) => Promise<MemorySchedule | null>;
}

/**
 * Shared grade → record → adopt plumbing for Memory sessions. UI submit locks
 * and card chrome stay in the components.
 */
export function useVersePracticeAttempt(
  mode: VerseAttemptMode,
  options?: RecordVerseAttemptOptions,
): UseVersePracticeAttemptReturn {
  const { record, resolveVerseRefId } = useRecordVerseAttempt(options);
  const attemptSeqByVerseId = useRef<Map<string, number>>(new Map());
  const appliedSeqByVerseId = useRef<Map<string, number>>(new Map());

  const recordWithSeqAdopt = useCallback(
    async (
      verseKey: string,
      args: RecordAttemptArgs,
      onAdopt: (next: MemorySchedule) => void,
    ): Promise<MemorySchedule | null> => {
      const seq = (attemptSeqByVerseId.current.get(verseKey) ?? 0) + 1;
      attemptSeqByVerseId.current.set(verseKey, seq);
      const schedule = await record({
        reference: args.reference,
        verseRefId: args.verseRefId,
        tokens: args.tokens,
        stage: args.stage,
        mode,
        wordCount: args.wordCount,
        hint: args.hint,
        holdSchedule: args.holdSchedule,
      });
      if (!schedule) return null;
      const applied = appliedSeqByVerseId.current.get(verseKey) ?? 0;
      if (seq <= applied) return schedule;
      appliedSeqByVerseId.current.set(verseKey, seq);
      onAdopt(schedule);
      return schedule;
    },
    [mode, record],
  );

  return { resolveVerseRefId, recordWithSeqAdopt };
}

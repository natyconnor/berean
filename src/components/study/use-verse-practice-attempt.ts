import { useCallback, useRef } from "react";

import type { DiffToken } from "@/lib/diff-words";
import type { MemorySchedule } from "@/lib/memory-scheduler";
import {
  normalizeVerseProgress,
  predictLearning,
  type VerseAttemptQuality,
  type VersePracticeProgress,
} from "@/lib/verse-practice-progress";

import type { CardReference } from "./study-card-model";
import {
  useRecordVerseAttempt,
  type VerseAttemptMode,
} from "./use-record-verse-attempt";

export type { VersePracticeProgress } from "@/lib/verse-practice-progress";

interface RecordAttemptArgs {
  reference: CardReference;
  tokens: ReadonlyArray<DiffToken>;
  stage: number;
  wordCount?: number;
}

interface UseVersePracticeAttemptReturn {
  heartedVersesReady: boolean;
  normalizeProgress: (
    raw: MemorySchedule | VersePracticeProgress,
  ) => VersePracticeProgress;
  /**
   * Bump per-verse seq, record, and adopt only the newest successful schedule.
   * Used by multi-verse Practice.
   */
  recordWithSeqAdopt: (
    verseKey: string,
    args: RecordAttemptArgs,
    onAdopt: (next: VersePracticeProgress) => void,
  ) => Promise<void>;
  /**
   * Record and adopt immediately (or predictLearning on null). Used by Study
   * Read-continue.
   */
  recordWithImmediateAdopt: (
    args: RecordAttemptArgs & {
      current: VersePracticeProgress;
      quality: VerseAttemptQuality;
    },
    onAdopt: (next: VersePracticeProgress) => void,
  ) => Promise<void>;
  /** Record and stash for later commit (Study check-answer). */
  recordDeferred: (args: RecordAttemptArgs) => Promise<void>;
  /**
   * Adopt stashed schedule or the provided fallback (Study continue-after-review).
   */
  commitDeferred: (fallback: VersePracticeProgress) => VersePracticeProgress;
}

/**
 * Shared grade → record → adopt plumbing for Practice and Study learn cards.
 * UI submit locks and card chrome stay in the components.
 */
export function useVersePracticeAttempt(
  mode: VerseAttemptMode,
): UseVersePracticeAttemptReturn {
  const { record, heartedVersesReady } = useRecordVerseAttempt();
  const attemptSeqByVerseId = useRef<Map<string, number>>(new Map());
  const appliedSeqByVerseId = useRef<Map<string, number>>(new Map());
  const pendingProgressRef = useRef<VersePracticeProgress | null>(null);

  const normalizeProgress = useCallback(
    (raw: MemorySchedule | VersePracticeProgress): VersePracticeProgress =>
      normalizeVerseProgress(raw),
    [],
  );

  const recordWithSeqAdopt = useCallback(
    async (
      verseKey: string,
      args: RecordAttemptArgs,
      onAdopt: (next: VersePracticeProgress) => void,
    ): Promise<void> => {
      const seq = (attemptSeqByVerseId.current.get(verseKey) ?? 0) + 1;
      attemptSeqByVerseId.current.set(verseKey, seq);
      const schedule = await record({
        reference: args.reference,
        tokens: args.tokens,
        stage: args.stage,
        mode,
        wordCount: args.wordCount,
      });
      if (!schedule) return;
      const applied = appliedSeqByVerseId.current.get(verseKey) ?? 0;
      if (seq <= applied) return;
      appliedSeqByVerseId.current.set(verseKey, seq);
      onAdopt(normalizeVerseProgress(schedule));
    },
    [mode, record],
  );

  const recordWithImmediateAdopt = useCallback(
    async (
      args: RecordAttemptArgs & {
        current: VersePracticeProgress;
        quality: VerseAttemptQuality;
      },
      onAdopt: (next: VersePracticeProgress) => void,
    ): Promise<void> => {
      const schedule = await record({
        reference: args.reference,
        tokens: args.tokens,
        stage: args.stage,
        mode,
        wordCount: args.wordCount,
      });
      onAdopt(
        schedule
          ? normalizeVerseProgress(schedule)
          : predictLearning(
              args.current.learnStage,
              args.current.stageReps,
              args.quality,
              args.wordCount,
              args.current.status,
            ),
      );
    },
    [mode, record],
  );

  const recordDeferred = useCallback(
    async (args: RecordAttemptArgs): Promise<void> => {
      const schedule = await record({
        reference: args.reference,
        tokens: args.tokens,
        stage: args.stage,
        mode,
        wordCount: args.wordCount,
      });
      pendingProgressRef.current = schedule
        ? normalizeVerseProgress(schedule)
        : null;
    },
    [mode, record],
  );

  const commitDeferred = useCallback(
    (fallback: VersePracticeProgress): VersePracticeProgress => {
      const next = pendingProgressRef.current ?? fallback;
      pendingProgressRef.current = null;
      return normalizeVerseProgress(next);
    },
    [],
  );

  return {
    heartedVersesReady,
    normalizeProgress,
    recordWithSeqAdopt,
    recordWithImmediateAdopt,
    recordDeferred,
    commitDeferred,
  };
}

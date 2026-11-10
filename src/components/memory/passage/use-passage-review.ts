import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";

import type { PassageView } from "@/components/memory/passage/passage-session-types";
import type { VerseAttemptQuality } from "@/components/study/study-attempt-quality";
import type { CompositePassageSegment } from "@/hooks/use-esv-composite-passage";
import {
  missedVerses,
  shakyFirstLettersHint,
  type PassageVerseKey,
  type PassageVerseScore,
} from "@/lib/passage-shaky";
import { isStaleVerse } from "@/lib/memory-stale";
import { stackVerseHints } from "@/lib/verse-hint";
import { getViewerTimeZone } from "@/lib/viewer-timezone";

import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

/** One unhinted whole-passage try to save as the passage's review. */
export type ReviewSave = {
  quality: VerseAttemptQuality;
  accuracy: number;
  durationMs?: number;
  now: number;
  verseScores: PassageVerseScore[];
  refresherUsed?: true;
};

/** A cold miss held on the server, and the try it came from. */
export type HeldMiss = {
  packId: Id<"packs">;
  heldId: Id<"heldPassageAttempts">;
  save: ReviewSave;
};

/** One graded verse of the passage and the segment (piece) it sits in. */
export type PassageVerse = PassageVerseKey & {
  text: string;
  pieceIndex: number;
};

/** The passage verse by verse, so each verse is scored and hinted on its own. */
export function passageVersesIn(
  segments: readonly CompositePassageSegment[],
): PassageVerse[] {
  return segments.flatMap((segment, pieceIndex) =>
    segment.verses.map((verse) => ({
      chapter: segment.reference.chapter,
      verse: verse.number,
      text: verse.text,
      pieceIndex,
    })),
  );
}

/**
 * First letters on `targets` only (every verse when none is among them),
 * every other word blank in place. Each verse starts on its own line, with a
 * blank line where the chapter changes. With `random`, each hinted verse shows
 * a random half of first letters instead of one on every word.
 */
export function firstLettersHintText(
  segments: readonly CompositePassageSegment[],
  targets: readonly PassageVerseKey[],
  random?: () => number,
): string {
  const verses = passageVersesIn(segments);
  const masked = shakyFirstLettersHint(verses, targets, random);
  return stackVerseHints(
    verses.map((verse, index) => ({
      chapter: `${segments[verse.pieceIndex]?.reference.book}|${verse.chapter}`,
      tokens: [{ text: masked[index] ?? "", word: false, masked: false }],
    })),
  )
    .map((token) => token.text)
    .join("");
}

/**
 * Whether a Memorized passage is stale (R48): a verse's rule over the
 * passage's own recent reviews. One rule for the passage session and the
 * Today passage card. Undefined while the reviews load, or with no passage.
 */
export function usePassageStale(
  passage: {
    packId: Id<"packs">;
    status: "reviewing" | "mastered";
    dueAt: number;
    intervalDays: number;
    startedOverAt?: number;
  } | null,
  now: number,
): boolean | undefined {
  const recentReviews = useQuery(
    api.passageMemory.recentReviews,
    passage ? { packId: passage.packId } : "skip",
  );
  if (!passage || recentReviews === undefined) return undefined;
  return isStaleVerse({
    status: passage.status,
    dueAt: passage.dueAt,
    intervalDays: passage.intervalDays,
    now,
    startedOverAt: passage.startedOverAt,
    lastReviews: recentReviews,
  });
}

function tzOffsetMinutesAt(now: number): number {
  return new Date(now).getTimezoneOffset();
}

/**
 * A Memorized passage's counted review tries and their held cold miss (S11),
 * shared by the passage session and the Today run's passage card. A cold miss
 * is held on the server: Continue, leaving, the next load or the backstop
 * counts it, once, and only a finished From memory try replaces it.
 */
export function usePassageReview() {
  const recordAttempt = useMutation(api.passageMemory.recordAttempt);
  const holdAttempt = useMutation(api.passageMemory.holdAttempt);
  const applyHeldAttempt = useMutation(api.passageMemory.applyHeldAttempt);
  const notePracticeRecital = useMutation(
    api.passageMemory.notePracticeRecital,
  );
  const [heldMiss, setHeldMissState] = useState<HeldMiss | null>(null);
  const heldRef = useRef<HeldMiss | null>(null);

  function setHeldMiss(next: HeldMiss | null) {
    heldRef.current = next;
    setHeldMissState(next);
  }

  /** Hold a cold miss. Nothing counts until it is applied. Throws on failure. */
  async function hold(
    packId: Id<"packs">,
    save: ReviewSave,
  ): Promise<Id<"heldPassageAttempts">> {
    const { heldId } = await holdAttempt({
      packId,
      quality: save.quality,
      accuracy: save.accuracy,
      verseScores: save.verseScores,
      now: save.now,
      tzOffsetMinutes: tzOffsetMinutesAt(save.now),
      timeZone: getViewerTimeZone(),
      durationMs: save.durationMs,
    });
    setHeldMiss({ packId, heldId, save });
    return heldId;
  }

  /**
   * Count the held miss, once: `null` when nothing is held (any more). Throws
   * on failure and keeps the miss held.
   */
  async function applyHeld(): Promise<{
    save: ReviewSave;
    view: PassageView | null;
  } | null> {
    const held = heldRef.current;
    if (!held) return null;
    heldRef.current = null;
    try {
      const now = Date.now();
      const view = await applyHeldAttempt({
        heldId: held.heldId,
        packId: held.packId,
        now,
        tzOffsetMinutes: tzOffsetMinutesAt(now),
      });
      setHeldMiss(null);
      return { save: held.save, view };
    } catch (error) {
      heldRef.current = held;
      throw error;
    }
  }

  /**
   * Save a counted try. With `replaceHeld`, it is the From memory try that
   * replaces the held miss, which comes back as `replaced`. Throws on failure.
   */
  async function record(
    packId: Id<"packs">,
    save: ReviewSave,
    replaceHeld: boolean,
  ): Promise<{ view: PassageView; replaced: ReviewSave | null }> {
    const held = replaceHeld ? heldRef.current : null;
    const view = await recordAttempt({
      packId,
      kind: "review",
      quality: save.quality,
      accuracy: save.accuracy,
      now: save.now,
      tzOffsetMinutes: tzOffsetMinutesAt(save.now),
      timeZone: getViewerTimeZone(),
      durationMs: save.durationMs,
      verseScores: save.verseScores,
      refresherUsed: save.refresherUsed,
      replaceHeldId: held?.heldId,
    });
    if (held && heldRef.current === held) setHeldMiss(null);
    return { view, replaced: held?.save ?? null };
  }

  /**
   * A practice-only recital: clears verses it recited cleanly, marks none.
   * `null` when that fails; the practice result stands either way.
   */
  async function notePractice(
    packId: Id<"packs">,
    save: ReviewSave,
  ): Promise<PassageView | null> {
    try {
      return await notePracticeRecital({
        packId,
        verseScores: save.verseScores,
        now: save.now,
        tzOffsetMinutes: tzOffsetMinutesAt(save.now),
      });
    } catch {
      return null;
    }
  }

  /** Verses a refresher hints: the remembered shaky ones and the held miss's. */
  function hintTargets(shaky: readonly PassageVerseKey[]): PassageVerseKey[] {
    return [
      ...shaky,
      ...(heldMiss ? missedVerses(heldMiss.save.verseScores) : []),
    ];
  }

  // Leaving a seen miss counts it: Back, Home, or the tab. If this apply
  // never lands, the next load or the backstop does it.
  const applyHeldOnLeave = useEffectEvent(() => {
    void applyHeld().catch(() => undefined);
  });
  useEffect(() => {
    const leave = () => applyHeldOnLeave();
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  return { heldMiss, hold, applyHeld, record, notePractice, hintTargets };
}

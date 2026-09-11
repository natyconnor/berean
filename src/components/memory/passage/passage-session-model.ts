import type { CardReference } from "@/components/study/study-card-model";
import {
  countVerseWords,
  hintForProgress,
  maskVerseText,
  type HintToken,
} from "@/lib/verse-hint";
import {
  rehearsalStartIndex,
  remainingIntroduces,
  ropePieceIndexes,
  sectionStartIndex,
  localDayIndex,
  isPassagePieceLocked,
} from "@/lib/passage-frontier";
import { MAX_LEARN_STAGE } from "@/lib/memory-scheduler";
import type { PassagePiece } from "@/lib/passage-pieces";
import {
  initialPassageSessionPhase,
  repairWindowStart,
  type PassageSessionPhase,
  type PassageSessionState,
} from "@/lib/passage-session";
import { formatVerseRef } from "@/lib/verse-ref-utils";

import type { PassageView } from "./passage-session-types";

export const PASSAGE_SESSION_PHASE_LABELS: Record<PassageSessionPhase, string> =
  {
    rope: "Warm up",
    "stall-repair": "Practice",
    frontier: "Learn",
    "offer-introduce": "Learn",
    "section-complete": "Learn",
    connect: "Practice",
    "passage-complete": "Review",
    "budget-exhausted": "Learn",
    "frontier-locked": "Learn",
  };

/** Soft-locked current verse; no more work on it today. */
export const FRONTIER_LOCKED_COPY =
  "You've got this verse down for the day. Come back tomorrow to keep going with it.";

export const NEXT_VERSE_PROMPT_COPY =
  "You've got this verse down for the day. Start the next one?";

export const START_VERSE_PROMPT_COPY = "Ready to begin this verse?";

export const DONE_FOR_NOW_LABEL = "That's enough for today";

export const SECTION_COMPLETE_COPY =
  "You've finished this section. Recite it together, or keep going.";

export const SECTION_RECITE_LABEL = "Recite this section";

export const CONNECT_COPY =
  "Link the verse you just learned to the one before it.";

export const CONNECT_RECITE_LABEL = "Recite together";

export const CONNECT_TITLE = "Connect these verses";

export const WARMUP_PROMPT_COPY =
  "Warm up with what you've learned so far — then keep going.";

export const WARMUP_SKIP_LABEL = "Skip warm-up";

export const PRACTICE_ROPE_PROMPT_COPY =
  "Practice these verses together. Hints fade as they get solid.";

export const PRACTICE_WHAT_YOU_KNOW_LABEL = "Practice what you know";

const STALL_CUE_PREVIOUS_WORDS = 6;

export type RopeStartOverride = "rehearsal" | "section" | "beginning";

export function pieceCardTitle(piece: PassagePiece): string {
  return formatVerseRef({
    book: piece.book,
    chapter: piece.chapter,
    startVerse: piece.startVerse,
    endVerse: piece.endVerse,
  });
}

export function frontierHint(
  text: string,
  learnStage: number,
  stageReps: number,
): { tokens: HintToken[]; stage: ReturnType<typeof hintForProgress>["stage"] } {
  const wordCount = countVerseWords(text);
  const hint = hintForProgress(learnStage, stageReps, wordCount);
  return {
    stage: hint.stage,
    tokens: maskVerseText(text, hint.stage, {
      density: hint.density,
      seed: hint.seed,
    }),
  };
}

export type StallCueContent = {
  text: string;
  label: "Pick up after" | "Starting hint";
};

/**
 * Bridge / recovery cue after a failed multi-verse recitation.
 * When the main panel already shows Guided/Challenge letter hints, only keep
 * the clear-text bridge from the previous verse — do not duplicate first letters.
 */
export function stallRepairCue(
  previousText: string | undefined,
  stalledText: string,
  options?: { includeStalledLetters?: boolean },
): string {
  const previousEnd = previousText
    ? previousText
        .trim()
        .split(/\s+/)
        .slice(-STALL_CUE_PREVIOUS_WORDS)
        .join(" ")
    : "";
  if (options?.includeStalledLetters === false) {
    return previousEnd;
  }
  const stalledLetters = maskVerseText(stalledText, "first-letters")
    .map((token) => token.text)
    .join("");
  return [previousEnd, stalledLetters]
    .filter((part) => part.length > 0)
    .join(" ");
}

/** True when the repair window already shows Guided/Challenge-style hints. */
export function repairWindowShowsStageHints(
  pieces: readonly PassagePiece[],
  indexes: readonly number[],
): boolean {
  return indexes.some((index) => {
    const piece = pieces[index];
    return (
      piece != null &&
      piece.attachment === "attached" &&
      piece.learnStage < MAX_LEARN_STAGE
    );
  });
}

export function ropeWindowPieceIndexes(
  pieces: readonly PassagePiece[],
  override: RopeStartOverride,
  pieceWordCounts?: readonly number[],
): number[] {
  const rope = ropePieceIndexes(pieces);
  if (rope.length === 0) return [];
  const last = rope[rope.length - 1] ?? 0;
  let start: number;
  if (override === "beginning") {
    start = rope[0] ?? 0;
  } else if (override === "section") {
    start = sectionStartIndex(pieces, last);
  } else {
    start = rehearsalStartIndex(pieces, pieceWordCounts);
  }
  return rope.filter((index) => index >= start);
}

export function pieceReference(piece: PassagePiece): CardReference {
  return {
    book: piece.book,
    chapter: piece.chapter,
    startVerse: piece.startVerse,
    endVerse: piece.endVerse,
  };
}

export function joinPieceTexts(
  pieces: readonly PassagePiece[],
  indexes: readonly number[],
  texts: readonly string[],
): string {
  let result = "";
  let previousChapter: string | null = null;
  for (const index of indexes) {
    const piece = pieces[index];
    const text = texts[index];
    if (!piece || !text) continue;
    const key = `${piece.book}|${piece.chapter}`;
    if (result.length > 0) {
      result +=
        previousChapter !== null && previousChapter !== key ? "\n" : " ";
    }
    result += text;
    previousChapter = key;
  }
  return result;
}

export function verseCountIn(pieces: readonly PassagePiece[]): number {
  return pieces.reduce(
    (sum, piece) => sum + (piece.endVerse - piece.startVerse + 1),
    0,
  );
}

export function windowTitle(
  packName: string,
  pieces: readonly PassagePiece[],
  indexes: readonly number[],
): string {
  const first = pieces[indexes[0] ?? -1];
  const last = pieces[indexes[indexes.length - 1] ?? -1];
  if (!first) return packName;
  if (!last || first === last) return pieceCardTitle(first);
  if (first.book === last.book && first.chapter === last.chapter) {
    return formatVerseRef({
      book: first.book,
      chapter: first.chapter,
      startVerse: first.startVerse,
      endVerse: last.endVerse,
    });
  }
  return packName;
}

export function repairPromptIndexes(state: PassageSessionState): number[] {
  const mapping =
    state.rehearsalRopeIndexes && state.rehearsalRopeIndexes.length > 0
      ? state.rehearsalRopeIndexes
      : ropePieceIndexes(state.pieces);
  const start = repairWindowStart(state);
  const slice = mapping.filter((index) => index >= start);
  return slice.length > 0 ? [...slice] : [...mapping];
}

export function computeStallCue(
  state: PassageSessionState,
  texts: readonly string[],
): StallCueContent | null {
  if (state.phase !== "stall-repair") return null;
  const mapping = state.rehearsalRopeIndexes ?? [];
  const stallLocal = state.stallIndex ?? 0;
  const stalledIndex = mapping[stallLocal];
  const previousIndex = stallLocal > 0 ? mapping[stallLocal - 1] : undefined;
  const stalledText =
    stalledIndex !== undefined ? (texts[stalledIndex] ?? "") : "";
  const previousText =
    previousIndex !== undefined ? texts[previousIndex] : undefined;
  const indexes = repairPromptIndexes(state);
  const showsStageHints = repairWindowShowsStageHints(state.pieces, indexes);
  const cue = stallRepairCue(previousText, stalledText, {
    includeStalledLetters: !showsStageHints,
  });
  if (cue.length === 0) return null;
  return {
    text: cue,
    label: showsStageHints ? "Pick up after" : "Starting hint",
  };
}

export function sessionFromView(
  view: PassageView,
  now: number,
  tzOffsetMinutes: number,
  pieceWordCounts?: readonly number[],
): PassageSessionState {
  return {
    phase: initialPassageSessionPhase({
      pieces: view.pieces,
      remainingIntroduces: view.remainingIntroduces,
      now,
    }),
    pieces: view.pieces,
    addsOnDay: view.addsOnDay,
    addDayKey: view.addDayKey,
    now,
    tzOffsetMinutes,
    pieceWordCounts,
  };
}

export function chromeStage(
  pieces: readonly PassagePiece[],
  indexes: readonly number[],
): number {
  let min = 3;
  let found = false;
  for (const index of indexes) {
    const piece = pieces[index];
    if (!piece || piece.attachment === "solid") continue;
    min = Math.min(min, piece.learnStage);
    found = true;
  }
  return found ? min : 3;
}

export function pieceStatus(piece: PassagePiece): "learning" | "reviewing" {
  return piece.attachment === "solid" ? "reviewing" : "learning";
}

export function tzOffsetMinutesAt(now: number): number {
  return new Date(now).getTimezoneOffset();
}

export function remainingAddsIn(state: PassageSessionState): number {
  return remainingIntroduces({
    addsOnDay: state.addsOnDay,
    addDayKey: state.addDayKey,
    todayKey: localDayIndex(state.now, state.tzOffsetMinutes),
  });
}

export function hasStartedPassage(pieces: readonly PassagePiece[]): boolean {
  return pieces.some((piece) => piece.attachment !== "unreached");
}

export function nextUnreachedPiece(
  pieces: readonly PassagePiece[],
): PassagePiece | undefined {
  return pieces.find((piece) => piece.attachment === "unreached");
}

export function latestLockedPiece(
  pieces: readonly PassagePiece[],
  now: number,
): PassagePiece | undefined {
  for (let index = pieces.length - 1; index >= 0; index -= 1) {
    const piece = pieces[index];
    if (piece && isPassagePieceLocked(piece, now)) return piece;
  }
  return undefined;
}

export function sectionIndexes(pieces: readonly PassagePiece[]): number[] {
  const lastSolid = [...pieces]
    .reverse()
    .find((piece) => piece.attachment === "solid");
  if (!lastSolid) return [];
  return pieces
    .filter((piece) => piece.sectionIndex === lastSolid.sectionIndex)
    .map((piece) => piece.index);
}

export { connectPairIndexes } from "@/lib/passage-frontier";

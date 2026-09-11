import { describe, expect, it } from "vitest";

import type { VerseSpan } from "./hearted-verse-coverage";
import {
  DAY_MS,
  LEARN_PROGRESS_ACCURACY,
  requiredRepsFor,
} from "./memory-scheduler";
import {
  compositeHintForWindow,
  connectPairIndexes,
  dueFrontierIndex,
  frontierIndex,
  inferPieceLearningState,
  localDayIndex,
  looksLikeAutoHeartedPassage,
  matchingAutoHeartSpans,
  PASSAGE_MAX_ADDS_PER_DAY,
  PASSAGE_PASS_ACCURACY,
  PASSAGE_REHEARSAL_MAX_PIECES,
  PASSAGE_REHEARSAL_MAX_WORDS,
  progressPassagePiece,
  rehearsalStartIndex,
  remainingIntroduces,
  ropePieceIndexes,
  sectionStartIndex,
  type HeartedMemorySpan,
} from "./passage-frontier";
import type { PassagePiece, PassagePieceBase } from "./passage-pieces";
import { countVerseWords, hintForProgress, maskVerseText } from "./verse-hint";
import type { VerseScope } from "./verse-scope-match";

function base(
  index: number,
  extra?: Partial<PassagePieceBase>,
): PassagePieceBase {
  return {
    index,
    book: "Psalms",
    chapter: 1,
    startVerse: index * 2 + 1,
    endVerse: index * 2 + 2,
    sectionIndex: 0,
    ...extra,
  };
}

function piece(
  index: number,
  attachment: PassagePiece["attachment"],
  extra?: Partial<PassagePiece>,
): PassagePiece {
  return {
    ...base(index),
    attachment,
    learnStage: 0,
    stageReps: 0,
    ...extra,
  };
}

const PSALM_1: VerseScope = {
  books: ["Psalms"],
  chapterRanges: [{ book: "Psalms", startChapter: 1, endChapter: 1 }],
};

describe("passage introduce budget", () => {
  it("exports the 85% pass threshold from LEARN_PROGRESS_ACCURACY", () => {
    expect(PASSAGE_PASS_ACCURACY).toBe(LEARN_PROGRESS_ACCURACY);
    expect(PASSAGE_PASS_ACCURACY).toBe(85);
  });

  it("resets remaining introduces on a new localDayIndex", () => {
    expect(localDayIndex(DAY_MS * 10, 0)).toBe(10);
    expect(
      remainingIntroduces({
        addsOnDay: 5,
        addDayKey: 10,
        todayKey: 10,
      }),
    ).toBe(0);
    expect(
      remainingIntroduces({
        addsOnDay: 5,
        addDayKey: 10,
        todayKey: 11,
      }),
    ).toBe(PASSAGE_MAX_ADDS_PER_DAY);
    expect(
      remainingIntroduces({
        addsOnDay: 2,
        addDayKey: undefined,
        todayKey: 11,
      }),
    ).toBe(PASSAGE_MAX_ADDS_PER_DAY);
  });
});

describe("frontierIndex / ropePieceIndexes / sectionStartIndex", () => {
  it("points frontier at the first non-solid and lists the rope in order", () => {
    const pieces = [
      piece(0, "solid"),
      piece(1, "learning"),
      piece(2, "solid"),
      piece(3, "attached"),
      piece(4, "unreached"),
    ];
    expect(frontierIndex(pieces)).toBe(1);
    expect(ropePieceIndexes(pieces)).toEqual([0, 2, 3]);
    expect(
      frontierIndex(pieces.map((p) => ({ ...p, attachment: "solid" }))),
    ).toBe(5);
  });

  it("returns the first piece of the same section", () => {
    const pieces = [
      base(0, { sectionIndex: 0 }),
      base(1, { sectionIndex: 0 }),
      base(2, { sectionIndex: 1 }),
      base(3, { sectionIndex: 1 }),
    ];
    expect(sectionStartIndex(pieces, 1)).toBe(0);
    expect(sectionStartIndex(pieces, 3)).toBe(2);
  });

  it("offers a connect pair on every second rope piece", () => {
    expect(connectPairIndexes([piece(0, "attached")])).toBeNull();
    expect(
      connectPairIndexes([piece(0, "attached"), piece(1, "attached")]),
    ).toEqual([0, 1]);
    expect(
      connectPairIndexes([
        piece(0, "attached"),
        piece(1, "attached"),
        piece(2, "attached"),
      ]),
    ).toBeNull();
    expect(
      connectPairIndexes([
        piece(0, "solid"),
        piece(1, "attached"),
        piece(2, "solid"),
        piece(3, "attached"),
      ]),
    ).toEqual([2, 3]);
  });
});

describe("rehearsalStartIndex", () => {
  it("caps the rope window at 3 pieces then 120 words", () => {
    const pieces = [0, 1, 2, 3, 4].map((index) => piece(index, "solid"));
    expect(rehearsalStartIndex(pieces)).toBe(
      pieces.length - PASSAGE_REHEARSAL_MAX_PIECES,
    );

    const longCounts = [50, 50, 50, 50, 50];
    const start = rehearsalStartIndex(pieces, longCounts);
    let words = 0;
    for (let index = start; index < pieces.length; index += 1) {
      words += longCounts[index] ?? 0;
    }
    expect(pieces.length - start).toBeLessThanOrEqual(
      PASSAGE_REHEARSAL_MAX_PIECES,
    );
    expect(words).toBeLessThanOrEqual(PASSAGE_REHEARSAL_MAX_WORDS);
    expect(start).toBe(3);
  });

  it("applies caps on rope pieces only and ignores unreached", () => {
    const pieces = [
      piece(0, "unreached"),
      piece(1, "unreached"),
      piece(2, "solid"),
      piece(3, "attached", { learnStage: 2 }),
      piece(4, "solid"),
    ];
    expect(rehearsalStartIndex(pieces)).toBe(2);
    expect(rehearsalStartIndex([])).toBe(0);
    expect(
      rehearsalStartIndex([piece(0, "learning"), piece(1, "unreached")]),
    ).toBe(0);
  });
});

describe("inferPieceLearningState", () => {
  it("maps review hearts to solid and does not skip a learning gap for frontier", () => {
    const pieces = [base(0), base(1), base(2)];
    const hearts: HeartedMemorySpan[] = [
      {
        book: "Psalms",
        chapter: 1,
        startVerse: 1,
        endVerse: 2,
        status: "reviewing",
      },
      {
        book: "Psalms",
        chapter: 1,
        startVerse: 5,
        endVerse: 6,
        status: "mastered",
      },
    ];
    const inferred = inferPieceLearningState(pieces, hearts);
    expect(inferred[0]?.attachment).toBe("solid");
    expect(inferred[1]?.attachment).toBe("unreached");
    expect(inferred[2]?.attachment).toBe("solid");

    expect(inferred.findIndex((state) => state.attachment !== "solid")).toBe(1);
  });

  it("maps Guided-cleared learning hearts to attached", () => {
    const pieces = [base(0)];
    const learning: HeartedMemorySpan[] = [
      {
        book: "Psalms",
        chapter: 1,
        startVerse: 1,
        endVerse: 2,
        status: "learning",
        learnStage: 1,
        stageReps: 2,
      },
    ];
    expect(inferPieceLearningState(pieces, learning)[0]).toEqual({
      attachment: "learning",
      learnStage: 1,
      stageReps: 2,
    });

    const attached: HeartedMemorySpan[] = [
      {
        book: "Psalms",
        chapter: 1,
        startVerse: 1,
        endVerse: 2,
        status: "learning",
        learnStage: 2,
        stageReps: 1,
      },
    ];
    expect(inferPieceLearningState(pieces, attached)[0]).toEqual({
      attachment: "attached",
      learnStage: 2,
      stageReps: 1,
    });
  });
});

describe("auto-heart helpers", () => {
  it("treats a 1:1 piece/heart bijection with full coverage as auto-hearted", () => {
    const pieces = [
      base(0, { startVerse: 1, endVerse: 2 }),
      base(1, { startVerse: 3, endVerse: 4 }),
      base(2, { startVerse: 5, endVerse: 6 }),
    ];
    const hearts: VerseSpan[] = pieces.map((p) => ({
      book: p.book,
      chapter: p.chapter,
      startVerse: p.startVerse,
      endVerse: p.endVerse,
    }));
    expect(looksLikeAutoHeartedPassage(pieces, hearts, PSALM_1)).toBe(true);
    expect(matchingAutoHeartSpans(pieces, hearts)).toEqual(hearts);

    const userShaped: VerseSpan[] = [
      { book: "Psalms", chapter: 1, startVerse: 1, endVerse: 6 },
    ];
    expect(looksLikeAutoHeartedPassage(pieces, userShaped, PSALM_1)).toBe(
      false,
    );
    expect(matchingAutoHeartSpans(pieces, userShaped)).toEqual([]);

    const withExtra = [
      ...hearts,
      { book: "Psalms", chapter: 1, startVerse: 1, endVerse: 1 },
    ];
    expect(looksLikeAutoHeartedPassage(pieces, withExtra, PSALM_1)).toBe(false);
    expect(matchingAutoHeartSpans(pieces, withExtra)).toEqual(hearts);
  });
});

describe("compositeHintForWindow", () => {
  it("uses per-piece stages: solid is blank, attached uses learnStage", () => {
    const solidText = "Blessed is the man";
    const attachedText = "who walks not in the counsel of the wicked";
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "attached", { learnStage: 2, stageReps: 0 }),
      piece(2, "learning", { learnStage: 0 }),
    ];
    const texts = [solidText, attachedText, "unused learning"];
    const hint = compositeHintForWindow(pieces, 0, 3, texts);

    const solidHint = maskVerseText(solidText, "hidden")
      .map((token) => token.text)
      .join("");
    const attachedProgress = hintForProgress(
      2,
      0,
      countVerseWords(attachedText),
    );
    const attachedHint = maskVerseText(attachedText, attachedProgress.stage, {
      density: attachedProgress.density,
      seed: attachedProgress.seed,
    })
      .map((token) => token.text)
      .join("");

    expect(hint).toBe(`${solidHint} ${attachedHint}`);
    expect(hint).not.toContain("Blessed");
    expect(hint.includes("unused")).toBe(false);
  });
});

describe("progressPassagePiece", () => {
  it("attaches only after Guided clears, not after Read", () => {
    const now = 1_700_000_000_000;
    let current = piece(0, "learning", { learnStage: 0, stageReps: 0 });
    current = progressPassagePiece(current, {
      accuracy: 90,
      now,
      tzOffsetMinutes: 0,
      wordCount: 10,
    });
    expect(current.attachment).toBe("learning");
    expect(current.learnStage).toBe(1);

    const guidedReps = requiredRepsFor(1, 10);
    for (let i = 0; i < guidedReps; i += 1) {
      current = progressPassagePiece(current, {
        accuracy: 90,
        now,
        tzOffsetMinutes: 0,
        wordCount: 10,
      });
    }
    expect(current.attachment).toBe("attached");
    expect(current.learnStage).toBe(2);
    expect(current.dueAt).toBeGreaterThan(now);
  });

  it("does not skip a locked attached piece when a later learning piece is due", () => {
    const now = 1_700_000_000_000;
    const pieces = [
      piece(0, "attached", { learnStage: 2, dueAt: now + DAY_MS }),
      piece(1, "learning", { learnStage: 0, dueAt: now }),
    ];
    expect(frontierIndex(pieces)).toBe(0);
    expect(dueFrontierIndex(pieces, now)).toBe(1);
  });
});

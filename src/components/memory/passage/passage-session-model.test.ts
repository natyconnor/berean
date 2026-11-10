import { describe, expect, it } from "vitest";

import type { PassagePiece } from "@/lib/passage-pieces";

import {
  verseScores,
  computeStallCue,
  CONNECT_TITLE,
  connectPairTitle,
  frontierHint,
  PASSAGE_SESSION_PHASE_LABELS,
  pickUpCue,
  repairWindowShowsStageHints,
  stallRepairCue,
  stopBeforeCue,
} from "./passage-session-model";
import type { PassageSessionState } from "@/lib/passage-session";
import { diffWords } from "@/lib/diff-words";
import {
  countVerseWords,
  hintForProgress,
  maskVerseText,
} from "@/lib/verse-hint";

describe("frontierHint (#378)", () => {
  const ONE = "Blessed is the man who walks not in the counsel of the wicked,";
  const TWO = "but his delight is in the law of the Lord.";
  const text = (tokens: readonly { text: string }[]) =>
    tokens.map((token) => token.text).join("");

  it.each([0, 1, 2])(
    "masks each verse of a multi-verse piece into its own block, at stage %i",
    (learnStage) => {
      const hint = hintForProgress(
        learnStage,
        1,
        countVerseWords(`${ONE} ${TWO}`),
      );
      const mask = (verse: string) =>
        text(
          maskVerseText(verse, hint.stage, {
            density: hint.density,
            seed: hint.seed,
          }),
        );
      const masked = frontierHint([ONE, TWO], learnStage, 1);
      expect(masked.stage).toBe(hint.stage);
      expect(masked.verses.map((verse) => text(verse.tokens))).toEqual([
        mask(ONE),
        mask(TWO),
      ]);
    },
  );

  it("leaves a one-verse piece as it was", () => {
    const hint = hintForProgress(1, 2, countVerseWords(ONE));
    expect(frontierHint([ONE], 1, 2).verses).toEqual([
      {
        chapter: "",
        tokens: maskVerseText(ONE, hint.stage, {
          density: hint.density,
          seed: hint.seed,
        }),
      },
    ]);
  });
});

describe("PASSAGE_SESSION_PHASE_LABELS", () => {
  it("names passage phases without reusing Practice", () => {
    expect(PASSAGE_SESSION_PHASE_LABELS["stall-repair"]).toBe(
      "Fix a tricky spot",
    );
    expect(PASSAGE_SESSION_PHASE_LABELS.connect).toBe("Join verses");
    expect(PASSAGE_SESSION_PHASE_LABELS["passage-complete"]).toBe(
      "Recite it all",
    );
    for (const label of Object.values(PASSAGE_SESSION_PHASE_LABELS)) {
      expect(label).not.toMatch(/practic/i);
    }
  });
});

function piece(
  index: number,
  attachment: PassagePiece["attachment"],
  overrides: Partial<PassagePiece> = {},
): PassagePiece {
  return {
    index,
    book: "Psalms",
    chapter: 1,
    startVerse: index + 1,
    endVerse: index + 1,
    sectionIndex: 0,
    attachment,
    learnStage: 1,
    stageReps: 0,
    dueAt: 0,
    ...overrides,
  };
}

describe("connectPairTitle", () => {
  const ref = (
    chapter: number,
    startVerse: number,
    endVerse = startVerse,
    book = "Psalms",
  ) => ({ book, chapter, startVerse, endVerse });

  it("names verse numbers only within one chapter", () => {
    expect(connectPairTitle([ref(3, 1, 3), ref(3, 4, 5)])).toBe(
      "Connect verses 1–3 to 4–5",
    );
    expect(connectPairTitle([ref(3, 3), ref(3, 4)])).toBe(
      "Connect verse 3 to 4",
    );
    expect(connectPairTitle([ref(3, 3), ref(3, 4, 6)])).toBe(
      "Connect verses 3 to 4–6",
    );
  });

  it("names the chapters when the pair crosses one", () => {
    expect(
      connectPairTitle([ref(7, 24, 25, "Romans"), ref(8, 1, 2, "Romans")]),
    ).toBe("Connect 7:24–25 to 8:1–2");
    expect(
      connectPairTitle([ref(7, 25, 25, "Romans"), ref(8, 1, 1, "Romans")]),
    ).toBe("Connect 7:25 to 8:1");
  });

  it("names the books when the pair crosses one", () => {
    expect(connectPairTitle([ref(150, 6, 6), ref(1, 1, 2, "Proverbs")])).toBe(
      "Connect Psalm 150:6 to Proverbs 1:1–2",
    );
  });

  it("falls back to a plain title without a pair", () => {
    expect(connectPairTitle([])).toBe(CONNECT_TITLE);
    expect(connectPairTitle([ref(3, 1)])).toBe(CONNECT_TITLE);
  });
});

describe("stallRepairCue", () => {
  it("includes first-letter recovery when the main panel has no stage hints", () => {
    const cue = stallRepairCue(
      "end of previous verse here",
      "Blessed is the man",
    );
    expect(cue).toContain("previous verse here");
    expect(cue).toMatch(/B/);
    expect(cue).not.toContain("Blessed is the man");
  });

  it("keeps only the clear bridge when letter hints are already on screen", () => {
    const cue = stallRepairCue(
      "end of previous verse here",
      "Blessed is the man",
      {
        includeStalledLetters: false,
      },
    );
    expect(cue).toBe("end of previous verse here");
  });
});

describe("pickUpCue", () => {
  const texts = [
    "Preserve me, O God, for in you I take refuge.",
    "I say to the LORD, You are my Lord; I have no good apart from you.",
    "As for the saints in the land, they are the excellent ones, in whom is all my delight.",
  ];

  it("cues the last few words of the verse before", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "solid", { learnStage: 3 }),
      piece(2, "learning", { learnStage: 3 }),
    ];
    expect(pickUpCue(pieces, texts, 2)).toEqual({
      text: "have no good apart from you.",
      label: "Pick up after",
    });
  });

  it("returns null at the start of the passage", () => {
    const pieces = [piece(0, "learning", { learnStage: 3 })];
    expect(pickUpCue(pieces, texts, 0)).toBeNull();
  });

  it("only cues from a learning verse when asked", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "learning", { learnStage: 2 }),
      piece(2, "learning", { learnStage: 3 }),
    ];
    expect(pickUpCue(pieces, texts, 2)?.text).toMatch(/refuge\.$/);
    expect(
      pickUpCue(pieces, texts, 2, { includeLearning: true })?.text,
    ).toMatch(/apart from you\.$/);
  });

  it("skips unreached verses", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "unreached"),
      piece(2, "learning", { learnStage: 3 }),
    ];
    expect(
      pickUpCue(pieces, texts, 2, { includeLearning: true })?.text,
    ).toMatch(/refuge\.$/);
  });
});

describe("stopBeforeCue", () => {
  it("cues the first few words of the next verse", () => {
    const texts = [
      "The LORD is my shepherd; I shall not want.",
      "He makes me lie down in green pastures.",
    ];
    expect(stopBeforeCue(texts, 0)).toBe("He makes me lie…");
  });

  it("drops trailing punctuation before the ellipsis", () => {
    const texts = ["Verse one.", "Blessed is the man, who walks not"];
    expect(stopBeforeCue(texts, 0)).toBe("Blessed is the man…");
  });

  it("shows a short next verse whole, without an ellipsis", () => {
    expect(stopBeforeCue(["Verse one.", "Jesus wept."], 0)).toBe("Jesus wept.");
  });

  it("returns null at the end of the passage or before text loads", () => {
    expect(stopBeforeCue(["Only verse."], 0)).toBeNull();
    expect(stopBeforeCue(["Verse one.", ""], 0)).toBeNull();
  });
});

describe("repairWindowShowsStageHints / computeStallCue", () => {
  function stallState(
    pieces: PassagePiece[],
    stallIndex: number,
    rehearsalRopeIndexes: number[],
  ): PassageSessionState {
    return {
      phase: "stall-repair",
      pieces,
      stallIndex,
      rehearsalRopeIndexes,
      addsOnDay: 0,
      addDayKey: 0,
      now: 0,
      tzOffsetMinutes: 0,
    };
  }

  it("detects Guided/Challenge pieces in the repair window", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "attached", { learnStage: 1 }),
    ];
    expect(repairWindowShowsStageHints(pieces, [0, 1])).toBe(true);
    expect(repairWindowShowsStageHints(pieces, [0])).toBe(false);
  });

  it("labels a bridge-only cue from the verse before the repair window", () => {
    const pieces = [
      piece(0, "attached", { learnStage: 1 }),
      piece(1, "attached", { learnStage: 1 }),
      piece(2, "attached", { learnStage: 1 }),
    ];
    // Stall on verse 3 → repair retries from verse 2. Cue must be the ending
    // of verse 1, not the ending of the verse the learner is about to type.
    const cue = computeStallCue(stallState(pieces, 2, [0, 1, 2]), [
      "I have no good apart from you.",
      "As for the saints in the land, they are the excellent ones, in whom is all my delight.",
      "The sorrows of those who run after another god shall multiply.",
    ]);
    expect(cue).not.toBeNull();
    expect(cue?.label).toBe("Pick up after");
    expect(cue?.text).toMatch(/apart from you\.$/);
    expect(cue?.text).not.toMatch(/delight/);
    expect(cue?.text).not.toMatch(/_/);
  });

  it("omits a pick-up phrase when repair starts at the first learned verse", () => {
    const pieces = [
      piece(0, "attached", { learnStage: 1 }),
      piece(1, "attached", { learnStage: 1 }),
    ];
    const cue = computeStallCue(stallState(pieces, 1, [0, 1]), [
      "Blessed is the man who walks not",
      "but his delight is in the law",
    ]);
    expect(cue).toBeNull();
  });

  it("walks back across an unreached gap for the pick-up phrase", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "unreached"),
      piece(2, "attached", { learnStage: 1 }),
      piece(3, "attached", { learnStage: 1 }),
    ];
    const cue = computeStallCue(stallState(pieces, 2, [0, 2, 3]), [
      "end of the earlier verse here",
      "unreached verse should not cue",
      "As for the saints in the land, they are the excellent ones, in whom is all my delight.",
      "The sorrows of those who run after another god shall multiply.",
    ]);
    expect(cue?.label).toBe("Pick up after");
    expect(cue?.text).toBe("end of the earlier verse here");
    expect(cue?.text).not.toContain("unreached");
    expect(cue?.text).not.toContain("delight");
  });

  it("cues from the verse before a mid-passage repair window", () => {
    const pieces = [
      piece(0, "solid", { learnStage: 3 }),
      piece(1, "solid", { learnStage: 3 }),
      piece(2, "attached", { learnStage: 1 }),
      piece(3, "attached", { learnStage: 1 }),
    ];
    const cue = computeStallCue(stallState(pieces, 1, [2, 3]), [
      "Preserve me, O God, for in you I take refuge.",
      "I say to the LORD, You are my Lord; I have no good apart from you.",
      "As for the saints in the land, they are the excellent ones, in whom is all my delight.",
      "The sorrows of those who run after another god shall multiply.",
    ]);
    expect(cue?.label).toBe("Pick up after");
    expect(cue?.text).toMatch(/apart from you\.$/);
    expect(cue?.text).not.toMatch(/delight/);
  });
});

describe("verseScores", () => {
  // Psalm 13:3–4 as one learning piece: still two verses, scored apart.
  const verses = [
    {
      chapter: 13,
      verse: 3,
      text: "Consider and answer me, O Lord my God;",
    },
    { chapter: 13, verse: 4, text: "lest my enemy say, I have prevailed." },
  ];
  const full = verses.map((verse) => verse.text).join(" ");

  it("scores each verse on its own, even inside one piece", () => {
    expect(verseScores(diffWords(verses[1].text, full), verses)).toEqual([
      { chapter: 13, verse: 3, accuracy: 0 },
      { chapter: 13, verse: 4, accuracy: 100 },
    ]);
    expect(verseScores(diffWords(verses[0].text, full), verses)).toEqual([
      { chapter: 13, verse: 3, accuracy: 100 },
      { chapter: 13, verse: 4, accuracy: 0 },
    ]);
  });

  it("charges an extra word to the verse it was typed after", () => {
    const tokens = diffWords(
      "Consider and answer me, O Lord my good God; lest my enemy say, I have prevailed.",
      full,
    );
    const [first, second] = verseScores(tokens, verses);
    expect(first?.accuracy).toBeLessThan(100);
    expect(second?.accuracy).toBe(100);
  });

  it("gives a verse without text no score", () => {
    const tokens = diffWords(verses[0].text, verses[0].text);
    expect(
      verseScores(tokens, [verses[0], { chapter: 13, verse: 4, text: "" }]),
    ).toEqual([{ chapter: 13, verse: 3, accuracy: 100 }]);
  });
});

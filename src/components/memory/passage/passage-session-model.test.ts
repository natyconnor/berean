import { describe, expect, it } from "vitest";

import type { PassagePiece } from "@/lib/passage-pieces";

import {
  verseScores,
  CONNECT_TITLE,
  connectPairTitle,
  nextNewVerse,
  PASSAGE_SESSION_PHASE_LABELS,
  pickUpCue,
  repairResultLine,
  stopBeforeCue,
} from "./passage-session-model";
import type { PassageSessionState } from "@/lib/passage-session";
import { diffWords } from "@/lib/diff-words";

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

describe("repairResultLine", () => {
  it("names the next new verse, with Nathan's exact punctuation", () => {
    expect(repairResultLine(true, 6)).toBe("Nice, now on to verse 6.");
    expect(repairResultLine(false, 6)).toBe(
      "You still need some work on that one, but let's move on to verse 6",
    );
  });

  it("says less when there is no next new verse", () => {
    expect(repairResultLine(true, null)).toBe("Nice.");
    expect(repairResultLine(false, null)).toBe(
      "You still need some work on that one.",
    );
  });
});

describe("nextNewVerse", () => {
  function after(
    phase: PassageSessionState["phase"],
    pieces: PassagePiece[],
  ): PassageSessionState {
    return { phase, pieces, addsOnDay: 0, now: 10, tzOffsetMinutes: 0 };
  }
  const rope = [
    piece(0, "solid", { learnStage: 3 }),
    // Locked until tomorrow.
    piece(1, "attached", { learnStage: 2, dueAt: 2 * 86_400_000 }),
  ];

  it("is the first verse of the next piece to start", () => {
    const pieces = [
      ...rope,
      piece(2, "unreached", { startVerse: 6, endVerse: 7 }),
    ];
    expect(nextNewVerse(after("offer-introduce", pieces))).toBe(6);
  });

  it("is the verse due now", () => {
    const pieces = [...rope, piece(2, "learning", { startVerse: 6 })];
    expect(nextNewVerse(after("frontier", pieces))).toBe(6);
  });

  it("is null when the day's new verses are done or none are left", () => {
    expect(nextNewVerse(after("frontier-locked", rope))).toBeNull();
    expect(nextNewVerse(after("budget-exhausted", rope))).toBeNull();
    expect(nextNewVerse(after("passage-complete", rope))).toBeNull();
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

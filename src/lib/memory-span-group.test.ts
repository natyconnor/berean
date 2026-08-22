import { describe, expect, it } from "vitest";

import type { EsvVerse } from "../../shared/esv-api";
import type { VerseSpan } from "./hearted-verse-coverage";
import { overlappingSpans } from "./hearted-verse-coverage";
import { countVerseWords } from "./verse-hint";
import {
  groupChapterForHearting,
  MAX_GROUP_VERSES,
  MAX_GROUP_WORDS,
  verseEndsSentence,
  type ProposedHeartGroup,
} from "./memory-span-group";

function verse(
  number: number,
  text: string,
  extra?: Pick<EsvVerse, "heading" | "subheading">,
): EsvVerse {
  return { number, text, ...extra };
}

const ELEVEN = "one two three four five six seven eight nine ten eleven.";

function sequentialChapter(
  endVerse: number,
  textFor: (n: number) => EsvVerse,
): EsvVerse[] {
  return Array.from({ length: endVerse }, (_, i) => textFor(i + 1));
}

function refs(groups: ProposedHeartGroup[]) {
  return groups.map((g) => ({
    start: g.startVerse,
    end: g.endVerse,
    kind: g.kind,
  }));
}

describe("verseEndsSentence", () => {
  it("treats . ! ? as endings after trim and trailing quotes/brackets", () => {
    expect(verseEndsSentence("  Hello.  ")).toBe(true);
    expect(verseEndsSentence("Hello!")).toBe(true);
    expect(verseEndsSentence('He said, "Go."')).toBe(true);
    expect(verseEndsSentence("Go.”")).toBe(true);
    expect(verseEndsSentence("Go.)")).toBe(true);
    expect(verseEndsSentence("unfinished")).toBe(false);
    expect(verseEndsSentence("wait,")).toBe(false);
  });
});

describe("groupChapterForHearting", () => {
  it("merges short/partial verses, ends a group on a period, and starts a new group on a heading", () => {
    const verses: EsvVerse[] = [
      verse(1, "Now there was a man"),
      verse(2, "of the Pharisees."),
      verse(3, ELEVEN),
      verse(4, "Jesus answered him,"),
      verse(
        5,
        "Truly, truly, I say to you, unless one is born again he cannot see.",
      ),
      verse(6, "After this heading the unit is new.", {
        heading: "He Must Increase",
      }),
    ];

    const groups = groupChapterForHearting("John", 3, verses, []);
    expect(refs(groups)).toEqual([
      { start: 1, end: 2, kind: "proposed" },
      { start: 3, end: 3, kind: "proposed" },
      { start: 4, end: 5, kind: "proposed" },
      { start: 6, end: 6, kind: "proposed" },
    ]);
    expect(groups.every((g) => g.kind === "proposed")).toBe(true);
  });

  it("groups around an existing heart 3:16 in a 1–21 chapter with a kept chip and no overlap", () => {
    const verses = sequentialChapter(21, (n) => verse(n, ELEVEN));
    const existing: VerseSpan[] = [
      { book: "John", chapter: 3, startVerse: 16, endVerse: 16 },
    ];
    const groups = groupChapterForHearting("John", 3, verses, existing);

    const kept = groups.filter((g) => g.kind === "kept");
    expect(kept).toEqual([
      {
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 16,
        wordCount: countVerseWords(ELEVEN),
        kind: "kept",
      },
    ]);

    const proposed = groups.filter((g) => g.kind === "proposed");
    expect(proposed.some((g) => g.startVerse <= 16 && g.endVerse >= 16)).toBe(
      false,
    );
    expect(Math.min(...proposed.map((g) => g.startVerse))).toBe(1);
    expect(Math.max(...proposed.map((g) => g.endVerse))).toBe(21);
    expect(groups.findIndex((g) => g.kind === "kept")).toBeGreaterThan(0);
    expect(groups.findIndex((g) => g.kind === "kept")).toBeLessThan(
      groups.length - 1,
    );

    for (const group of proposed) {
      expect(
        overlappingSpans(
          {
            book: group.book,
            chapter: group.chapter,
            startVerse: group.startVerse,
            endVerse: group.endVerse,
          },
          existing,
        ),
      ).toEqual([]);
    }
  });

  it("treats a paragraph \\n\\n as a hard break even without a period", () => {
    const verses: EsvVerse[] = [
      verse(1, "Blessed is the man who walks\n\n"),
      verse(2, "and on his law he meditates"),
    ];
    const groups = groupChapterForHearting("Psalms", 1, verses, []);
    expect(refs(groups)).toEqual([
      { start: 1, end: 1, kind: "proposed" },
      { start: 2, end: 2, kind: "proposed" },
    ]);
  });

  it("never proposes more than 4 verses or 60 words in a group", () => {
    const fiveOpen = sequentialChapter(5, (n) =>
      verse(n, "short open clause here"),
    );
    const verseCapped = groupChapterForHearting("John", 1, fiveOpen, []);
    expect(verseCapped.every((g) => g.kind === "proposed")).toBe(true);
    expect(
      verseCapped.every(
        (g) => g.endVerse - g.startVerse + 1 <= MAX_GROUP_VERSES,
      ),
    ).toBe(true);
    expect(verseCapped.some((g) => g.endVerse - g.startVerse + 1 === 4)).toBe(
      true,
    );

    const twentyWords =
      "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty";
    const wordHeavy = sequentialChapter(4, (n) => verse(n, twentyWords));
    const wordCapped = groupChapterForHearting("John", 1, wordHeavy, []);
    expect(wordCapped.every((g) => g.wordCount <= MAX_GROUP_WORDS)).toBe(true);
    expect(wordCapped.every((g) => g.endVerse - g.startVerse + 1 <= 3)).toBe(
      true,
    );
  });

  it("starts a new group on a subheading", () => {
    const verses: EsvVerse[] = [
      verse(1, "She speaks without ending"),
      verse(2, "He answers after the speaker label.", { subheading: "He" }),
    ];
    expect(
      refs(groupChapterForHearting("Song of Solomon", 1, verses, [])),
    ).toEqual([
      { start: 1, end: 1, kind: "proposed" },
      { start: 2, end: 2, kind: "proposed" },
    ]);
  });
});

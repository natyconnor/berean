import { describe, expect, it } from "vitest";

import type { Id } from "../../../convex/_generated/dataModel";

import { dueQueueEntryToPracticeVerse } from "./to-practice-verse";

const PACK_ID = "pack_1" as Id<"packs">;

describe("dueQueueEntryToPracticeVerse", () => {
  it("maps a verse row without a composite card", () => {
    const verse = dueQueueEntryToPracticeVerse({
      kind: "verse",
      book: "Psalms",
      chapter: 23,
      startVerse: 1,
      endVerse: 2,
      learnStage: 3,
      status: "reviewing",
      dueAt: 100,
    });
    expect(verse.learnStage).toBe(3);
    expect(verse.composite).toBeUndefined();
  });

  it("maps a dueForVerse row that has no kind field", () => {
    const verse = dueQueueEntryToPracticeVerse({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
      learnStage: 3,
      status: "reviewing",
      dueAt: 100,
    });
    expect(verse.reference).toEqual({
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
    });
    expect(verse.composite).toBeUndefined();
  });

  it("maps a unified pack as one composite card labeled with the pack name", () => {
    const verse = dueQueueEntryToPracticeVerse({
      kind: "pack",
      packId: PACK_ID,
      packName: "Psalm 23",
      dueAt: 50,
      status: "reviewing",
      learnStage: 3,
      ease: 2.5,
      intervalDays: 1,
      consecutiveCorrect: 1,
      lapses: 0,
      members: [
        { book: "Psalms", chapter: 23, startVerse: 1, endVerse: 3 },
        { book: "Psalms", chapter: 23, startVerse: 4, endVerse: 6 },
      ],
    });
    expect(verse.composite).toEqual({
      packId: PACK_ID,
      packName: "Psalm 23",
      members: [
        { book: "Psalms", chapter: 23, startVerse: 1, endVerse: 3 },
        { book: "Psalms", chapter: 23, startVerse: 4, endVerse: 6 },
      ],
    });
    expect(verse.dueAt).toBe(50);
    expect(verse.reference.startVerse).toBe(1);
  });
});

import { describe, expect, it } from "vitest";

import type { VerseSpan } from "./hearted-verse-coverage";
import {
  backfilledInMemory,
  inMemoryMembershipFlags,
  shouldBeInMemory,
  type InMemoryMembership,
  type InMemoryRuleInput,
} from "./in-memory-migration";

function input(overrides: Partial<InMemoryRuleInput>): InMemoryRuleInput {
  return {
    isHearted: true,
    status: "new",
    inCustomPack: false,
    inScopePack: false,
    inActivePassage: false,
    ...overrides,
  };
}

describe("backfilledInMemory", () => {
  it("derives rows whose inMemory is unset", () => {
    expect(backfilledInMemory(undefined, () => true, false)).toBe(true);
    expect(backfilledInMemory(undefined, () => false, false)).toBe(false);
  });

  it("keeps rows that already have a value without deriving", () => {
    const derive = () => {
      throw new Error("should not derive");
    };
    expect(backfilledInMemory(true, derive, false)).toBe(true);
    expect(backfilledInMemory(false, derive, false)).toBe(false);
  });

  it("re-derives rows that already have a value when forced", () => {
    expect(backfilledInMemory(true, () => false, true)).toBe(false);
    expect(backfilledInMemory(false, () => true, true)).toBe(true);
    expect(backfilledInMemory(undefined, () => true, true)).toBe(true);
  });
});

describe("shouldBeInMemory", () => {
  it("moves a hearted, never-started, unpacked verse to hearted-only", () => {
    expect(shouldBeInMemory(input({}))).toBe(false);
  });

  it("keeps hearted verses that have started", () => {
    expect(shouldBeInMemory(input({ status: "learning" }))).toBe(true);
    expect(shouldBeInMemory(input({ status: "reviewing" }))).toBe(true);
    expect(shouldBeInMemory(input({ status: "mastered" }))).toBe(true);
  });

  it("keeps a hearted new verse in a custom pack", () => {
    expect(shouldBeInMemory(input({ inCustomPack: true }))).toBe(true);
  });

  it("keeps a hearted new verse inside a scope pack's scope", () => {
    expect(shouldBeInMemory(input({ inScopePack: true }))).toBe(true);
  });

  it("keeps a hearted new verse inside an active passage", () => {
    expect(shouldBeInMemory(input({ inActivePassage: true }))).toBe(true);
  });

  it("never keeps a verse that is not hearted", () => {
    expect(shouldBeInMemory(input({ isHearted: false }))).toBe(false);
    expect(
      shouldBeInMemory(
        input({
          isHearted: false,
          status: "reviewing",
          inCustomPack: true,
          inScopePack: true,
          inActivePassage: true,
        }),
      ),
    ).toBe(false);
  });
});

describe("inMemoryMembershipFlags", () => {
  const romans828: VerseSpan = {
    book: "Romans",
    chapter: 8,
    startVerse: 28,
    endVerse: 28,
  };
  const psalm1v2: VerseSpan = {
    book: "Psalms",
    chapter: 1,
    startVerse: 2,
    endVerse: 2,
  };

  const membership: InMemoryMembership = {
    customPackVerseRefIds: new Set(["romans-8-28"]),
    scopes: [
      {
        books: ["Psalms"],
        chapterRanges: [{ book: "Psalms", startChapter: 1, endChapter: 2 }],
      },
    ],
    passageSpans: [{ book: "Psalms", chapter: 1, startVerse: 1, endVerse: 3 }],
  };

  it("finds custom pack membership by verse ref id", () => {
    expect(
      inMemoryMembershipFlags("romans-8-28", romans828, membership),
    ).toEqual({
      inCustomPack: true,
      inScopePack: false,
      inActivePassage: false,
    });
  });

  it("finds scope and passage membership by span", () => {
    expect(inMemoryMembershipFlags("psalm-1-2", psalm1v2, membership)).toEqual({
      inCustomPack: false,
      inScopePack: true,
      inActivePassage: true,
    });
  });

  it("requires the passage to contain the whole span", () => {
    const straddling: VerseSpan = {
      book: "Psalms",
      chapter: 1,
      startVerse: 3,
      endVerse: 4,
    };
    expect(
      inMemoryMembershipFlags("psalm-1-3-4", straddling, membership)
        .inActivePassage,
    ).toBe(false);
  });

  it("matches nothing outside every pack and passage", () => {
    const john316: VerseSpan = {
      book: "John",
      chapter: 3,
      startVerse: 16,
      endVerse: 16,
    };
    expect(inMemoryMembershipFlags("john-3-16", john316, membership)).toEqual({
      inCustomPack: false,
      inScopePack: false,
      inActivePassage: false,
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  compareSessionOrderItems,
  groupSessionVersesByChapter,
  sessionOrderRef,
  sortSessionVerses,
} from "./memory-session-order";

function ref(
  book: string,
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
) {
  return { book, chapter, startVerse, endVerse };
}

describe("sessionOrderRef", () => {
  it("uses the verse reference for an ordinary card", () => {
    expect(sessionOrderRef({ reference: ref("Luke", 9, 23, 24) })).toEqual(
      ref("Luke", 9, 23, 24),
    );
  });

  it("uses the earliest member of a unified pack, not Convex lead order", () => {
    expect(
      sessionOrderRef({
        reference: ref("Psalms", 8, 5),
        composite: {
          members: [
            ref("Psalms", 8, 5),
            ref("Psalms", 8, 2),
            ref("Psalms", 8, 3, 4),
          ],
        },
      }),
    ).toEqual(ref("Psalms", 8, 2));
  });
});

describe("sortSessionVerses", () => {
  it("puts a Continue Learning mix into Bible order, keeping a chapter together", () => {
    // Newest-hearted-first, matching savedVerses.listAll / the reported bug.
    const input = [
      { id: "luke", reference: ref("Luke", 9, 23, 24) },
      { id: "ps5", reference: ref("Psalms", 8, 5) },
      { id: "ps34", reference: ref("Psalms", 8, 3, 4) },
      { id: "ps2", reference: ref("Psalms", 8, 2) },
    ];

    expect(sortSessionVerses(input).map((item) => item.id)).toEqual([
      "ps2",
      "ps34",
      "ps5",
      "luke",
    ]);
  });

  it("does not mutate the input", () => {
    const input = [
      { reference: ref("John", 3, 16) },
      { reference: ref("Genesis", 1, 1) },
    ];
    const original = [...input];
    sortSessionVerses(input);
    expect(input).toEqual(original);
  });

  it("places a unified pack with its passage among mixed due verses", () => {
    const psalmPack = {
      id: "pack",
      reference: ref("Psalms", 8, 5),
      composite: {
        members: [
          ref("Psalms", 8, 2),
          ref("Psalms", 8, 3, 4),
          ref("Psalms", 8, 5),
        ],
      },
    };
    const luke = { id: "luke", reference: ref("Luke", 9, 23, 24) };
    const gen = { id: "gen", reference: ref("Genesis", 1, 1) };

    expect(
      sortSessionVerses([luke, psalmPack, gen]).map((item) => item.id),
    ).toEqual(["gen", "pack", "luke"]);
  });
});

describe("compareSessionOrderItems", () => {
  it("orders Psalms before Luke", () => {
    expect(
      compareSessionOrderItems(
        { reference: ref("Psalms", 8, 5) },
        { reference: ref("Luke", 9, 23, 24) },
      ),
    ).toBeLessThan(0);
  });
});

describe("groupSessionVersesByChapter", () => {
  it("keeps a sorted chapter as one block, then the next book", () => {
    const items = sortSessionVerses([
      { id: "luke", reference: ref("Luke", 9, 23, 24) },
      { id: "ps5", reference: ref("Psalms", 8, 5) },
      { id: "ps2", reference: ref("Psalms", 8, 2) },
    ]);

    const groups = groupSessionVersesByChapter(items);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      book: "Psalms",
      chapter: 8,
    });
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["ps2", "ps5"]);
    expect(groups[1]).toMatchObject({ book: "Luke", chapter: 9 });
    expect(groups[1]?.items.map((item) => item.id)).toEqual(["luke"]);
  });
});

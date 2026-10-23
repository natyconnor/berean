import { describe, expect, it } from "vitest";

import {
  compareSessionOrderItems,
  groupSessionVersesByChapter,
  orderSessionVerses,
  sessionClusterCount,
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

describe("orderSessionVerses", () => {
  const mixed = [
    { id: "luke", reference: ref("Luke", 9, 23, 24) },
    { id: "ps5", reference: ref("Psalms", 8, 5) },
    { id: "ps34", reference: ref("Psalms", 8, 3, 4) },
    { id: "ps2", reference: ref("Psalms", 8, 2) },
  ];

  it("keeps a single chapter in Bible order even when shuffled", () => {
    const psalm = mixed.filter((item) => item.id !== "luke");
    expect(
      orderSessionVerses(psalm, "shuffle", 99).map((item) => item.id),
    ).toEqual(["ps2", "ps34", "ps5"]);
    expect(sessionClusterCount(psalm)).toBe(1);
  });

  it("shuffles chapter blocks without breaking Scripture order inside them", () => {
    expect(sessionClusterCount(mixed)).toBe(2);
    const inOrder = orderSessionVerses(mixed, "in-order").map(
      (item) => item.id,
    );
    expect(inOrder).toEqual(["ps2", "ps34", "ps5", "luke"]);

    const shuffledIds = [1, 2, 3, 7, 42].map((seed) =>
      orderSessionVerses(mixed, "shuffle", seed).map((item) => item.id),
    );
    for (const ids of shuffledIds) {
      const psalmStart = ids.indexOf("ps2");
      expect(ids.slice(psalmStart, psalmStart + 3)).toEqual([
        "ps2",
        "ps34",
        "ps5",
      ]);
      expect(ids).toHaveLength(4);
      expect(ids).toContain("luke");
    }
    expect(shuffledIds.some((ids) => ids.join() !== inOrder.join())).toBe(true);
  });
});

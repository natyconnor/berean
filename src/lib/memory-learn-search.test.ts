import { describe, expect, it } from "vitest";

import { validateMemoryLearnSearch } from "./memory-learn-search";

describe("validateMemoryLearnSearch", () => {
  it("keeps the verse scope and an allowed return", () => {
    expect(
      validateMemoryLearnSearch({
        book: "Psalms",
        chapter: "16",
        startVerse: "5",
        endVerse: "6",
        return: "/memory?panel=pack:psalm16",
      }),
    ).toEqual({
      book: "Psalms",
      chapter: 16,
      startVerse: 5,
      endVerse: 6,
      return: "/memory?panel=pack:psalm16",
    });
  });

  it("drops a return outside Memory and the reader", () => {
    expect(validateMemoryLearnSearch({ return: "/settings" })).toEqual({});
  });
});

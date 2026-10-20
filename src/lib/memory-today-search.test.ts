import { describe, expect, it } from "vitest";

import { validateMemoryTodaySearch } from "./memory-today-search";

describe("validateMemoryTodaySearch", () => {
  it("keeps a pack scope and an allowed return", () => {
    expect(
      validateMemoryTodaySearch({
        packId: "k57abc",
        return: "/memory?panel=pack:k57abc",
      }),
    ).toEqual({ packId: "k57abc", return: "/memory?panel=pack:k57abc" });
  });

  it("is empty for the whole of today", () => {
    expect(validateMemoryTodaySearch({})).toEqual({});
  });

  it("keeps only learning or only reviews, and drops anything else", () => {
    expect(
      validateMemoryTodaySearch({ only: "learning", return: "/memory" }),
    ).toEqual({ only: "learning", return: "/memory" });
    expect(validateMemoryTodaySearch({ only: "review" })).toEqual({
      only: "review",
    });
    expect(validateMemoryTodaySearch({ only: "practice" })).toEqual({});
    expect(validateMemoryTodaySearch({ only: 1 })).toEqual({});
  });

  it("drops a malformed pack id and an unsafe return", () => {
    expect(
      validateMemoryTodaySearch({
        packId: "../settings",
        return: "https://evil.com",
      }),
    ).toEqual({});
    expect(validateMemoryTodaySearch({ packId: 7 })).toEqual({});
  });
});

import { describe, expect, it } from "vitest";

import {
  parseMemoryReturn,
  validateMemoryPackPracticeSearch,
  validateMemoryReturnSearch,
  withReturn,
} from "./memory-return";

describe("parseMemoryReturn", () => {
  it.each([
    "/memory",
    "/memory/",
    "/memory?panel=pack:abc",
    "/memory?panel=pack%3Aabc&from=verses",
    "/memory/verses",
    "/memory/verse/v1?from=verses",
    "/memory/k57abc/learn",
    "/passage/John-3",
    "/passage/John-3?startVerse=16&endVerse=16",
  ])("accepts %s", (raw) => {
    expect(parseMemoryReturn(raw)).toBe(raw);
  });

  it.each([
    undefined,
    null,
    7,
    "",
    "memory",
    "//evil.com",
    "//evil.com/memory",
    "https://evil.com/memory",
    "/memory?next=https://evil.com",
    "/\\x",
    "/memory\\evil",
    "/memory//evil",
    "/memory/../settings",
    "/memory/./x",
    "/passage",
    "/passage/",
    "/settings",
    "/search?q=1",
    "/memoryx",
    "/memory#top",
    "/memory\n",
    "/memory\u0000",
    `/memory?x=${"a".repeat(512)}`,
  ])("rejects %o", (raw) => {
    expect(parseMemoryReturn(raw)).toBeUndefined();
  });
});

describe("validateMemoryReturnSearch", () => {
  it("keeps an allowed return", () => {
    expect(
      validateMemoryReturnSearch({ return: "/memory?panel=pack:abc" }),
    ).toEqual({ return: "/memory?panel=pack:abc" });
  });

  it("drops a missing or unsafe return", () => {
    expect(validateMemoryReturnSearch({})).toEqual({});
    expect(
      validateMemoryReturnSearch({ return: "https://evil.com/memory" }),
    ).toEqual({});
  });
});

describe("validateMemoryPackPracticeSearch", () => {
  it("keeps refresh with an allowed return", () => {
    expect(
      validateMemoryPackPracticeSearch({
        return: "/memory/psalm1",
        refresh: "1",
      }),
    ).toEqual({ return: "/memory/psalm1", refresh: true });
  });
});

describe("withReturn", () => {
  it("adds return to a bare path", () => {
    expect(withReturn("/memory/today", "/memory?panel=verses")).toBe(
      "/memory/today?return=%2Fmemory%3Fpanel%3Dverses",
    );
  });

  it("keeps the existing search and hash", () => {
    expect(
      withReturn(
        "/memory/learn?book=Psalms&chapter=16&startVerse=5&endVerse=6#top",
        "/memory/verses",
      ),
    ).toBe(
      "/memory/learn?book=Psalms&chapter=16&startVerse=5&endVerse=6&return=%2Fmemory%2Fverses#top",
    );
  });

  it("replaces an earlier return", () => {
    expect(
      withReturn("/memory/review?return=%2Fmemory", "/memory/verses"),
    ).toBe("/memory/review?return=%2Fmemory%2Fverses");
  });

  it("leaves the href alone when the return is not allowed", () => {
    expect(withReturn("/memory/review", "https://evil.com")).toBe(
      "/memory/review",
    );
  });

  it("round trips through URLSearchParams", () => {
    const href = withReturn("/memory/abc/review", "/memory?panel=pack:abc");
    const query = href.slice(href.indexOf("?") + 1);
    expect(parseMemoryReturn(new URLSearchParams(query).get("return"))).toBe(
      "/memory?panel=pack:abc",
    );
  });
});

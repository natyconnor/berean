import { describe, expect, it } from "vitest";

import {
  isMemorySessionPath,
  memoryPackSessionHref,
  memoryTodaySessionHref,
  memoryVerseSessionHref,
} from "./memory-session-path";

describe("session hrefs", () => {
  it("builds one-verse session hrefs", () => {
    expect(
      memoryVerseSessionHref("review", {
        book: "1 Samuel",
        chapter: 12,
        startVerse: 23,
        endVerse: 24,
      }),
    ).toBe("/memory/review?book=1+Samuel&chapter=12&startVerse=23&endVerse=24");
  });

  it("builds pack session hrefs that read as session paths", () => {
    const href = memoryPackSessionHref("learn", "k57abc");
    expect(href).toBe("/memory/k57abc/learn");
    expect(isMemorySessionPath(href)).toBe(true);
  });

  it("builds the blended Today session href, optionally for one pack", () => {
    expect(memoryTodaySessionHref()).toBe("/memory/today");
    expect(memoryTodaySessionHref({ packId: "k57abc" })).toBe(
      "/memory/today?packId=k57abc",
    );
  });
});

describe("isMemorySessionPath", () => {
  it("treats Today, global Learn, Practice, and Review as sessions", () => {
    expect(isMemorySessionPath("/memory/today")).toBe(true);
    expect(isMemorySessionPath("/memory/learn")).toBe(true);
    expect(isMemorySessionPath("/memory/practice")).toBe(true);
    expect(isMemorySessionPath("/memory/review")).toBe(true);
    expect(isMemorySessionPath("/memory/review/")).toBe(true);
  });

  it("treats pack-scoped Learn, Practice, and Review as sessions", () => {
    expect(isMemorySessionPath("/memory/pack123/learn")).toBe(true);
    expect(isMemorySessionPath("/memory/pack123/practice")).toBe(true);
    expect(isMemorySessionPath("/memory/pack123/review")).toBe(true);
  });

  it("does not skip Memory home, pack view, presets, or other modes", () => {
    expect(isMemorySessionPath("/memory")).toBe(false);
    expect(isMemorySessionPath("/memory/new")).toBe(false);
    expect(isMemorySessionPath("/memory/presets")).toBe(false);
    expect(isMemorySessionPath("/memory/presets/psalm-23")).toBe(false);
    expect(isMemorySessionPath("/memory/pack123")).toBe(false);
    expect(isMemorySessionPath("/passage/John-1")).toBe(false);
    expect(isMemorySessionPath("/study")).toBe(false);
  });
});

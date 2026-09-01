import { afterEach, describe, expect, it } from "vitest";

import {
  clearModeLastLocations,
  DEFAULT_MODE_HREFS,
  isValidModeHref,
  modeForPathname,
  modeNavigateTargetFromHref,
  readModeLastLocations,
  rememberModeLocation,
  resolveModeHref,
} from "./mode-last-location";

describe("mode-last-location", () => {
  afterEach(() => {
    clearModeLastLocations();
  });

  it("maps mode prefixes and ignores unrelated routes", () => {
    expect(modeForPathname("/passage/John-1")).toBe("notes");
    expect(modeForPathname("/passage/John-1/")).toBe("notes");
    expect(modeForPathname("/memory")).toBe("memory");
    expect(modeForPathname("/memory/")).toBe("memory");
    expect(modeForPathname("/memory/review")).toBe("memory");
    expect(modeForPathname("/memory/abc/practice")).toBe("memory");
    expect(modeForPathname("/study")).toBe("study");
    expect(modeForPathname("/study/new")).toBe("study");
    expect(modeForPathname("/settings")).toBeNull();
    expect(modeForPathname("/search")).toBeNull();
    expect(modeForPathname("/memory-leak")).toBeNull();
  });

  it("rejects hrefs that are not a safe in-app path for that mode", () => {
    expect(isValidModeHref("memory", "/memory/packs/abc")).toBe(true);
    expect(
      isValidModeHref("memory", "/memory/review?book=John&chapter=3"),
    ).toBe(true);
    expect(isValidModeHref("notes", "/passage/John-3?startVerse=16")).toBe(
      true,
    );
    expect(isValidModeHref("memory", "/passage/John-1")).toBe(false);
    expect(isValidModeHref("memory", "https://example.com/memory")).toBe(false);
    expect(isValidModeHref("memory", "//evil.example/memory")).toBe(false);
    expect(isValidModeHref("memory", "/memory/../settings")).toBe(false);
    expect(isValidModeHref("notes", "/settings")).toBe(false);
  });

  it("remembers each mode independently, including search params", () => {
    expect(rememberModeLocation("/memory/pack-1", "/memory/pack-1")).toEqual({
      memory: "/memory/pack-1",
    });
    expect(
      rememberModeLocation(
        "/passage/John-3",
        "/passage/John-3?startVerse=16&mode=compose",
      ),
    ).toEqual({
      memory: "/memory/pack-1",
      notes: "/passage/John-3?startVerse=16&mode=compose",
    });
    expect(rememberModeLocation("/settings", "/settings")).toBeNull();
    expect(readModeLastLocations()).toEqual({
      memory: "/memory/pack-1",
      notes: "/passage/John-3?startVerse=16&mode=compose",
    });
  });

  it("does not rewrite a stored mode when visiting a different mode", () => {
    rememberModeLocation("/memory/review", "/memory/review?book=John");
    expect(rememberModeLocation("/passage/Genesis-1", "/passage/Genesis-1"));
    expect(readModeLastLocations()).toEqual({
      memory: "/memory/review?book=John",
      notes: "/passage/Genesis-1",
    });
  });

  it("resolves stored hrefs and falls back when nothing is remembered", () => {
    expect(resolveModeHref("memory", {})).toBe(DEFAULT_MODE_HREFS.memory);
    expect(resolveModeHref("notes", {}, "/passage/Romans-8")).toBe(
      "/passage/Romans-8",
    );
    expect(resolveModeHref("memory", { memory: "/memory/pack-9" })).toBe(
      "/memory/pack-9",
    );
    expect(
      resolveModeHref("notes", { notes: "/settings" }, "/passage/John-1"),
    ).toBe("/passage/John-1");
  });

  it("parses stored hrefs into typed navigate targets", () => {
    expect(modeNavigateTargetFromHref("/memory")).toEqual({ to: "/memory" });
    expect(modeNavigateTargetFromHref("/memory/pack-abc")).toEqual({
      to: "/memory/$packId",
      params: { packId: "pack-abc" },
      search: {},
    });
    expect(
      modeNavigateTargetFromHref(
        "/passage/Romans-8?startVerse=28&mode=compose",
      ),
    ).toEqual({
      to: "/passage/$passageId",
      params: { passageId: "Romans-8" },
      search: {
        startVerse: 28,
        endVerse: 28,
        mode: "compose",
      },
    });
    expect(
      modeNavigateTargetFromHref(
        "/memory/review?book=John&chapter=3&startVerse=16",
      ),
    ).toEqual({
      to: "/memory/review",
      search: {
        book: "John",
        chapter: 3,
        startVerse: 16,
        endVerse: 16,
      },
    });
    expect(modeNavigateTargetFromHref("/settings")).toBeNull();
  });
});

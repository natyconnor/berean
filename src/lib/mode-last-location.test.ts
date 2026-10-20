import { afterEach, describe, expect, it } from "vitest";

import {
  clearModeLastLocations,
  DEFAULT_MODE_HREFS,
  isValidModeHref,
  MODE_LAST_LOCATION_STORAGE_KEY,
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

  it("remembers Today without its open drawer", () => {
    expect(
      rememberModeLocation("/memory", "/memory?panel=pack%3Aabc&from=verses"),
    ).toEqual({ memory: "/memory" });
    expect(readModeLastLocations()).toEqual({ memory: "/memory" });

    expect(
      rememberModeLocation("/memory", "/memory?panel=progress", {
        memory: "/memory",
      }),
    ).toBeNull();
    expect(
      rememberModeLocation("/memory", "/memory?panel=verses", {
        memory: "/memory/pack-1",
      }),
    ).toEqual({ memory: "/memory" });
  });

  it("keeps panel-like params on pages other than Today", () => {
    expect(
      rememberModeLocation("/memory/verse/v1", "/memory/verse/v1?from=verses"),
    ).toEqual({ memory: "/memory/verse/v1?from=verses" });
    expect(
      rememberModeLocation(
        "/memory/review",
        "/memory/review?book=John&return=%2Fmemory%3Fpanel%3Dverses",
      ),
    ).toEqual({
      memory: "/memory/review?book=John&return=%2Fmemory%3Fpanel%3Dverses",
    });
  });

  it("does not remember a session opened from the reader", () => {
    const current = { memory: "/memory/pack-1" };
    for (const href of [
      "/memory/learn?book=John&chapter=2&startVerse=5&endVerse=5&return=%2Fpassage%2FJohn-2",
      "/memory/learn?book=john&chapter=2&startverse=5&endverse=5&return=%2Fpassage%2Fjohn-2",
      "/memory/review?RETURN=%2Fpassage%2FJohn-2%3Fmode%3Dcompose",
      "/memory/today?return=%2Fpassage%2FPsalms-1",
      "/memory/pack-1/practice?return=%2Fpassage%2FPsalms-1",
    ]) {
      const pathname = href.split("?")[0] ?? href;
      expect(rememberModeLocation(pathname, href, current), href).toBeNull();
    }
    expect(resolveModeHref("memory", current)).toBe("/memory/pack-1");
  });

  it("remembers sessions started inside Memory, so leaving one resumes it", () => {
    expect(
      rememberModeLocation("/memory/today", "/memory/today?return=%2Fmemory"),
    ).toEqual({ memory: "/memory/today?return=%2Fmemory" });
    expect(
      rememberModeLocation(
        "/memory/pack-1/learn",
        "/memory/pack-1/learn?return=%2Fmemory%2Fpack-1",
      ),
    ).toEqual({ memory: "/memory/pack-1/learn?return=%2Fmemory%2Fpack-1" });
    expect(rememberModeLocation("/memory/review", "/memory/review")).toEqual({
      memory: "/memory/review",
    });
  });

  it("keeps a page opened from the reader that is not a session", () => {
    expect(
      rememberModeLocation(
        "/memory/new",
        "/memory/new?book=John&chapter=3&return=%2Fpassage%2FJohn-3",
      ),
    ).toEqual({
      memory: "/memory/new?book=John&chapter=3&return=%2Fpassage%2FJohn-3",
    });
  });

  it("sends a reader session stored before back to Today", () => {
    sessionStorage.setItem(
      MODE_LAST_LOCATION_STORAGE_KEY,
      JSON.stringify({
        memory:
          "/memory/learn?book=john&chapter=2&startverse=5&endverse=5&return=%2Fpassage%2Fjohn-2",
        notes: "/passage/John-2",
      }),
    );
    const stored = readModeLastLocations();
    expect(stored).toEqual({ notes: "/passage/John-2" });
    expect(resolveModeHref("memory", stored)).toBe("/memory");
    expect(
      resolveModeHref("memory", {
        memory: "/memory/review?return=%2Fpassage%2FJohn-2",
      }),
    ).toBe("/memory");
  });

  it("drops a drawer from a Today href stored before", () => {
    sessionStorage.setItem(
      MODE_LAST_LOCATION_STORAGE_KEY,
      JSON.stringify({ memory: "/memory?panel=verse%3Av1" }),
    );
    expect(readModeLastLocations()).toEqual({ memory: "/memory" });
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
    expect(modeNavigateTargetFromHref("/memory/presets")).toEqual({
      to: "/memory/presets",
    });
    expect(modeNavigateTargetFromHref("/memory/presets/psalm-23")).toEqual({
      to: "/memory/presets/$presetId",
      params: { presetId: "psalm-23" },
    });
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

  it("leaves static Memory pages to href navigation instead of pack ids", () => {
    expect(
      modeNavigateTargetFromHref("/memory/today?packId=p1&return=%2Fmemory"),
    ).toBeNull();
    expect(modeNavigateTargetFromHref("/memory/verses")).toBeNull();
    expect(modeNavigateTargetFromHref("/memory/progress")).toBeNull();
    expect(modeNavigateTargetFromHref("/memory/verse/v1")).toBeNull();
  });
});

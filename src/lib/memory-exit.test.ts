import { describe, expect, it } from "vitest";

import {
  isMemoryHomeHref,
  memoryExitLookup,
  memoryExitName,
  resolveMemoryExit,
} from "./memory-exit";

describe("resolveMemoryExit", () => {
  it("goes to Memory from a bare session, even when history exists", () => {
    const exit = resolveMemoryExit(undefined);
    expect(exit.href).toBe("/memory");
    expect(exit.label).toBe("Back to Memory");
    expect(exit.name).toBe("Memory");
  });

  it("keeps a return to Memory and names it Memory, not Today", () => {
    const exit = resolveMemoryExit("/memory");
    expect(exit.href).toBe("/memory");
    expect(exit.label).toBe("Back to Memory");
  });

  it("returns to a passage side trip and names the chapter", () => {
    const exit = resolveMemoryExit("/passage/John-3");
    expect(exit.href).toBe("/passage/John-3");
    expect(exit.label).toBe("Back to John 3");
    expect(exit.name).toBe("John 3");
  });

  it("names a verse-range passage from the reader", () => {
    const exit = resolveMemoryExit(
      "/passage/Romans-8?startVerse=28&endVerse=28",
    );
    expect(exit.href).toBe("/passage/Romans-8?startVerse=28&endVerse=28");
    expect(exit.label).toBe("Back to Romans 8");
  });

  it("falls back to Memory when the return is unsafe", () => {
    for (const raw of [
      "https://evil.com",
      "//x",
      "/settings",
      "/memory/../settings",
    ]) {
      const exit = resolveMemoryExit(raw);
      expect(exit.href).toBe("/memory");
      expect(exit.label).toBe("Back to Memory");
    }
  });

  it("uses the pack page when a pack session has no return", () => {
    const exit = resolveMemoryExit(undefined, "/memory/merced", {
      packName: "Merced Team",
    });
    expect(exit.href).toBe("/memory/merced");
    expect(exit.label).toBe("Back to Merced Team");
    expect(exit.name).toBe("Merced Team");
  });

  it("says Back to pack until the name arrives", () => {
    const exit = resolveMemoryExit(undefined, "/memory/merced");
    expect(exit.href).toBe("/memory/merced");
    expect(exit.label).toBe("Back to pack");
  });

  it("falls back to Memory when the pack is gone", () => {
    const exit = resolveMemoryExit("/memory/deletedpack", "/memory", {
      packName: null,
    });
    expect(exit.href).toBe("/memory");
    expect(exit.label).toBe("Back to Memory");
  });

  it("names a verse page once the reference loads", () => {
    const exit = resolveMemoryExit("/memory/verse/vr_romans", undefined, {
      verseLabel: "Romans 8:28",
    });
    expect(exit.href).toBe("/memory/verse/vr_romans");
    expect(exit.label).toBe("Back to Romans 8:28");
  });

  it("falls back to Memory when the verse is gone", () => {
    const exit = resolveMemoryExit("/memory/verse/gone", undefined, {
      verseLabel: null,
    });
    expect(exit.href).toBe("/memory");
    expect(exit.label).toBe("Back to Memory");
  });

  it("names the static Memory pages", () => {
    expect(resolveMemoryExit("/memory/verses").label).toBe(
      "Back to Your verses",
    );
    expect(resolveMemoryExit("/memory/progress").label).toBe(
      "Back to Progress",
    );
    expect(resolveMemoryExit("/memory/presets")).toEqual({
      href: "/memory/presets",
      label: "Back to Suggestions",
      name: "Suggestions",
    });
    expect(resolveMemoryExit("/memory/presets?q=1")).toEqual({
      href: "/memory/presets?q=1",
      label: "Back to Suggestions",
      name: "Suggestions",
    });
    expect(resolveMemoryExit("/memory/new")).toEqual({
      href: "/memory/new",
      label: "Back to New pack",
      name: "New pack",
    });
  });

  it("treats /memory/library as the verses page it redirects to", () => {
    const fromLibrary = resolveMemoryExit("/memory/library");
    const fromVerses = resolveMemoryExit("/memory/verses");
    expect(fromLibrary).toEqual(fromVerses);
    expect(fromLibrary).toEqual({
      href: "/memory/verses",
      label: "Back to Your verses",
      name: "Your verses",
    });
  });

  it("falls back to Memory when the return is a session", () => {
    for (const raw of [
      "/memory/practice",
      "/memory/review",
      "/memory/today",
      "/memory/learn",
      "/memory/merced/review",
    ]) {
      const exit = resolveMemoryExit(raw);
      expect(exit.href).toBe("/memory");
      expect(exit.label).toBe("Back to Memory");
    }
  });

  it("falls back to Memory when a valid return has no name", () => {
    for (const raw of ["/memory/presets/psalm-23", "/memory/verse"]) {
      const exit = resolveMemoryExit(raw);
      expect(exit.href).toBe("/memory");
      expect(exit.label).toBe("Back to Memory");
    }
  });

  it("keeps a Memory drawer return on Memory", () => {
    const exit = resolveMemoryExit("/memory?panel=pack:merced");
    expect(exit.href).toBe("/memory?panel=pack:merced");
    expect(exit.label).toBe("Back to Memory");
    expect(isMemoryHomeHref(exit.href)).toBe(true);
  });
});

describe("memoryExitLookup", () => {
  it("asks for a pack or verse name only when that is the destination", () => {
    expect(memoryExitLookup("/memory")).toEqual({ kind: "none" });
    expect(memoryExitLookup("/passage/John-3")).toEqual({ kind: "none" });
    expect(memoryExitLookup(undefined, "/memory/merced")).toEqual({
      kind: "pack",
      packId: "merced",
    });
    expect(memoryExitLookup("/memory/verse/vr_1")).toEqual({
      kind: "verse",
      verseRefId: "vr_1",
    });
  });
});

describe("memoryExitName", () => {
  it("strips the Back to prefix for the mobile label", () => {
    expect(memoryExitName("Back to John 3")).toBe("John 3");
    expect(memoryExitName("Back to Memory")).toBe("Memory");
  });
});

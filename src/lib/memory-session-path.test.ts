import { describe, expect, it } from "vitest";

import { isMemorySessionPath } from "./memory-session-path";

describe("isMemorySessionPath", () => {
  it("treats global Learn, Practice, and Review as sessions", () => {
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

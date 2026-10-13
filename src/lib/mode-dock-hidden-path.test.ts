import { describe, expect, it } from "vitest";

import { shouldHideModeDock } from "./mode-dock-hidden-path";

describe("shouldHideModeDock", () => {
  it("hides on Settings and nested settings routes", () => {
    expect(shouldHideModeDock("/settings")).toBe(true);
    expect(shouldHideModeDock("/settings/")).toBe(true);
    expect(shouldHideModeDock("/settings/tags")).toBe(true);
  });

  it("hides on public legal paths, including a license page", () => {
    expect(shouldHideModeDock("/terms")).toBe(true);
    expect(shouldHideModeDock("/privacy")).toBe(true);
    expect(shouldHideModeDock("/license")).toBe(true);
    expect(shouldHideModeDock("/license/mit")).toBe(true);
  });

  it("keeps the dock on Notes, Memory, and Study", () => {
    expect(shouldHideModeDock("/passage/John-1")).toBe(false);
    expect(shouldHideModeDock("/memory")).toBe(false);
    expect(shouldHideModeDock("/memory/review")).toBe(false);
    expect(shouldHideModeDock("/study")).toBe(false);
  });
});

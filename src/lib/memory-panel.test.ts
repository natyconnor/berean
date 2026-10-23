import { describe, expect, it } from "vitest";

import {
  formatMemoryPanel,
  memoryPanelDrawerHref,
  memoryPanelFullPagePath,
  parseMemoryPanel,
  validateMemoryHomeSearch,
  validateMemoryPanelPageSearch,
  type MemoryPanel,
} from "./memory-panel";

const PANELS: MemoryPanel[] = [
  { kind: "progress" },
  { kind: "verses" },
  { kind: "pack", packId: "k57abc123" },
  { kind: "verse", verseRefId: "j97xyz_9-Q" },
];

describe("parseMemoryPanel / formatMemoryPanel", () => {
  it.each(PANELS)("round trips %o", (panel) => {
    expect(parseMemoryPanel(formatMemoryPanel(panel))).toEqual(panel);
  });

  it("formats each kind", () => {
    expect(PANELS.map(formatMemoryPanel)).toEqual([
      "progress",
      "verses",
      "pack:k57abc123",
      "verse:j97xyz_9-Q",
    ]);
  });

  it.each([
    undefined,
    null,
    42,
    {},
    "",
    "Progress",
    "library",
    "pack",
    "pack:",
    "verse:",
    "passage:abc",
    "pack:../evil",
    "pack:a/b",
    "pack:abc def",
    "verse:abc?x=1",
    `pack:${"a".repeat(129)}`,
  ])("rejects %o", (raw) => {
    expect(parseMemoryPanel(raw)).toBeUndefined();
  });
});

describe("validateMemoryHomeSearch", () => {
  it("keeps a valid panel and from=verses", () => {
    expect(
      validateMemoryHomeSearch({ panel: "pack:abc", from: "verses" }),
    ).toEqual({ panel: "pack:abc", from: "verses" });
    expect(validateMemoryHomeSearch({ panel: "progress" })).toEqual({
      panel: "progress",
    });
  });

  it("drops unknown panels, unknown from values, and from on Your verses", () => {
    expect(validateMemoryHomeSearch({ panel: "nope", from: "verses" })).toEqual(
      {},
    );
    expect(validateMemoryHomeSearch({ panel: "verse:v1", from: "x" })).toEqual({
      panel: "verse:v1",
    });
    expect(
      validateMemoryHomeSearch({ panel: "verses", from: "verses" }),
    ).toEqual({ panel: "verses" });
    expect(validateMemoryHomeSearch({})).toEqual({});
  });

  it("validates full-page search", () => {
    expect(validateMemoryPanelPageSearch({ from: "verses" })).toEqual({
      from: "verses",
    });
    expect(validateMemoryPanelPageSearch({ from: "today" })).toEqual({});
    expect(validateMemoryPanelPageSearch({ startOver: "1" })).toEqual({
      startOver: true,
    });
  });
});

describe("panel hrefs", () => {
  it("maps each panel to its full page", () => {
    expect(PANELS.map((panel) => memoryPanelFullPagePath(panel))).toEqual([
      "/memory/progress",
      "/memory/verses",
      "/memory/k57abc123",
      "/memory/verse/j97xyz_9-Q",
    ]);
  });

  it("carries from=verses to detail pages only", () => {
    expect(
      memoryPanelFullPagePath(
        { kind: "pack", packId: "abc" },
        { from: "verses" },
      ),
    ).toBe("/memory/abc?from=verses");
    expect(
      memoryPanelFullPagePath({ kind: "verses" }, { from: "verses" }),
    ).toBe("/memory/verses");
  });

  it("builds drawer hrefs over Today", () => {
    expect(memoryPanelDrawerHref({ kind: "verses" })).toBe(
      "/memory?panel=verses",
    );
    expect(
      memoryPanelDrawerHref(
        { kind: "verse", verseRefId: "v1" },
        { from: "verses" },
      ),
    ).toBe("/memory?panel=verse%3Av1&from=verses");
  });
});

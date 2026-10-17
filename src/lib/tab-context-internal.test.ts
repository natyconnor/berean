import { afterEach, describe, expect, it } from "vitest";
import { STORAGE_KEY, loadTabs } from "./tab-context-internal";

describe("loadTabs", () => {
  afterEach(() => {
    localStorage.removeItem(STORAGE_KEY);
  });

  it("relabels a stored one-chapter book tab from the passage id", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: "jude-1", passageId: "Jude-1", label: "Jude 1" }]),
    );

    expect(loadTabs()).toEqual([
      { id: "jude-1", passageId: "Jude-1", label: "Jude" },
    ]);
  });

  it("keeps a multi-chapter tab as book plus chapter", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: "john-3", passageId: "John-3", label: "John 3" }]),
    );

    expect(loadTabs()[0]?.label).toBe("John 3");
  });
});

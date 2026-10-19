import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearPassageStepInProgress,
  isPassageStepReload,
  markPassageStepInProgress,
  PASSAGE_STEP_IN_PROGRESS_KEY,
} from "./passage-step-resume";

const PACK_ID = "pack_1";

function writePriorLoad(packId = PACK_ID): void {
  sessionStorage.setItem(
    PASSAGE_STEP_IN_PROGRESS_KEY,
    JSON.stringify({ packId, origin: performance.timeOrigin - 1 }),
  );
}

describe("passage step resume", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("treats a leftover marker from a prior page load as a reload", () => {
    writePriorLoad();

    expect(isPassageStepReload(PACK_ID)).toBe(true);
  });

  it("treats a leftover marker from this page load as a fresh open", () => {
    markPassageStepInProgress(PACK_ID);

    expect(isPassageStepReload(PACK_ID)).toBe(false);
  });

  it("keeps a prior-load origin so a remount still looks like a reload", () => {
    writePriorLoad();
    markPassageStepInProgress(PACK_ID);

    expect(isPassageStepReload(PACK_ID)).toBe(true);
    expect(
      JSON.parse(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY) ?? "{}"),
    ).toEqual({ packId: PACK_ID, origin: performance.timeOrigin - 1 });
  });

  it("ignores another pack's in-progress marker", () => {
    writePriorLoad("pack_other");

    expect(isPassageStepReload(PACK_ID)).toBe(false);
  });

  it("stops skipping warm-up once the step is cleared", () => {
    writePriorLoad();
    clearPassageStepInProgress(PACK_ID);

    expect(isPassageStepReload(PACK_ID)).toBe(false);
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBeNull();
  });

  it("drops a record that is not a pack-and-origin marker", () => {
    sessionStorage.setItem(
      PASSAGE_STEP_IN_PROGRESS_KEY,
      JSON.stringify({ packId: PACK_ID }),
    );

    expect(isPassageStepReload(PACK_ID)).toBe(false);
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBeNull();
  });

  it("does not throw when sessionStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(isPassageStepReload(PACK_ID)).toBe(false);
    expect(() => markPassageStepInProgress(PACK_ID)).not.toThrow();
    expect(() => clearPassageStepInProgress(PACK_ID)).not.toThrow();
  });
});

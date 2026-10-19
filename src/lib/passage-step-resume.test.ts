import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearPassageStepInProgress,
  discardPassageStepMarkerIfLandedElsewhere,
  isPassageStepReload,
  markPassageStepInProgress,
  PASSAGE_STEP_IN_PROGRESS_KEY,
  releasePassageStepInProgress,
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
    clearPassageStepInProgress(PACK_ID);
    sessionStorage.clear();
    history.replaceState({}, "", "/");
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

  it("treats a leftover marker from another route as a fresh open", () => {
    sessionStorage.setItem(
      PASSAGE_STEP_IN_PROGRESS_KEY,
      JSON.stringify({
        packId: PACK_ID,
        origin: performance.timeOrigin - 1,
        path: "/memory/today",
      }),
    );

    expect(isPassageStepReload(PACK_ID)).toBe(false);
  });

  it("treats a leftover marker from this route as a reload", () => {
    sessionStorage.setItem(
      PASSAGE_STEP_IN_PROGRESS_KEY,
      JSON.stringify({
        packId: PACK_ID,
        origin: performance.timeOrigin - 1,
        path: window.location.pathname,
      }),
    );
    discardPassageStepMarkerIfLandedElsewhere();

    expect(isPassageStepReload(PACK_ID)).toBe(true);
  });

  it("treats a leftover marker as a fresh open after a page load on another path then an in-app return", () => {
    const sessionPath = "/memory/today";
    sessionStorage.setItem(
      PASSAGE_STEP_IN_PROGRESS_KEY,
      JSON.stringify({
        packId: PACK_ID,
        origin: performance.timeOrigin - 1,
        path: sessionPath,
      }),
    );
    history.pushState({}, "", "/memory");
    discardPassageStepMarkerIfLandedElsewhere();
    history.pushState({}, "", sessionPath);

    expect(isPassageStepReload(PACK_ID)).toBe(false);
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBeNull();
  });

  it("stops skipping warm-up once the step is cleared", () => {
    writePriorLoad();
    clearPassageStepInProgress(PACK_ID);

    expect(isPassageStepReload(PACK_ID)).toBe(false);
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBeNull();
  });

  it("drops the marker after an SPA leave so a later page load is a fresh open", async () => {
    markPassageStepInProgress(PACK_ID);
    releasePassageStepInProgress(PACK_ID);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(isPassageStepReload(PACK_ID)).toBe(false);
    expect(sessionStorage.getItem(PASSAGE_STEP_IN_PROGRESS_KEY)).toBeNull();
  });

  it("keeps a prior-load marker when a remount cancels the leave-clear", async () => {
    writePriorLoad();
    markPassageStepInProgress(PACK_ID);
    releasePassageStepInProgress(PACK_ID);
    markPassageStepInProgress(PACK_ID);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(isPassageStepReload(PACK_ID)).toBe(true);
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
    expect(() => discardPassageStepMarkerIfLandedElsewhere()).not.toThrow();
  });
});

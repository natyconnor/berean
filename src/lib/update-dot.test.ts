import { afterEach, describe, expect, it, vi } from "vitest";
import {
  maybeRestoreDot,
  readDotDismissed,
  subscribeToDotDismissed,
  syncDotDismissedAcrossWindows,
} from "./update-dot";

afterEach(() => {
  window.localStorage.clear();
});

describe("maybeRestoreDot", () => {
  const shell = { shellVersion: "1.0.2", webBuildId: null };
  const web = { shellVersion: null, webBuildId: "build-2" };
  const both = { shellVersion: "1.0.2", webBuildId: "build-2" };

  it("shows the dot until Not now", () => {
    expect(maybeRestoreDot(shell, null)).toBe(true);
    expect(maybeRestoreDot(web, null)).toBe(true);
  });

  it("keeps the dot off while the same update stays ready", () => {
    expect(maybeRestoreDot(shell, shell)).toBe(false);
    expect(maybeRestoreDot(web, web)).toBe(false);
    expect(maybeRestoreDot(both, both)).toBe(false);
  });

  it("brings the dot back for a newer shell version", () => {
    expect(maybeRestoreDot({ ...shell, shellVersion: "1.0.3" }, shell)).toBe(
      true,
    );
  });

  it("brings the dot back for a newer web build", () => {
    expect(maybeRestoreDot({ ...web, webBuildId: "build-3" }, web)).toBe(true);
    // A web build on top of a dismissed shell update is new too.
    expect(maybeRestoreDot(both, shell)).toBe(true);
  });

  it("keeps the dot off when a window has not seen every part yet", () => {
    expect(maybeRestoreDot(shell, both)).toBe(false);
  });
});

describe("syncDotDismissedAcrossWindows", () => {
  it("stores Not now for every window to read", () => {
    const dismissed = { shellVersion: "1.0.2", webBuildId: null };
    syncDotDismissedAcrossWindows(dismissed);
    expect(readDotDismissed()).toEqual(dismissed);
  });

  it("hears Not now from another window", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToDotDismissed(listener);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "berean:update-dot-dismissed",
        newValue: JSON.stringify({ shellVersion: "1.0.2", webBuildId: "b" }),
      }),
    );
    expect(listener).toHaveBeenCalledWith({
      shellVersion: "1.0.2",
      webBuildId: "b",
    });
    unsubscribe();
  });

  it("ignores unreadable stored values", () => {
    window.localStorage.setItem("berean:update-dot-dismissed", "{not json");
    expect(readDotDismissed()).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearLearnPackDismissal,
  dismissLearnPackForToday,
  learnDismissDayKey,
  readLearnPacksDismissedToday,
} from "./learn-dismissed-packs";

const STORAGE_KEY = "berean:learn-dismissed-packs";

describe("learn dismissed packs", () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("keeps today's dismissal in localStorage across a cleared session", () => {
    const dayKey = learnDismissDayKey(1_700_000_000_000);
    dismissLearnPackForToday("pack_jude", dayKey);

    expect(localStorage.getItem(STORAGE_KEY)).toContain("pack_jude");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();

    sessionStorage.clear();

    expect(readLearnPacksDismissedToday(dayKey)).toEqual(
      new Set(["pack_jude"]),
    );
  });

  it("removes a previous day's record instead of applying it", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ day: 4, packIds: ["pack_jude", "pack_3john"] }),
    );

    expect(readLearnPacksDismissedToday(5).size).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("drops a record that is not a day-and-pack list", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ day: "today" }));

    expect(readLearnPacksDismissedToday(1).size).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("drops unreadable storage instead of keeping it", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(readLearnPacksDismissedToday(1).size).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("puts a dismissed pack back on Today after Start over", () => {
    const dayKey = learnDismissDayKey(1_700_000_000_000);
    dismissLearnPackForToday("pack_jude", dayKey);
    dismissLearnPackForToday("pack_3john", dayKey);

    expect(clearLearnPackDismissal("pack_jude", dayKey)).toBe(true);
    expect(readLearnPacksDismissedToday(dayKey)).toEqual(
      new Set(["pack_3john"]),
    );
    expect(clearLearnPackDismissal("pack_3john", dayKey)).toBe(true);
    expect(readLearnPacksDismissedToday(dayKey).size).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(clearLearnPackDismissal("pack_jude", dayKey)).toBe(false);
  });

  it("does not throw when localStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readLearnPacksDismissedToday(1).size).toBe(0);
    expect(() => dismissLearnPackForToday("pack_jude", 1)).not.toThrow();
  });
});

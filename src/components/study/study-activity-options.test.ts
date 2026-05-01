import { describe, expect, it } from "vitest";
import { buildActivityOptions } from "./study-activity-options";

function byView(
  options: ReturnType<typeof buildActivityOptions>,
  view: string,
) {
  const option = options.find((o) => o.view === view);
  if (!option) throw new Error(`Missing option for view ${view}`);
  return option;
}

describe("buildActivityOptions", () => {
  it("always includes Overview first and enabled", () => {
    const options = buildActivityOptions({
      savedVersesCount: 0,
      notesCount: 0,
      teachPassagesCount: 0,
    });
    expect(options[0].view).toBe("overview");
    expect(options[0].available).toBe(true);
  });

  it("disables Verse Memory when there are no hearted verses", () => {
    const options = buildActivityOptions({
      savedVersesCount: 0,
      notesCount: 3,
      teachPassagesCount: 3,
    });
    const verseMemory = byView(options, "verse-memory");
    expect(verseMemory.available).toBe(false);
    expect(verseMemory.disabledReason).toMatch(/Heart/i);
  });

  it("disables Teach when there are no teach passages even if notes exist", () => {
    const options = buildActivityOptions({
      savedVersesCount: 2,
      notesCount: 3,
      teachPassagesCount: 0,
    });
    const teach = byView(options, "teach");
    expect(teach.available).toBe(false);
    expect(teach.disabledReason).toMatch(/Link notes/i);
  });

  it("disables Teach with the add-notes reason when no notes exist", () => {
    const options = buildActivityOptions({
      savedVersesCount: 2,
      notesCount: 0,
      teachPassagesCount: 0,
    });
    const teach = byView(options, "teach");
    expect(teach.available).toBe(false);
    expect(teach.disabledReason).toMatch(/Add notes/i);
  });

  it("enables both activities when their prerequisites are met", () => {
    const options = buildActivityOptions({
      savedVersesCount: 1,
      notesCount: 1,
      teachPassagesCount: 1,
    });
    expect(byView(options, "verse-memory").available).toBe(true);
    expect(byView(options, "teach").available).toBe(true);
  });
});

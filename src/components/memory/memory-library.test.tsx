import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryLibrary } from "./memory-library";

const NOW = 1_700_000_000_000;

const mocks = vi.hoisted(() => ({
  paginatedArgs: [] as unknown[],
}));

vi.mock("convex-helpers/react/cache", () => ({
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    mocks.paginatedArgs.push(args);
    return { results: [], status: "Exhausted", loadMore: vi.fn() };
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { verseMemory: { listLibrary: "verseMemory.listLibrary" } },
}));

vi.mock("./learn-verse-dialog", () => ({
  LearnVerseDialog: () => null,
}));

vi.mock("./verse-detail", () => ({
  VerseDetail: () => null,
}));

function renderLibrary() {
  render(
    <MemoryLibrary
      now={NOW}
      onLearnVerse={vi.fn()}
      onReviewVerse={vi.fn()}
      onPracticeVerse={vi.fn()}
    />,
  );
}

describe("MemoryLibrary filters", () => {
  beforeEach(() => {
    mocks.paginatedArgs = [];
  });

  it("offers Due today, Learning, Memorized, Mastered, and All", () => {
    renderLibrary();

    const filters = screen.getByRole("group", { name: "Filter verses" });
    expect(
      [...filters.querySelectorAll("button")].map((b) => b.textContent),
    ).toEqual(["Due today", "Learning", "Memorized", "Mastered", "All"]);
    expect(screen.queryByText("Not started")).not.toBeInTheDocument();
    expect(mocks.paginatedArgs.at(-1)).toEqual({ view: "due", now: NOW });
  });

  it.each([
    ["Learning", "learning", "Nothing is being learned right now."],
    [
      "Memorized",
      "memorized",
      "Verses show up here once they finish learning.",
    ],
    ["Mastered", "mastered", "No mastered verses yet."],
    ["All", "all", "Memorize a verse to see it here."],
  ])("reads the %s view", async (label, view, emptyCopy) => {
    renderLibrary();

    await userEvent.click(screen.getByRole("button", { name: label }));

    expect(mocks.paginatedArgs.at(-1)).toEqual({ view });
    expect(screen.getByRole("button", { name: label })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(emptyCopy)).toBeInTheDocument();
  });
});

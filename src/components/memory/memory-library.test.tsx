import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DAY_MS, MIN_LEARNING_LOCK_MS } from "@/lib/memory-scheduler";

import { MemoryLibrary } from "./memory-library";

// Tue Oct 13 2026, 09:00 in Los Angeles.
const NOW = Date.UTC(2026, 9, 13, 16, 0);

const mocks = vi.hoisted(() => {
  const state: {
    paginatedArgs: unknown[];
    results: unknown[];
    today: unknown;
    openSheet: ReturnType<typeof vi.fn>;
  } = { paginatedArgs: [], results: [], today: undefined, openSheet: vi.fn() };
  return state;
});

vi.mock("convex-helpers/react/cache", () => ({
  usePaginatedQuery: (_query: unknown, args: unknown) => {
    mocks.paginatedArgs.push(args);
    return { results: mocks.results, status: "Exhausted", loadMore: vi.fn() };
  },
  useQuery: () => mocks.today,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    verseMemory: { listLibrary: "verseMemory.listLibrary" },
    memoryHome: { today: "memoryHome.today" },
  },
}));

vi.mock("@/lib/viewer-timezone", () => ({
  getViewerTimeZone: () => "America/Los_Angeles",
}));

vi.mock("./learn-verse-dialog", () => ({
  LearnVerseDialog: ({
    open,
    onPick,
  }: {
    open: boolean;
    onPick: (span: {
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
    }) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() =>
          onPick({ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 })
        }
      >
        Pick Romans 8:28
      </button>
    ) : null,
}));

vi.mock("./memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: mocks.openSheet }),
}));

function row(
  verse: number,
  status: "new" | "learning" | "reviewing" | "mastered",
  extra: { learnStage?: number; dueAt?: number; lastReviewedAt?: number } = {},
) {
  return {
    verseMemoryId: `vm_${verse}`,
    verseRefId: `vr_${verse}`,
    book: "Psalms",
    chapter: 23,
    startVerse: verse,
    endVerse: verse,
    status,
    learnStage: extra.learnStage ?? 3,
    ease: 2.3,
    intervalDays: 4,
    dueAt: extra.dueAt ?? NOW,
    lapses: 0,
    lastReviewedAt: extra.lastReviewedAt,
  };
}

function today(counts: {
  learningVerses: number;
  passageSessions: number;
  reviews: number;
}) {
  return { counts };
}

function renderLibrary() {
  const handlers = {
    onOpenVerse: vi.fn(),
    onLearnVerse: vi.fn(),
    onReviewVerse: vi.fn(),
    onPracticeVerse: vi.fn(),
  };
  render(
    <TooltipProvider delayDuration={0}>
      <MemoryLibrary now={NOW} returnTo="/memory/verses" {...handlers} />
    </TooltipProvider>,
  );
  return handlers;
}

describe("MemoryLibrary filters", () => {
  beforeEach(() => {
    mocks.paginatedArgs = [];
    mocks.results = [];
    mocks.today = undefined;
    mocks.openSheet.mockReset();
  });

  it("memorizes a picked verse through the Memorize sheet", async () => {
    renderLibrary();

    const trigger = screen.getAllByRole("button", {
      name: "Memorize a verse",
    })[0];
    if (!trigger) throw new Error("missing Memorize a verse");
    await userEvent.click(trigger);
    await userEvent.click(
      screen.getByRole("button", { name: "Pick Romans 8:28" }),
    );

    expect(mocks.openSheet).toHaveBeenCalledWith(
      {
        kind: "spans",
        spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }],
      },
      { returnFocusTo: trigger },
    );
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

  it("says nothing is due today, with no extra button", () => {
    renderLibrary();

    expect(screen.getByText("Nothing due today.")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Memorize a verse" }),
    ).toHaveLength(1);
  });

  it.each([
    [
      "Memorized",
      "memorized",
      "Verses show up here once they finish learning.",
    ],
    [
      "Mastered",
      "mastered",
      "Nothing mastered yet. Mastery comes after about 2 months of short reviews.",
    ],
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

  it("points an empty Learning view at Memorize a verse", async () => {
    renderLibrary();

    await userEvent.click(screen.getByRole("button", { name: "Learning" }));

    expect(
      screen.getByText("Nothing in progress. Memorize a verse to start."),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Memorize a verse" }),
    ).toHaveLength(2);
  });
});

describe("MemoryLibrary rows", () => {
  beforeEach(() => {
    mocks.paginatedArgs = [];
    mocks.results = [];
    mocks.today = undefined;
  });

  it("shows status, next step, and a Today chip, with one quiet action", async () => {
    mocks.results = [
      row(1, "learning", { learnStage: 2 }),
      row(2, "reviewing"),
      row(3, "learning", {
        learnStage: 1,
        dueAt: NOW + MIN_LEARNING_LOCK_MS,
        lastReviewedAt: NOW,
      }),
      row(4, "mastered", { dueAt: NOW + 2 * DAY_MS }),
    ];
    const handlers = renderLibrary();

    const [learning, due, waiting, mastered] = screen.getAllByRole("listitem");
    if (!learning || !due || !waiting || !mastered) {
      throw new Error("missing rows");
    }

    expect(learning).toHaveTextContent("Psalm 23:1");
    expect(within(learning).getByText("Learning")).toBeInTheDocument();
    expect(within(learning).getByText("Today")).toBeInTheDocument();
    expect(
      within(learning).getByText("Fill in the blanks"),
    ).toBeInTheDocument();

    expect(within(due).getByText("Memorized")).toBeInTheDocument();
    expect(within(due).getByText("Review due today")).toBeInTheDocument();
    await userEvent.click(
      within(due).getByRole("button", { name: "Review Psalm 23:2" }),
    );
    expect(handlers.onReviewVerse).toHaveBeenCalledTimes(1);

    expect(within(waiting).queryByText("Today")).not.toBeInTheDocument();
    expect(
      within(waiting).getByText("Nice. Tomorrow you'll try it with blanks."),
    ).toBeInTheDocument();
    expect(within(waiting).getAllByRole("button")).toHaveLength(1);

    expect(within(mastered).getByText("Mastered")).toBeInTheDocument();
    expect(within(mastered).getByText("Next review Thu")).toBeInTheDocument();
    expect(
      within(mastered).getByRole("button", { name: "Practice Psalm 23:4" }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(learning).getByRole("button", { name: /^Psalm 23:1/ }),
    );
    expect(handlers.onOpenVerse).toHaveBeenCalledWith("vr_1");
  });

  it("opens verse detail with Enter", async () => {
    mocks.results = [row(2, "reviewing")];
    const handlers = renderLibrary();

    screen.getByRole("button", { name: /^Psalm 23:2/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(handlers.onOpenVerse).toHaveBeenCalledWith("vr_2");
  });

  it("does everything due today in one session", () => {
    mocks.results = [
      row(1, "learning", { learnStage: 2 }),
      row(2, "reviewing"),
    ];
    mocks.today = today({ learningVerses: 1, passageSessions: 0, reviews: 1 });
    renderLibrary();

    expect(
      screen.getByRole("link", { name: "Do all 2 · about 4 min" }),
    ).toHaveAttribute("href", "/memory/today?return=%2Fmemory%2Fverses");
  });

  it("says Review all when only reviews are due", () => {
    mocks.results = [row(2, "reviewing"), row(5, "reviewing")];
    mocks.today = today({ learningVerses: 0, passageSessions: 0, reviews: 2 });
    renderLibrary();

    expect(
      screen.getByRole("link", { name: /^Review all 2 · about \d+ min$/ }),
    ).toHaveAttribute("href", "/memory/today?return=%2Fmemory%2Fverses");
  });

  it("keeps the bulk button to the Due today filter", async () => {
    mocks.results = [row(2, "reviewing")];
    mocks.today = today({ learningVerses: 0, passageSessions: 0, reviews: 1 });
    renderLibrary();

    await userEvent.click(screen.getByRole("button", { name: "All" }));
    expect(
      screen.queryByRole("link", { name: /Review all/ }),
    ).not.toBeInTheDocument();
  });
});

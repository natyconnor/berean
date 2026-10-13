import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DAY_MS } from "@/lib/memory-scheduler";

import { TodayPage } from "./today-page";

/** Monday, Oct 12, 2026. */
const NOW = Date.UTC(2026, 9, 12, 18);

const mocks = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  queryByArgs: new Map<string, (args: unknown) => unknown>(),
  navigate: vi.fn(),
  openSheet: vi.fn(),
  start: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn().mockResolvedValue(null),
  useAction: () => vi.fn(),
  useConvex: () => ({ query: vi.fn() }),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args: unknown) => {
    if (args === "skip") return undefined;
    const byArgs = mocks.queryByArgs.get(name);
    return byArgs ? byArgs(args) : mocks.queryResults.get(name);
  },
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    memoryHome: { today: "memoryHome.today" },
    passageMemory: { ensureDueBackfill: "passageMemory.ensureDueBackfill" },
    savedVerses: { listNotMemorizing: "savedVerses.listNotMemorizing" },
    seedPreviewMemory: { seedPreviewMemory: "seedPreviewMemory" },
    verseMemory: {
      memorizeStatus: "verseMemory.memorizeStatus",
      memoryStatus: "verseMemory.memoryStatus",
      reviewActivity: "verseMemory.reviewActivity",
      reviewForecast: "verseMemory.reviewForecast",
      ensureReviewActivityDays: "verseMemory.ensureReviewActivityDays",
    },
  },
}));

vi.mock("@/hooks/use-memorize-start", () => ({
  useMemorizeStart: () => ({ start: mocks.start, pending: false }),
  memorizeStartHref: (
    destination: {
      span: {
        book: string;
        chapter: number;
        startVerse: number;
        endVerse: number;
      };
    },
    returnTo: string,
  ) =>
    `/memory/learn?book=${destination.span.book}&chapter=${destination.span.chapter}&startVerse=${destination.span.startVerse}&endVerse=${destination.span.endVerse}&return=${encodeURIComponent(returnTo)}`,
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: mocks.openSheet }),
}));

vi.mock("@/hooks/use-esv-reference", () => ({
  useEsvReference: (ref: { book: string } | null) => ({
    data: ref
      ? {
          canonical: ref.book,
          copyright: "ESV",
          verses: [{ number: 1, text: `${ref.book} verse text.` }],
        }
      : null,
    loading: false,
    error: null,
  }),
}));

vi.mock("@/hooks/use-live-now", () => ({ useLiveNow: () => NOW }));
vi.mock("@/lib/viewer-timezone", () => ({ getViewerTimeZone: () => "UTC" }));
vi.mock("@/lib/preview-test-tools", () => ({
  isPreviewTestToolsEnabled: () => false,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: mocks.toastError },
}));

function activity({
  practicedDaysAgo = [0, 2],
  answers = 12,
}: { practicedDaysAgo?: number[]; answers?: number } = {}) {
  const days = 30;
  return {
    heatmap: Array.from({ length: days }, (_, index) => ({
      dayStart: NOW - (days - 1 - index) * DAY_MS,
      count: practicedDaysAgo.includes(days - 1 - index) ? 3 : 0,
    })),
    trend: Array.from({ length: days }, (_, index) => {
      const daysAgo = days - 1 - index;
      const count =
        daysAgo === 0
          ? Math.ceil(answers / 2)
          : daysAgo === 2
            ? Math.floor(answers / 2)
            : 0;
      return {
        dayStart: NOW - daysAgo * DAY_MS,
        average: count > 0 ? (daysAgo === 0 ? 98 : 94) : null,
        count,
      };
    }),
  };
}

const PASSAGE_GOAL = {
  kind: "passage",
  packId: "psalm16",
  title: "Psalm 16",
  verseCount: 11,
  learnedVerses: 4,
  status: "building",
  hasWorkToday: true,
  todayStep: {
    label:
      "Day 1 of 3 for verses 5–6: read them, then type them with first letters",
    ladderDay: 1,
  },
  masteryFraction: 0,
  nextDueAt: NOW,
  createdAt: NOW - 10 * DAY_MS,
  lastActivityAt: NOW - DAY_MS,
  lastPracticedAt: NOW - DAY_MS,
};

const PACK_GOAL = {
  kind: "pack",
  packId: "merced",
  title: "Merced Team",
  verseCount: 9,
  learned: 5,
  learning: 2,
  upNext: 2,
  mastered: 0,
  masteryFraction: 0.22,
  reviewsDue: [
    { verseRefId: "a", label: "Luke 9:23–24" },
    { verseRefId: "b", label: "Matthew 6:33" },
  ],
  learningToday: 0,
  reviewTogether: false,
  hasWorkToday: true,
  nextDueAt: NOW,
  createdAt: NOW - 30 * DAY_MS,
  lastActivityAt: NOW - DAY_MS,
  lastPracticedAt: NOW - DAY_MS,
  memberLabels: ["Luke 9:23–24", "Matthew 6:33"],
};

const WORK_TODAY = {
  state: "work",
  counts: { learningVerses: 4, passageSessions: 1, reviews: 5 },
  doneToday: { learningSteps: 0, reviews: 0 },
  startedToday: false,
  nextReviewAt: NOW + DAY_MS,
  hasAnythingMemorized: true,
  totalInMemory: 17,
  statusCounts: { learning: 9, memorized: 8, mastered: 0 },
  goals: [PASSAGE_GOAL, PACK_GOAL],
};

const CAUGHT_UP_TODAY = {
  ...WORK_TODAY,
  state: "caughtUp",
  counts: { learningVerses: 0, passageSessions: 0, reviews: 0 },
  doneToday: { learningSteps: 4, reviews: 5 },
  startedToday: true,
  goals: [
    {
      ...PASSAGE_GOAL,
      hasWorkToday: false,
      todayStep: null,
      nextDueAt: NOW + DAY_MS,
      lastPracticedAt: NOW - 60_000,
    },
    {
      ...PACK_GOAL,
      hasWorkToday: false,
      reviewsDue: [],
      nextDueAt: NOW + 6 * DAY_MS,
      lastPracticedAt: NOW - 60_000,
    },
  ],
};

const FIRST_RUN_TODAY = {
  state: "firstRun",
  counts: { learningVerses: 0, passageSessions: 0, reviews: 0 },
  doneToday: { learningSteps: 0, reviews: 0 },
  startedToday: false,
  nextReviewAt: null,
  hasAnythingMemorized: false,
  totalInMemory: 0,
  statusCounts: { learning: 0, memorized: 0, mastered: 0 },
  goals: [],
};

function heart(
  id: string,
  book: string,
  chapter: number,
  startVerse: number,
  endVerse = startVerse,
) {
  return {
    savedVerseId: id,
    verseRefId: `ref-${id}`,
    book,
    chapter,
    startVerse,
    endVerse,
    createdAt: NOW - DAY_MS,
    inMemory: false,
  };
}

const HEARTS = [
  heart("h1", "Philippians", 4, 6, 7),
  heart("h2", "Isaiah", 40, 31),
  heart("h3", "Micah", 6, 8),
  heart("h4", "Psalms", 1, 2),
  heart("h5", "Romans", 12, 2),
  heart("h6", "Joshua", 1, 9),
];

function renderPage() {
  return render(
    <TooltipProvider>
      <TodayPage />
    </TooltipProvider>,
  );
}

function primaryButtons(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-variant="default"]'),
  );
}

beforeEach(() => {
  mocks.queryResults.clear();
  mocks.queryByArgs.clear();
  mocks.navigate.mockReset();
  mocks.openSheet.mockReset();
  mocks.start.mockReset();
  mocks.toastError.mockReset();
  mocks.queryResults.set("verseMemory.reviewActivity", activity());
  mocks.queryResults.set("savedVerses.listNotMemorizing", []);
  mocks.queryResults.set("verseMemory.memorizeStatus", {
    state: "none",
    allHearted: false,
  });
});

describe("TodayPage", () => {
  it("has exactly one primary button, Start today, when there is work", () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    const { container } = renderPage();

    const primary = primaryButtons(container);
    expect(primary).toHaveLength(1);
    expect(primary[0]).toHaveTextContent("Start today · about 15 min");
    expect(primary[0]).toHaveAttribute(
      "href",
      "/memory/today?return=%2Fmemory",
    );

    expect(
      screen.getByRole("heading", { name: "5 to learn · 5 to review" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("New learning first, then reviews."),
    ).toBeInTheDocument();
    expect(screen.getByText("Today · Monday, Oct 12")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Only learning · 5" }),
    ).toHaveAttribute("href", "/memory/learn?return=%2Fmemory");
    expect(
      screen.getByRole("link", { name: "Only reviews · 5" }),
    ).toHaveAttribute("href", "/memory/review?return=%2Fmemory");
    expect(
      screen.getByRole("link", { name: "Extra practice" }),
    ).toHaveAttribute("href", "/memory/practice?return=%2Fmemory");
    expect(screen.queryByText(/Practice\s+all/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/change your schedule/)).not.toBeInTheDocument();
  });

  it("opens Your progress and Your verses from their doorway cards", () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    renderPage();

    expect(
      screen.getByRole("link", {
        name: "Your progress: Practiced 2 of the last 7 days · 96% accuracy",
      }),
    ).toHaveAttribute("href", "/memory?panel=progress");
    expect(
      screen.getByRole("link", {
        name: "Your verses: 17 verses, 10 due today",
      }),
    ).toHaveAttribute("href", "/memory?panel=verses");
  });

  it("names the streak on Your progress once it's 2+ days", () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryResults.set(
      "verseMemory.reviewActivity",
      activity({ practicedDaysAgo: [0, 1] }),
    );
    renderPage();

    expect(
      screen.getByRole("link", {
        name: "Your progress: 2-day streak · 96% accuracy",
      }),
    ).toBeInTheDocument();
  });

  it("leaves accuracy out until there are five answers", () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryResults.set(
      "verseMemory.reviewActivity",
      activity({ practicedDaysAgo: [0], answers: 4 }),
    );
    renderPage();

    expect(
      screen.getByRole("link", {
        name: "Your progress: Practiced 1 of the last 7 days",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the planned keyboard order from Start today to Make your own pack", () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    const { container } = renderPage();

    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>("a[href], button, input"),
    );
    const position = (element: HTMLElement) => {
      const index = focusables.indexOf(element);
      expect(index).toBeGreaterThanOrEqual(0);
      return index;
    };
    const order = [
      screen.getByRole("link", { name: /^Start today/ }),
      screen.getByRole("link", { name: "Only learning · 5" }),
      screen.getByRole("link", { name: "Only reviews · 5" }),
      screen.getByRole("link", { name: "Extra practice" }),
      screen.getByRole("link", { name: /^Your progress/ }),
      screen.getByRole("link", { name: /^Your verses/ }),
      screen.getByRole("link", { name: "Psalm 16" }),
      screen.getByRole("link", { name: "Continue · 4 min" }),
      screen.getByRole("link", { name: "Merced Team" }),
      screen.getByRole("link", { name: "Review 2 · 1 min" }),
      screen.getByRole("searchbox", { name: "What do you want to memorize?" }),
      screen.getByRole("button", { name: /^Psalm 23/ }),
      screen.getByRole("link", { name: /Make your own pack/ }),
    ].map(position);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("counts due passage sessions in Only learning", () => {
    mocks.queryResults.set("memoryHome.today", {
      ...WORK_TODAY,
      counts: { learningVerses: 0, passageSessions: 2, reviews: 3 },
    });
    renderPage();

    expect(
      screen.getByRole("link", { name: "Only learning · 2" }),
    ).toHaveAttribute("href", "/memory/learn?return=%2Fmemory");
    expect(
      screen.getByRole("link", { name: "Only reviews · 3" }),
    ).toBeInTheDocument();
  });

  it("hides Only learning when there are no reviews", () => {
    mocks.queryResults.set("memoryHome.today", {
      ...WORK_TODAY,
      counts: { learningVerses: 3, passageSessions: 1, reviews: 0 },
    });
    renderPage();

    expect(
      screen.queryByRole("link", { name: /^Only learning/ }),
    ).not.toBeInTheDocument();
  });

  it("switches the primary button to Continue after starting today", () => {
    mocks.queryResults.set("memoryHome.today", {
      ...WORK_TODAY,
      counts: { learningVerses: 0, passageSessions: 0, reviews: 3 },
      doneToday: { learningSteps: 2, reviews: 0 },
      startedToday: true,
    });
    const { container } = renderPage();

    const primary = primaryButtons(container);
    expect(primary).toHaveLength(1);
    expect(primary[0]).toHaveTextContent("Continue · about 2 min");
    expect(
      screen.getByText("2 learning steps done today."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Only reviews/ }),
    ).not.toBeInTheDocument();
  });

  it("shows the all caught up reward with no primary or disabled button", () => {
    mocks.queryResults.set("memoryHome.today", CAUGHT_UP_TODAY);
    const { container } = renderPage();

    expect(primaryButtons(container)).toHaveLength(0);
    expect(
      container.querySelectorAll("button:disabled, [aria-disabled='true']"),
    ).toHaveLength(0);
    expect(
      screen.getByRole("heading", {
        name: "All caught up · next review tomorrow",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("4 learning steps and 5 reviews done today."),
    ).toBeInTheDocument();
    expect(screen.getByText("If you'd like more.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Extra practice" }),
    ).toHaveAttribute("data-variant", "outline");
    expect(
      screen.getByRole("link", {
        name: "Your verses: 17 verses, all done today",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Done today")).toHaveLength(2);
    expect(screen.queryByText(/change your schedule/)).not.toBeInTheDocument();
  });

  it("shows the first-run invitation with no goal grid, doorways, or stats", () => {
    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    const { container } = renderPage();

    const primary = primaryButtons(container);
    expect(primary).toHaveLength(1);
    expect(primary[0]).toHaveTextContent("Try one verse · about 3 min");
    expect(
      screen.getByRole("heading", {
        name: "What do you want to memorize first?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Learn it in a few short days, then quick reviews keep it.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "What you're memorizing" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Your progress/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Your verses/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Or find something to memorize" }),
    ).toBeInTheDocument();

    const chips = within(screen.getByRole("list", { name: "Suggestions" }));
    expect(
      chips.getByRole("button", { name: /^Psalm 23/ }),
    ).toBeInTheDocument();
    expect(
      chips.queryByRole("button", { name: /^John 3:16/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Make your own pack/ }),
    ).toHaveAttribute("href", "/memory/new");
    expect(
      screen.queryByRole("heading", { name: "Start with a verse you love" }),
    ).not.toBeInTheDocument();
  });

  it("starts John 3:16 from Try one verse and opens its first step", async () => {
    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    const span = { book: "John", chapter: 3, startVerse: 16, endVerse: 16 };
    mocks.start.mockResolvedValue({
      mode: "verse",
      destination: { kind: "verse", verseRefId: "john316", span },
      alreadyMemorizing: false,
    });
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Try one verse · about 3 min" }),
    );

    expect(mocks.start).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "verse", span }),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        href: "/memory/learn?book=John&chapter=3&startVerse=16&endVerse=16&return=%2Fmemory",
      }),
    );
  });

  it("offers hearts on first run only when there are some", () => {
    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    mocks.queryResults.set("savedVerses.listNotMemorizing", HEARTS.slice(0, 2));
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Start with a verse you love" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Memorize Philippians 4:6-7" }),
    ).toBeInTheDocument();
  });

  it("opens the Memorize sheet for a valid search", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    renderPage();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "What do you want to memorize?" }),
      "Psalm 23",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Memorize Psalm 23/ }),
    );

    expect(
      screen.getByText("6 verses · learn it in about 4 days"),
    ).toBeVisible();
    expect(mocks.openSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "chapters",
        book: "Psalms",
        startChapter: 23,
        presetId: "psalm-23",
      }),
    );
  });

  it("says when a search is not a reference", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    renderPage();

    await userEvent.type(
      screen.getByRole("searchbox", { name: "What do you want to memorize?" }),
      "Nowhere 99",
    );

    expect(
      await screen.findByText(
        "We couldn't find that reference. Try a book and chapter, like Psalm 23.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Memorize Nowhere/ }),
    ).not.toBeInTheDocument();
  });

  it("hides From your hearts when there are no hearts to offer", () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    renderPage();

    expect(
      screen.queryByRole("heading", { name: "From your hearts" }),
    ).not.toBeInTheDocument();
  });

  it("lists hearts, expands to all of them, and filters by the search", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryResults.set("savedVerses.listNotMemorizing", HEARTS);
    renderPage();

    const section = screen
      .getByRole("heading", { name: "From your hearts" })
      .closest("section");
    expect(section).not.toBeNull();
    const hearts = within(section as HTMLElement);
    expect(hearts.getAllByRole("listitem")).toHaveLength(4);

    await userEvent.click(hearts.getByRole("button", { name: "Show all (6)" }));
    expect(hearts.getAllByRole("listitem")).toHaveLength(6);

    await userEvent.click(
      hearts.getByRole("button", { name: "Memorize Joshua 1:9" }),
    );
    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: [{ book: "Joshua", chapter: 1, startVerse: 9, endVerse: 9 }],
    });

    await userEvent.type(
      screen.getByRole("searchbox", { name: "What do you want to memorize?" }),
      "Romans",
    );
    await waitFor(() =>
      expect(hearts.getAllByRole("listitem")).toHaveLength(1),
    );
    expect(hearts.getByRole("link", { name: "Romans 12:2" })).toHaveAttribute(
      "href",
      "/passage/Romans-12?startVerse=2&endVerse=2",
    );
  });

  it("marks a suggestion already being memorized and opens its panel", () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryByArgs.set("verseMemory.memorizeStatus", (args) => {
      const [span] = (args as { spans: { book: string; chapter: number }[] })
        .spans;
      return span?.book === "Psalms" && span.chapter === 23
        ? {
            state: "memorizing",
            title: "Psalm 23",
            destination: { kind: "pack", packId: "p23" },
            allHearted: true,
          }
        : { state: "none", allHearted: false };
    });
    renderPage();

    const chips = within(screen.getByRole("list", { name: "Suggestions" }));
    expect(
      chips.getByRole("link", { name: "Psalm 23 Memorizing" }),
    ).toHaveAttribute("href", "/memory?panel=pack%3Ap23");
    expect(
      chips.getByRole("button", { name: "The Lord's Prayer Matt 6:9–13" }),
    ).toBeInTheDocument();
    expect(
      chips.getByRole("link", { name: /100 Verses Every Christian/ }),
    ).toHaveAttribute(
      "href",
      "/memory/presets/100-verses-every-christian-should-know",
    );
    expect(
      screen.getByRole("link", { name: /More suggestions/ }),
    ).toHaveAttribute("href", "/memory/presets");
  });
});

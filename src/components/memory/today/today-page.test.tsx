import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { VerseSpan } from "@/lib/hearted-verse-coverage";
import { DAY_MS } from "@/lib/memory-scheduler";

import { TodayPage } from "./today-page";

/** Monday, Oct 12, 2026. */
const NOW = Date.UTC(2026, 9, 12, 18);

type Span = { book: string; chapter: number };

const mocks = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  queryByArgs: new Map<string, (args: unknown) => unknown>(),
  navigate: vi.fn(),
  openSheet: vi.fn(),
  start: vi.fn(),
  toastError: vi.fn(),
  esvRefs: [] as { book: string; chapter: number }[],
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
      memorizeStatuses: "verseMemory.memorizeStatuses",
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
  useEsvReference: (
    ref: {
      book: string;
      chapter: number;
      startVerse: number;
      endVerse: number;
    } | null,
  ) => {
    if (ref) mocks.esvRefs.push(ref);
    return {
      data: ref
        ? {
            canonical: ref.book,
            copyright: "ESV",
            verses: [
              {
                number: ref.startVerse,
                text: `${ref.book} ${ref.chapter}:${ref.startVerse}–${ref.endVerse} verse text.`,
              },
            ],
          }
        : null,
      loading: false,
      error: null,
    };
  },
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
  pieceStates: [
    { verses: 4, state: "learned", today: false },
    { verses: 2, state: "learning", today: true },
    { verses: 5, state: "upNext", today: false },
  ],
  status: "building",
  hasWorkToday: true,
  todayStep: {
    label: "Read verses 5–6, then type them with first letters",
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
  mocks.esvRefs.length = 0;
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
    expect(primary[0]).toHaveTextContent("Start today · about 24 min");
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
    ).toHaveAttribute("href", "/memory/today?only=learning&return=%2Fmemory");
    expect(
      screen.getByRole("link", { name: "Only reviews · 5" }),
    ).toHaveAttribute("href", "/memory/today?only=review&return=%2Fmemory");
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
        name: "Your progress: Practiced 2 of the last 14 days · 96% accuracy",
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
        name: "Your progress: Practiced 1 of the last 14 days",
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
      screen.getByRole("button", { name: "Memorize something new" }),
      screen.getByRole("link", { name: /^Your progress/ }),
      screen.getByRole("link", { name: /^Your verses/ }),
      screen.getByRole("link", { name: "Psalm 16" }),
      screen.getByRole("link", { name: "Continue · 7 min" }),
      screen.getByRole("link", { name: "Merced Team" }),
      screen.getByRole("link", { name: "Review 2 · 2 min" }),
      screen.getByRole("combobox", { name: "What do you want to memorize?" }),
      screen.getByRole("button", { name: /^Psalm 23/ }),
      screen.getByRole("link", { name: /Make your own pack/ }),
    ].map(position);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("scrolls to and focuses the search from Memorize something new", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Memorize something new" }),
    );

    const search = screen.getByRole("combobox", {
      name: "What do you want to memorize?",
    });
    expect(scrollIntoView).toHaveBeenCalled();
    expect(search).toHaveFocus();
  });

  it("counts due passage sessions in Only learning", () => {
    mocks.queryResults.set("memoryHome.today", {
      ...WORK_TODAY,
      counts: { learningVerses: 0, passageSessions: 2, reviews: 3 },
    });
    renderPage();

    expect(
      screen.getByRole("link", { name: "Only learning · 2" }),
    ).toHaveAttribute("href", "/memory/today?only=learning&return=%2Fmemory");
    expect(
      screen.getByRole("link", { name: "Only reviews · 3" }),
    ).toHaveAttribute("href", "/memory/today?only=review&return=%2Fmemory");
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
    expect(primary[0]).toHaveTextContent("Continue · about 3 min");
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
    expect(
      screen.getByRole("button", { name: "Memorize something new" }),
    ).toBeInTheDocument();
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
      screen.getByRole("combobox", { name: "Or find something to memorize" }),
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
      screen.getByRole("button", { name: "Memorize Philippians 4:6–7" }),
    ).toBeInTheDocument();
  });

  it("opens the Memorize sheet for a valid search", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    renderPage();

    await userEvent.type(
      screen.getByRole("combobox", { name: "What do you want to memorize?" }),
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
      screen.getByRole("combobox", { name: "What do you want to memorize?" }),
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
      screen.getByRole("combobox", { name: "What do you want to memorize?" }),
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

  it("hides suggestions already being memorized and fills in from the presets", () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryByArgs.set("verseMemory.memorizeStatuses", (args) =>
      (args as { targets: { spans: Span[] }[] }).targets.map(({ spans }) => {
        const [span] = spans;
        if (span?.book === "Psalms" && span.chapter === 23) {
          return {
            state: "memorizing",
            title: "Psalm 23",
            destination: { kind: "pack", packId: "p23" },
            allHearted: true,
          };
        }
        if (span?.book === "John" && span.chapter === 3) {
          return {
            state: "partOf",
            title: "John 3",
            destination: { kind: "pack", packId: "j3" },
            allHearted: true,
          };
        }
        if (span?.book === "Matthew" && span.chapter === 6) {
          return {
            state: "overlaps",
            title: "Matthew 6",
            destination: { kind: "pack", packId: "m6" },
            allHearted: true,
          };
        }
        return { state: "none", allHearted: false };
      }),
    );
    renderPage();

    const list = screen.getByRole("list", { name: "Suggestions" });
    const chips = within(list);
    expect(chips.queryByText("Psalm 23")).not.toBeInTheDocument();
    expect(chips.queryByText("John 3:16")).not.toBeInTheDocument();
    expect(chips.queryByText("Memorizing")).not.toBeInTheDocument();
    expect(
      chips.getByRole("button", { name: "The Lord's Prayer Matt 6:9–13" }),
    ).toBeInTheDocument();
    expect(
      chips.getByRole("button", { name: "Psalm 8 9 verses" }),
    ).toBeInTheDocument();
    expect(
      chips.getByRole("button", { name: "Psalm 16 11 verses" }),
    ).toBeInTheDocument();

    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(9);
    expect(
      within(items[items.length - 1]).getByRole("link", {
        name: /100 Verses Every Christian/,
      }),
    ).toHaveAttribute(
      "href",
      "/memory/presets/100-verses-every-christian-should-know",
    );
    expect(
      screen.getByRole("link", { name: /More suggestions/ }),
    ).toHaveAttribute("href", "/memory/presets");
  });

  it("shows the curated suggestions while their statuses load", () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    renderPage();

    const chips = within(screen.getByRole("list", { name: "Suggestions" }));
    expect(chips.getAllByRole("listitem")).toHaveLength(9);
    expect(
      chips.getByRole("button", { name: "Psalm 23 6 verses" }),
    ).toBeInTheDocument();
    expect(chips.queryByText("Memorizing")).not.toBeInTheDocument();
  });

  function verseStatusFor(
    target: { book: string; chapter: number; startVerse: number },
    extra: Record<string, unknown>,
  ) {
    return (args: unknown) => {
      const [span] = (args as { spans: VerseSpan[] }).spans;
      return span?.book === target.book &&
        span.chapter === target.chapter &&
        span.startVerse === target.startVerse &&
        span.endVerse === target.startVerse
        ? {
            state: "memorizing",
            destination: {
              kind: "verse",
              verseRefId: `ref-${target.book}`,
              span: { ...target, endVerse: target.startVerse },
            },
            allHearted: true,
            ...extra,
          }
        : { state: "none", allHearted: false };
    };
  }

  it("starts a search that is Up next in a pack straight from the row", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryByArgs.set(
      "verseMemory.memorizeStatus",
      verseStatusFor(
        { book: "John", chapter: 3, startVerse: 16 },
        { progress: "upNext", upNextPackName: "Sample · Mix" },
      ),
    );
    renderPage();

    const search = screen.getByRole("combobox", {
      name: "What do you want to memorize?",
    });
    await userEvent.type(search, "John 3:16");

    const row = await screen.findByRole("link", {
      name: "John 3:16 Up next in Sample · Mix Start now",
    });
    const learnHref =
      "/memory/learn?book=John&chapter=3&startVerse=16&endVerse=16&return=%2Fmemory";
    expect(row).toHaveAttribute("href", learnHref);
    expect(screen.queryByText("Memorizing")).not.toBeInTheDocument();

    await userEvent.type(search, "{Enter}");
    expect(mocks.navigate).toHaveBeenCalledWith({ href: learnHref });
    expect(mocks.openSheet).not.toHaveBeenCalled();
  });

  it("offers Start for a verse added but never practiced", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryByArgs.set(
      "verseMemory.memorizeStatus",
      verseStatusFor(
        { book: "Psalms", chapter: 121, startVerse: 1 },
        { progress: "notStarted" },
      ),
    );
    renderPage();

    await userEvent.type(
      screen.getByRole("combobox", { name: "What do you want to memorize?" }),
      "Psalm 121:1",
    );

    expect(
      await screen.findByRole("link", {
        name: "Psalm 121:1 Added · not started yet Start",
      }),
    ).toHaveAttribute(
      "href",
      "/memory/learn?book=Psalms&chapter=121&startVerse=1&endVerse=1&return=%2Fmemory",
    );
    expect(screen.queryByText("Memorizing")).not.toBeInTheDocument();
  });

  it("marks a search already being memorized and opens its drawer", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryByArgs.set("verseMemory.memorizeStatus", (args) => {
      const [span] = (args as { spans: Span[] }).spans;
      return span?.book === "John" && span.chapter === 1
        ? {
            state: "memorizing",
            destination: {
              kind: "verse",
              verseRefId: "john11",
              span: { book: "John", chapter: 1, startVerse: 1, endVerse: 1 },
            },
            progress: "learning",
            allHearted: true,
          }
        : { state: "none", allHearted: false };
    });
    renderPage();

    const search = screen.getByRole("combobox", {
      name: "What do you want to memorize?",
    });
    await userEvent.type(search, "John 1:1");

    const row = await screen.findByRole("link", {
      name: "John 1:1 Memorizing Open",
    });
    expect(row).toHaveAttribute("href", "/memory?panel=verse%3Ajohn11");
    expect(
      screen.queryByRole("button", { name: /^Memorize John 1:1/ }),
    ).not.toBeInTheDocument();

    await userEvent.click(row);
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory?panel=verse%3Ajohn11",
    });

    mocks.navigate.mockReset();
    await userEvent.type(search, "{Enter}");
    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory?panel=verse%3Ajohn11",
    });
    expect(mocks.openSheet).not.toHaveBeenCalled();
  });

  it("says when a search is part of a passage and opens that passage", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryResults.set("verseMemory.memorizeStatus", {
      state: "partOf",
      title: "Romans 8",
      destination: { kind: "pack", packId: "p8" },
      allHearted: true,
    });
    renderPage();

    await userEvent.type(
      screen.getByRole("combobox", { name: "What do you want to memorize?" }),
      "Romans 8:28",
    );

    expect(
      await screen.findByRole("link", {
        name: "Romans 8:28 Part of Romans 8 Open",
      }),
    ).toHaveAttribute("href", "/memory?panel=pack%3Ap8");
  });

  it("keeps Memorize for a search that only overlaps a passage", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    mocks.queryResults.set("verseMemory.memorizeStatus", {
      state: "overlaps",
      title: "Psalm 23:1–3",
      destination: { kind: "pack", packId: "p23" },
      allHearted: true,
    });
    renderPage();

    await userEvent.type(
      screen.getByRole("combobox", { name: "What do you want to memorize?" }),
      "Psalm 23",
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    await userEvent.click(
      screen.getByRole("button", { name: /^Memorize Psalm 23/ }),
    );
    expect(mocks.openSheet).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "chapters", startChapter: 23 }),
    );
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("memorizes a range of chapters from the search", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    renderPage();

    await userEvent.type(
      screen.getByRole("combobox", { name: "What do you want to memorize?" }),
      "Matthew 5-7",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^Memorize Sermon on the Mount/ }),
    );
    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "chapters",
      book: "Matthew",
      startChapter: 5,
      endChapter: 7,
      presetId: "matthew-5-7",
      title: "Sermon on the Mount",
    });
  });

  describe("reference autocomplete", () => {
    function search() {
      return screen.getByRole("combobox", {
        name: "What do you want to memorize?",
      });
    }

    function suggestions() {
      return within(
        screen.getByRole("listbox", { name: "Reference suggestions" }),
      );
    }

    it("suggests books, then chapters, and accepts with the keyboard", async () => {
      mocks.queryResults.set("memoryHome.today", WORK_TODAY);
      renderPage();

      const input = search();
      expect(input).toHaveAttribute("aria-expanded", "false");
      await userEvent.type(input, "2 pe");

      expect(input).toHaveAttribute("aria-expanded", "true");
      const peter = suggestions().getByRole("option", {
        name: "2 Peter, 3 chapters",
      });
      expect(peter).toHaveAttribute("aria-selected", "true");
      expect(input).toHaveAttribute("aria-activedescendant", peter.id);
      expect(input).toHaveAttribute(
        "aria-controls",
        screen.getByRole("listbox").id,
      );
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(
        screen.queryByText(/We couldn't find that reference/),
      ).not.toBeInTheDocument();

      await userEvent.keyboard("{Enter}");
      expect(input).toHaveValue("2 Peter ");
      expect(
        suggestions()
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual([
        "2 Peter 1, 21 verses",
        "2 Peter 2, 22 verses",
        "2 Peter 3, 18 verses",
      ]);

      await userEvent.keyboard("{ArrowDown}");
      const second = suggestions().getByRole("option", {
        name: "2 Peter 2, 22 verses",
      });
      expect(second).toHaveAttribute("aria-selected", "true");
      expect(input).toHaveAttribute("aria-activedescendant", second.id);

      await userEvent.keyboard("{Tab}");
      expect(input).toHaveValue("2 Peter 2");
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /^Memorize 2 Peter 2/ }),
      ).toBeInTheDocument();
      expect(mocks.openSheet).not.toHaveBeenCalled();
    });

    it("closes on Escape and reopens with the arrow keys", async () => {
      mocks.queryResults.set("memoryHome.today", WORK_TODAY);
      renderPage();

      const input = search();
      await userEvent.type(input, "2 pe");
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(input).toHaveAttribute("aria-expanded", "false");
      expect(input).toHaveValue("2 pe");

      await userEvent.keyboard("{ArrowDown}");
      expect(
        suggestions().getByRole("option", { name: "2 Peter, 3 chapters" }),
      ).toHaveAttribute("aria-selected", "true");
    });

    it("accepts a clicked suggestion into the search", async () => {
      mocks.queryResults.set("memoryHome.today", WORK_TODAY);
      renderPage();

      const input = search();
      await userEvent.type(input, "John 3:16-");
      await userEvent.click(
        suggestions().getByRole("option", { name: "John 3:16–18, 3 verses" }),
      );

      expect(input).toHaveValue("John 3:16–18");
      expect(input).toHaveFocus();
      await userEvent.click(
        screen.getByRole("button", { name: /^Memorize John 3:16–18/ }),
      );
      expect(mocks.openSheet).toHaveBeenCalledWith({
        kind: "spans",
        spans: [{ book: "John", chapter: 3, startVerse: 16, endVerse: 18 }],
      });
    });

    it("previews the text of a matched verse span", async () => {
      mocks.queryResults.set("memoryHome.today", WORK_TODAY);
      renderPage();

      await userEvent.type(search(), "2 peter 2:9-10");

      expect(
        screen.getByRole("button", { name: /^Memorize 2 Peter 2:9–10/ }),
      ).toBeInTheDocument();
      expect(screen.getByText("2 Peter 2:9–10 verse text.")).toHaveClass(
        "font-serif",
        "line-clamp-3",
      );
    });

    it("shows no preview for a whole chapter", async () => {
      mocks.queryResults.set("memoryHome.today", WORK_TODAY);
      renderPage();

      await userEvent.type(search(), "Psalm 23");

      expect(
        screen.getByRole("button", { name: /^Memorize Psalm 23/ }),
      ).toBeInTheDocument();
      expect(screen.queryByText(/verse text\./)).not.toBeInTheDocument();
      expect(mocks.esvRefs).toEqual([]);
    });
  });
});

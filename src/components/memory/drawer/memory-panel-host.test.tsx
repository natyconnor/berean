import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DAY_MS } from "@/lib/memory-scheduler";

import { MemoryPanelHost, MemoryPanelPage } from "./memory-panel-host";

const NOW = Date.UTC(2026, 9, 9, 18, 0, 0);

const mocks = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  navigate: vi.fn(),
  canGoBack: false,
  toastSuccess: vi.fn(),
}));

function mutation(name: string) {
  let fn = mocks.mutations.get(name);
  if (!fn) {
    fn = vi.fn().mockResolvedValue(null);
    mocks.mutations.set(name, fn);
  }
  return fn;
}

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useCanGoBack: () => mocks.canGoBack,
  Link: ({
    to,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    children: ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutation(name),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args: unknown) =>
    args === "skip" ? undefined : mocks.queryResults.get(name),
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    memoryHome: { today: "memoryHome.today" },
    packs: {
      get: "packs.get",
      listMine: "packs.listMine",
      addVerse: "packs.addVerse",
    },
    passageMemory: { ensureDueBackfill: "passageMemory.ensureDueBackfill" },
    savedVerses: { listAll: "savedVerses.listAll" },
    verseMemory: {
      listLibrary: "verseMemory.listLibrary",
      verseDetail: "verseMemory.verseDetail",
      stopMemorizing: "verseMemory.stopMemorizing",
      memoryStatus: "verseMemory.memoryStatus",
      memoryStats: "verseMemory.memoryStats",
      reviewActivity: "verseMemory.reviewActivity",
      reviewForecast: "verseMemory.reviewForecast",
      ensureReviewActivityDays: "verseMemory.ensureReviewActivityDays",
    },
  },
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: vi.fn() }),
}));

vi.mock("@/hooks/use-live-now", () => ({
  useLiveNow: () => NOW,
}));

vi.mock("@/lib/viewer-timezone", () => ({
  getViewerTimeZone: () => "UTC",
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

const TODAY = {
  state: "work",
  counts: { learningVerses: 1, passageSessions: 1, reviews: 2 },
  doneToday: { learningSteps: 0, reviews: 0 },
  startedToday: false,
  nextReviewAt: null,
  hasAnythingMemorized: true,
  totalInMemory: 12,
  statusCounts: { learning: 4, memorized: 8, mastered: 0 },
  goals: [
    {
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
        label:
          "Day 1 of 3 for verses 5–6: read them, then type them with first letters",
        ladderDay: 1,
      },
      masteryFraction: 0,
      nextDueAt: NOW,
      createdAt: NOW - 10 * DAY_MS,
      lastActivityAt: NOW - 60_000,
      lastPracticedAt: NOW - 60_000,
    },
    {
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
        { verseRefId: "luke", label: "Luke 9:23–24" },
        { verseRefId: "matt", label: "Matthew 6:33" },
      ],
      learningToday: 0,
      reviewTogether: false,
      hasWorkToday: true,
      nextDueAt: NOW,
      createdAt: NOW - 30 * DAY_MS,
      lastActivityAt: NOW - DAY_MS,
      lastPracticedAt: NOW - DAY_MS,
      memberLabels: ["Luke 9:23–24", "Matthew 6:33", "Romans 12:2"],
    },
  ],
  emptyPacks: [],
};

const VERSE_REF_ID = "j97xyz_9-Q";

const VERSE_DETAIL = {
  verseRefId: VERSE_REF_ID,
  book: "Romans",
  chapter: 8,
  startVerse: 28,
  endVerse: 28,
  isHearted: true,
  heartedAt: NOW - 20 * DAY_MS,
  inMemory: true,
  isDue: true,
  status: "reviewing",
  learnStage: 3,
  stageReps: 0,
  ease: 2.5,
  intervalDays: 8,
  dueAt: NOW - 1000,
  lapses: 0,
  consecutiveCorrect: 3,
  lastReviewedAt: NOW - 8 * DAY_MS,
  attempts: [
    {
      quality: "exact",
      accuracy: 96,
      stage: 3,
      mode: "review",
      createdAt: NOW - 8 * DAY_MS,
    },
  ],
  difficulty: null,
};

function renderHost(panel: string | undefined, from?: "verses") {
  return render(
    <TooltipProvider>
      <MemoryPanelHost panel={panel} from={from} />
    </TooltipProvider>,
  );
}

describe("MemoryPanelHost", () => {
  beforeEach(() => {
    mocks.queryResults.clear();
    mocks.mutations.clear();
    mocks.navigate.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.canGoBack = false;
    mocks.queryResults.set("memoryHome.today", TODAY);
    mocks.queryResults.set("verseMemory.verseDetail", VERSE_DETAIL);
  });

  it("hands focus back to what opened it when it closes", async () => {
    const opener = document.createElement("a");
    opener.href = "/memory?panel=verses";
    opener.textContent = "Your verses";
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = renderHost("verses");
    expect(screen.getByRole("heading", { name: "Your verses" })).toHaveFocus();
    rerender(
      <TooltipProvider>
        <MemoryPanelHost panel={undefined} from={undefined} />
      </TooltipProvider>,
    );

    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it("opens Your verses for ?panel=verses with its title focused", () => {
    renderHost("verses");

    const dialog = screen.getByRole("dialog", { name: "Your verses" });
    const title = within(dialog).getByRole("heading", { name: "Your verses" });
    expect(title).toHaveFocus();
    expect(
      within(dialog).getByRole("link", { name: "Open full page" }),
    ).toHaveAttribute("href", "/memory/verses");
    expect(
      within(dialog).getByRole("link", { name: /Your progress/ }),
    ).toHaveAttribute("href", "/memory?panel=progress");

    const overview = within(dialog).getByRole("region", { name: "Overview" });
    expect(overview).toHaveTextContent(
      "12 verses · 1 passage · 1 pack4 due today",
    );
    expect(
      within(dialog).getByRole("heading", { name: "Passages and packs · 2" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Continue Psalm 16" }),
    ).toHaveAttribute(
      "href",
      "/memory/psalm16/learn?return=%2Fmemory%2Fverses",
    );
    expect(
      within(dialog).getByRole("link", { name: "Review Merced Team" }),
    ).toHaveAttribute(
      "href",
      "/memory/merced/review?return=%2Fmemory%2Fverses",
    );
    expect(
      within(dialog).queryByRole("button", { name: /^Sort/ }),
    ).not.toBeInTheDocument();
  });

  it("sends a pack with learning and reviews to its scoped Today session", () => {
    mocks.queryResults.set("memoryHome.today", {
      ...TODAY,
      goals: TODAY.goals.map((goal) =>
        goal.kind === "pack" ? { ...goal, learningToday: 1 } : goal,
      ),
    });
    renderHost("verses");

    const dialog = screen.getByRole("dialog", { name: "Your verses" });
    expect(
      within(dialog).getByRole("link", { name: "Continue Merced Team" }),
    ).toHaveAttribute(
      "href",
      "/memory/today?packId=merced&return=%2Fmemory%2Fverses",
    );
  });

  it("offers Practice on a pack with nothing due", () => {
    mocks.queryResults.set("memoryHome.today", {
      ...TODAY,
      goals: TODAY.goals.map((goal) =>
        goal.kind === "pack"
          ? { ...goal, hasWorkToday: false, reviewsDue: [] }
          : goal,
      ),
    });
    renderHost("verses");

    const dialog = screen.getByRole("dialog", { name: "Your verses" });
    expect(
      within(dialog).getByRole("link", { name: "Practice Merced Team" }),
    ).toHaveAttribute(
      "href",
      "/memory/merced/practice?return=%2Fmemory%2Fverses",
    );
  });

  it("swaps to a goal's detail with from=verses", async () => {
    renderHost("verses");
    const dialog = screen.getByRole("dialog", { name: "Your verses" });

    await userEvent.click(
      within(dialog).getByRole("link", { name: /^Merced Team/ }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory?panel=pack%3Amerced&from=verses",
    });
  });

  it("closes with × and Esc by replacing the entry with plain Today", async () => {
    renderHost("progress");
    expect(
      screen.getByRole("dialog", { name: "Your progress" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/memory",
      search: {},
      replace: true,
    });

    mocks.navigate.mockClear();
    await userEvent.keyboard("{Escape}");
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/memory",
      search: {},
      replace: true,
    });
  });

  it("shows ‹ Your verses after a swap and focuses the new title", () => {
    const { rerender } = renderHost("verses");

    rerender(
      <TooltipProvider>
        <MemoryPanelHost panel={`verse:${VERSE_REF_ID}`} from="verses" />
      </TooltipProvider>,
    );

    const dialog = screen.getByRole("dialog", { name: "Romans 8:28" });
    expect(
      within(dialog).getByRole("heading", { name: "Romans 8:28" }),
    ).toHaveFocus();
    expect(
      within(dialog).getByRole("link", { name: "Back to Your verses" }),
    ).toHaveAttribute("href", "/memory?panel=verses");
    expect(
      within(dialog).getByRole("link", { name: "Open full page" }),
    ).toHaveAttribute("href", `/memory/verse/${VERSE_REF_ID}?from=verses`);
    expect(
      within(dialog).getByRole("link", { name: "Review" }),
    ).toHaveAttribute(
      "href",
      `/memory/review?book=Romans&chapter=8&startVerse=28&endVerse=28&return=${encodeURIComponent(`/memory/verse/${VERSE_REF_ID}`)}`,
    );
  });

  it("has no back link without from=verses", () => {
    renderHost(`verse:${VERSE_REF_ID}`);
    expect(
      screen.queryByRole("link", { name: "Back to Your verses" }),
    ).not.toBeInTheDocument();
  });

  it("ignores unknown panels", () => {
    renderHost("nope");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms Stop memorizing, then goes back to Your verses", async () => {
    renderHost(`verse:${VERSE_REF_ID}`, "verses");

    await userEvent.click(screen.getByRole("button", { name: "More actions" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "Stop memorizing" }),
    );

    const confirm = await screen.findByRole("dialog", {
      name: "Stop memorizing Romans 8:28?",
    });
    expect(
      within(confirm).getByText("Your progress is saved if you start again."),
    ).toBeInTheDocument();
    await userEvent.click(
      within(confirm).getByRole("button", { name: "Stop memorizing" }),
    );

    await waitFor(() =>
      expect(
        mocks.mutations.get("verseMemory.stopMemorizing"),
      ).toHaveBeenCalledWith(
        expect.objectContaining({ verseRefId: VERSE_REF_ID }),
      ),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        href: "/memory?panel=verses",
        replace: true,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Stopped memorizing Romans 8:28.",
    );
  });
});

describe("MemoryPanelPage", () => {
  beforeEach(() => {
    mocks.queryResults.clear();
    mocks.navigate.mockReset();
    mocks.canGoBack = false;
    mocks.queryResults.set("verseMemory.verseDetail", VERSE_DETAIL);
  });

  it("shows verse not found for a junk id", () => {
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "verse", verseRefId: "xyz" }}
          from={undefined}
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Verse not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This verse isn't in your Memory. It may have been removed.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Romans 8:28" }),
    ).not.toBeInTheDocument();
  });

  it("links back to Your verses and returns sessions to the page", () => {
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "verse", verseRefId: VERSE_REF_ID }}
          from="verses"
        />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Romans 8:28" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to Your verses" }),
    ).toHaveAttribute("href", "/memory/verses");
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      `/memory/review?book=Romans&chapter=8&startVerse=28&endVerse=28&return=${encodeURIComponent(`/memory/verse/${VERSE_REF_ID}?from=verses`)}`,
    );
    expect(
      screen.queryByRole("link", { name: "Open full page" }),
    ).not.toBeInTheDocument();
  });

  it("goes to plain Today for ‹ Today, even with history", async () => {
    mocks.canGoBack = true;
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "verse", verseRefId: VERSE_REF_ID }}
          from={undefined}
        />
      </TooltipProvider>,
    );

    const link = screen.getByRole("link", { name: "Back to Today" });
    expect(link).toHaveAttribute("href", "/memory");
    await userEvent.click(link);
    expect(mocks.navigate).toHaveBeenCalledWith({ href: "/memory" });
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("goes to the Your verses page for ‹ Your verses", async () => {
    mocks.canGoBack = true;
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "verse", verseRefId: VERSE_REF_ID }}
          from="verses"
        />
      </TooltipProvider>,
    );

    await userEvent.click(
      screen.getByRole("link", { name: "Back to Your verses" }),
    );
    expect(mocks.navigate).toHaveBeenCalledWith({ href: "/memory/verses" });
    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });
});

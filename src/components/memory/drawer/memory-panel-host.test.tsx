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
    verseMemory: {
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
};

const VERSE_DETAIL = {
  verseRefId: "v1",
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

    expect(
      within(dialog).getByRole("heading", { name: "Due today · 4" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: /Do all 4 · about 7 min/ }),
    ).toHaveAttribute(
      "href",
      "/memory/today?return=%2Fmemory%3Fpanel%3Dverses",
    );
    expect(
      within(dialog).getByRole("link", { name: "Learn Psalm 16" }),
    ).toHaveAttribute(
      "href",
      "/memory/psalm16/learn?return=%2Fmemory%3Fpanel%3Dverses",
    );
    expect(
      within(dialog).getByRole("link", { name: "Review Merced Team" }),
    ).toHaveAttribute(
      "href",
      "/memory/merced/review?return=%2Fmemory%3Fpanel%3Dverses",
    );
    expect(
      within(dialog).getByRole("link", { name: /All 12 verses, filters/ }),
    ).toHaveAttribute("href", "/memory/verses");
  });

  it("swaps to a recently active item with from=verses", async () => {
    renderHost("verses");
    const dialog = screen.getByRole("dialog", { name: "Your verses" });

    await userEvent.click(
      within(dialog).getByRole("link", { name: /^Merced Team/ }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({
      href: "/memory?panel=pack%3Amerced&from=verses",
    });
  });

  it("closes with × and Esc by removing panel", async () => {
    renderHost("progress");
    expect(
      screen.getByRole("dialog", { name: "Your progress" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/memory",
      search: {},
    });

    mocks.navigate.mockClear();
    await userEvent.keyboard("{Escape}");
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/memory",
      search: {},
    });
  });

  it("shows ‹ Your verses after a swap and focuses the new title", () => {
    const { rerender } = renderHost("verses");

    rerender(
      <TooltipProvider>
        <MemoryPanelHost panel="verse:v1" from="verses" />
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
    ).toHaveAttribute("href", "/memory/verse/v1?from=verses");
    expect(
      within(dialog).getByRole("link", { name: "Review" }),
    ).toHaveAttribute(
      "href",
      "/memory/review?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%3Fpanel%3Dverse%253Av1%26from%3Dverses",
    );
  });

  it("has no back link without from=verses", () => {
    renderHost("verse:v1");
    expect(
      screen.queryByRole("link", { name: "Back to Your verses" }),
    ).not.toBeInTheDocument();
  });

  it("ignores unknown panels", () => {
    renderHost("nope");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms Stop memorizing, then goes back to Your verses", async () => {
    renderHost("verse:v1", "verses");

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
      ).toHaveBeenCalledWith(expect.objectContaining({ verseRefId: "v1" })),
    );
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenLastCalledWith({
        href: "/memory?panel=verses",
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

  it("links back to Your verses and returns sessions to the page", () => {
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "verse", verseRefId: "v1" }}
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
      "/memory/review?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%2Fverse%2Fv1%3Ffrom%3Dverses",
    );
    expect(
      screen.queryByRole("link", { name: "Open full page" }),
    ).not.toBeInTheDocument();
  });

  it("goes back in history for ‹ Today when there is history", async () => {
    mocks.canGoBack = true;
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "verse", verseRefId: "v1" }}
          from={undefined}
        />
      </TooltipProvider>,
    );

    await userEvent.click(screen.getByRole("link", { name: "Back to Today" }));
    expect(back).toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("falls back to /memory for ‹ Today without history", async () => {
    render(
      <TooltipProvider>
        <MemoryPanelPage
          panel={{ kind: "verse", verseRefId: "v1" }}
          from={undefined}
        />
      </TooltipProvider>,
    );

    await userEvent.click(screen.getByRole("link", { name: "Back to Today" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ href: "/memory" });
  });
});

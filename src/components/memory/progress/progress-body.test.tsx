import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DAY_MS } from "@/lib/memory-scheduler";

import { ProgressBody } from "./progress-body";

const NOW = Date.UTC(2026, 9, 9, 18, 0, 0);

const mocks = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
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
  useMutation: () => vi.fn().mockResolvedValue(null),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args: unknown) =>
    args === "skip" ? undefined : mocks.queryResults.get(name),
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    memoryHome: { today: "memoryHome.today" },
    passageMemory: { ensureDueBackfill: "passageMemory.ensureDueBackfill" },
    verseMemory: {
      memoryStatus: "verseMemory.memoryStatus",
      memoryStats: "verseMemory.memoryStats",
      reviewActivity: "verseMemory.reviewActivity",
      reviewForecast: "verseMemory.reviewForecast",
      ensureReviewActivityDays: "verseMemory.ensureReviewActivityDays",
    },
  },
}));

vi.mock("@/hooks/use-live-now", () => ({
  useLiveNow: () => NOW,
}));

vi.mock("@/lib/viewer-timezone", () => ({
  getViewerTimeZone: () => "UTC",
}));

const EMPTY_ACTIVITY = {
  heatmap: Array.from({ length: 30 }, (_, i) => ({
    dayStart: NOW - (29 - i) * DAY_MS,
    count: 0,
  })),
  trend: Array.from({ length: 30 }, (_, i) => ({
    dayStart: NOW - (29 - i) * DAY_MS,
    average: null,
    count: 0,
  })),
};

const TODAY_BASE = {
  state: "work",
  counts: { learningVerses: 1, passageSessions: 0, reviews: 0 },
  doneToday: { learningSteps: 0, reviews: 0 },
  startedToday: false,
  nextReviewAt: null,
  hasAnythingMemorized: false,
  totalInMemory: 0,
  statusCounts: { learning: 0, memorized: 0, mastered: 0 },
  goals: [] as unknown[],
};

const VERSE_GOAL = {
  kind: "verse",
  verseRefId: "john316",
  title: "John 3:16",
  book: "John",
  chapter: 3,
  startVerse: 16,
  endVerse: 16,
  status: "learning",
  learnStage: 0,
  intervalDays: 0,
  masteryFraction: 0,
  hasWorkToday: true,
  nextDueAt: NOW,
  createdAt: NOW - DAY_MS,
  lastActivityAt: NOW - DAY_MS,
  lastPracticedAt: null,
};

function renderBody() {
  return render(
    <TooltipProvider>
      <ProgressBody />
    </TooltipProvider>,
  );
}

describe("ProgressBody", () => {
  beforeEach(() => {
    mocks.queryResults.clear();
    mocks.queryResults.set("verseMemory.reviewActivity", EMPTY_ACTIVITY);
    mocks.queryResults.set("verseMemory.memoryStatus", {
      new: 0,
      learning: 1,
      reviewing: 0,
      mastered: 0,
      total: 1,
    });
  });

  it("shows KPIs, goal rows and chart placeholders when goals exist but there's no practice yet", () => {
    mocks.queryResults.set("memoryHome.today", {
      ...TODAY_BASE,
      totalInMemory: 1,
      statusCounts: { learning: 1, memorized: 0, mastered: 0 },
      goals: [VERSE_GOAL],
    });

    renderBody();

    expect(
      screen.queryByText(
        "Your progress will show up here after your first session.",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Due today")).toBeInTheDocument();
    expect(screen.getByText("In memory")).toBeInTheDocument();
    expect(screen.getByText("30d accuracy")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Learning and mastery by goal" }),
    ).toBeInTheDocument();
    expect(screen.getByText("John 3:16")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Practice" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Accuracy trend" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Shows up after your first session."),
    ).toHaveLength(2);
  });

  it("shows the empty state when nothing has been started", () => {
    mocks.queryResults.set("memoryHome.today", TODAY_BASE);

    renderBody();

    expect(
      screen.getByText(
        "Your progress will show up here after your first session.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Today" })).toHaveAttribute(
      "href",
      "/memory",
    );
    expect(screen.queryByText("Due today")).not.toBeInTheDocument();
  });
});

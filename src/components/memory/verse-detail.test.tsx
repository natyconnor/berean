import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { DAY_MS } from "@/lib/memory-scheduler";

import { VerseDetailBody, type VerseDetailData } from "./verse-detail";

const NOW = Date.UTC(2026, 9, 12, 18, 0, 0);
const RETURN_TO = "/memory/verse/v1";

const mocks = vi.hoisted(() => ({ openSheet: vi.fn(), navigate: vi.fn() }));

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

vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => undefined,
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: () => {},
  }),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    packs: { listMine: "packs.listMine", addVerse: "packs.addVerse" },
    verseMemory: {
      verseDetail: "verseMemory.verseDetail",
      stopMemorizing: "verseMemory.stopMemorizing",
      startOver: "verseMemory.startOver",
      undoStartOver: "verseMemory.undoStartOver",
      finishRefresh: "verseMemory.finishRefresh",
    },
  },
}));

vi.mock("./memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: mocks.openSheet }),
}));

function detail(overrides: Partial<VerseDetailData> = {}): VerseDetailData {
  return {
    verseRefId: "v1" as VerseDetailData["verseRefId"],
    book: "Romans",
    chapter: 8,
    startVerse: 28,
    endVerse: 28,
    isHearted: true,
    heartedAt: NOW - 30 * DAY_MS,
    inMemory: true,
    isDue: false,
    status: "reviewing",
    learnStage: 3,
    stageReps: 0,
    ease: 2.5,
    intervalDays: 8,
    dueAt: NOW + 3 * DAY_MS,
    lapses: 0,
    consecutiveCorrect: 4,
    lastReviewedAt: NOW - 8 * DAY_MS,
    startedOverAt: undefined,
    attempts: [
      {
        quality: "exact",
        accuracy: 98,
        stage: 3,
        mode: "review",
        createdAt: NOW - 8 * DAY_MS,
      },
      {
        quality: "exact",
        accuracy: 94,
        stage: 3,
        mode: "learn",
        createdAt: NOW - 12 * DAY_MS,
      },
    ],
    difficulty: {
      attemptCount: 2,
      averageAccuracy: 96,
      worstAccuracy: 94,
      hardestStage: 3,
    },
    ...overrides,
  };
}

function renderBody(
  data: VerseDetailData,
  extras: { now?: number; timeZone?: string } = {},
) {
  return render(
    <TooltipProvider>
      <VerseDetailBody
        detail={data}
        now={extras.now ?? NOW}
        returnTo={RETURN_TO}
        timeZone={extras.timeZone ?? "UTC"}
      />
    </TooltipProvider>,
  );
}

const JARGON =
  /\b(Interval|Ease|Lapses|Stage journey|Difficulty|Hardest stage)\b/;

describe("VerseDetailBody", () => {
  beforeEach(() => {
    mocks.openSheet.mockReset();
  });

  it("shows plain facts and no scheduler jargon", () => {
    const { container } = renderBody(detail());

    expect(container.textContent).not.toMatch(JARGON);
    expect(screen.getByText("Next review")).toBeInTheDocument();
    expect(screen.getByText("Thu, Oct 15")).toBeInTheDocument();
    expect(screen.getByText("Gap between reviews")).toBeInTheDocument();
    expect(screen.getByText("8 days")).toBeInTheDocument();
    expect(screen.queryByText("Times it slipped")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Your steps" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "How it's going" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Solid")).toBeInTheDocument();
  });

  it("shows slips once there are some", () => {
    renderBody(detail({ lapses: 2 }));
    expect(screen.getByText("Times it slipped")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("links Review and Practice with a return for a due verse", () => {
    renderBody(detail({ dueAt: NOW - 1000, isDue: true }));

    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "/memory/review?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%2Fverse%2Fv1",
    );
    expect(screen.getByRole("link", { name: "Practice" })).toHaveAttribute(
      "href",
      "/memory/practice?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%2Fverse%2Fv1",
    );
    expect(
      screen.getByRole("button", { name: "Add to pack" }),
    ).toBeInTheDocument();
  });

  it("offers Continue learning while learning and nothing while today's step is done", () => {
    const { unmount } = renderBody(
      detail({
        status: "learning",
        learnStage: 2,
        intervalDays: 0,
        dueAt: NOW - 1000,
        lastReviewedAt: undefined,
        attempts: [],
        difficulty: null,
      }),
    );
    expect(
      screen.getByRole("link", { name: "Continue learning" }),
    ).toHaveAttribute(
      "href",
      "/memory/learn?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%2Fverse%2Fv1",
    );
    expect(screen.getAllByText("Fill in the blanks").length).toBeGreaterThan(0);
    expect(
      screen.getByText("This fills in after you practice it."),
    ).toBeInTheDocument();
    unmount();

    renderBody(
      detail({
        status: "learning",
        learnStage: 2,
        intervalDays: 0,
        dueAt: NOW + 12 * 60 * 60 * 1000,
        lastReviewedAt: NOW - 60_000,
      }),
    );
    expect(
      screen.queryByRole("link", { name: /learn/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Nice. Tomorrow you'll try it with blanks."),
    ).toBeInTheDocument();
  });

  it("names a same-day spring-forward lock Later today with the unlock time", () => {
    const now = new Date(2026, 2, 8, 0, 30).getTime();
    const dueAt = new Date(2026, 2, 8, 5, 57).getTime();
    renderBody(
      detail({
        status: "learning",
        learnStage: 2,
        intervalDays: 0,
        dueAt,
        lastReviewedAt: undefined,
        attempts: [],
        difficulty: null,
      }),
      { now, timeZone: "America/Los_Angeles" },
    );

    expect(
      screen.getByText("Nice. Later today you'll try it with blanks."),
    ).toBeInTheDocument();
    expect(screen.getByText("Later today")).toBeInTheDocument();
    const visible = screen.getByText("Learning · Later today");
    expect(visible).toHaveAttribute("title", "Unlocks at 5:57 AM");
    expect(visible).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.getByText("Learning, unlocks later today at 5:57 AM"),
    ).toHaveClass("sr-only");
  });

  it("shows a try's accuracy and day when hovering the accuracy trend", () => {
    renderBody(detail());

    const chart = screen.getByRole("img", { name: /^Accuracy across/ });
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 56,
      right: 280,
      width: 280,
      height: 56,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(chart, { clientX: 0, clientY: 20 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("94%");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Wed, Sep 30");

    fireEvent.pointerMove(chart, { clientX: 280, clientY: 20 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("98%");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Sun, Oct 4");

    fireEvent.pointerLeave(chart);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("steps through tries with the arrow keys once the trend has focus", async () => {
    renderBody(detail());

    const chart = screen.getByRole("img", { name: /^Accuracy across/ });
    act(() => chart.focus());
    expect(chart).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent("98%");
    expect(chart).toHaveAccessibleDescription(/98%\s*Sun, Oct 4/);

    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("94%");
    expect(screen.getByText("94%, Wed, Sep 30")).toBeInTheDocument();

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tooltip")).toHaveTextContent("98%");

    act(() => chart.blur());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("offers Memorize again for a verse no longer in Memory", async () => {
    renderBody(detail({ inMemory: false }));

    await userEvent.click(
      screen.getByRole("button", { name: "Memorize Romans 8:28" }),
    );
    expect(mocks.openSheet).toHaveBeenCalledWith({
      kind: "spans",
      spans: [{ book: "Romans", chapter: 8, startVerse: 28, endVerse: 28 }],
    });
  });
});

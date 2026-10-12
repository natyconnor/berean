import type { AnchorHTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
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

function renderBody(data: VerseDetailData) {
  return render(
    <TooltipProvider>
      <VerseDetailBody
        detail={data}
        now={NOW}
        returnTo={RETURN_TO}
        timeZone="UTC"
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

  it("offers Learn while learning and nothing while today's step is done", () => {
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
    expect(screen.getByRole("link", { name: "Learn" })).toHaveAttribute(
      "href",
      "/memory/learn?book=Romans&chapter=8&startVerse=28&endVerse=28&return=%2Fmemory%2Fverse%2Fv1",
    );
    expect(
      screen.getByText("Day 2 of 3: fill in the blanks"),
    ).toBeInTheDocument();
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
      screen.queryByRole("link", { name: "Learn" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Nice. Tomorrow you'll try it with blanks."),
    ).toBeInTheDocument();
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

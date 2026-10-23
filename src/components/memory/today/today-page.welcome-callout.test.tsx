import type { HTMLAttributes, ReactNode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { FeatureHintRecord } from "@/components/tutorial/staged-onboarding-context";
import { StagedOnboardingProvider } from "@/components/tutorial/staged-onboarding-provider";
import { useFeatureHint } from "@/components/tutorial/use-feature-hint";
import { FEATURE_HINTS } from "@/lib/feature-hints";
import { DAY_MS } from "@/lib/memory-scheduler";
import type { OnboardingMilestones } from "@/lib/staged-onboarding-thresholds";

import { TodayPage } from "./today-page";

const MONDAY_OCT_12_2026 = Date.UTC(2026, 9, 12, 18);

const WELCOME_COPY =
  "Store up God's word in your heart. Work on your verses a little each day, and slowly but surely you'll learn and master them, whether it's one verse or a whole chapter.";

const STUDY_HINT_TITLE = "Study is ready";

const mocks = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  mutation: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  useReducedMotion: () => false,
  motion: {
    div: ({
      children,
      initial,
      animate,
      exit,
      transition,
      ...props
    }: HTMLAttributes<HTMLDivElement> & {
      children?: ReactNode;
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
    }) => {
      void initial;
      void animate;
      void exit;
      void transition;
      return <div {...props}>{children}</div>;
    },
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mocks.mutation,
  useAction: () => vi.fn(),
  useConvex: () => ({ query: vi.fn() }),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args: unknown) => {
    if (args === "skip") return undefined;
    return mocks.queryResults.get(name);
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
    onboarding: {
      markHintShown: "onboarding.markHintShown",
      completeHint: "onboarding.completeHint",
      dismissHint: "onboarding.dismissHint",
    },
  },
}));

vi.mock("@/hooks/use-memorize-start", () => ({
  useMemorizeStart: () => ({ start: vi.fn(), pending: false }),
  memorizeStartHref: () => "/memory/learn",
}));

vi.mock("@/components/memory/memorize/memorize-context", () => ({
  useMemorizeSheet: () => ({ open: vi.fn() }),
}));

vi.mock("@/hooks/use-esv-reference", () => ({
  useEsvReference: () => ({ data: null, loading: false, error: null }),
}));

vi.mock("@/hooks/use-live-now", () => ({
  useLiveNow: () => MONDAY_OCT_12_2026,
}));
vi.mock("@/lib/viewer-timezone", () => ({ getViewerTimeZone: () => "UTC" }));
vi.mock("@/lib/preview-test-tools", () => ({
  isPreviewTestToolsEnabled: () => false,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const milestones: OnboardingMilestones = {
  notesCount: 0,
  taggedNotesCount: 0,
  distinctTagCount: 0,
  heartsCount: 0,
  hasInlineVerseLink: false,
  hasExplicitVerseLink: false,
  starterTagCount: 0,
  customTagCount: 0,
};

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
  nextDueAt: MONDAY_OCT_12_2026,
  createdAt: MONDAY_OCT_12_2026 - 10 * DAY_MS,
  lastActivityAt: MONDAY_OCT_12_2026 - DAY_MS,
  lastPracticedAt: MONDAY_OCT_12_2026 - DAY_MS,
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
  nextDueAt: MONDAY_OCT_12_2026,
  createdAt: MONDAY_OCT_12_2026 - 30 * DAY_MS,
  lastActivityAt: MONDAY_OCT_12_2026 - DAY_MS,
  lastPracticedAt: MONDAY_OCT_12_2026 - DAY_MS,
  memberLabels: ["Luke 9:23–24", "Matthew 6:33"],
};

const WORK_TODAY = {
  state: "work",
  counts: { learningVerses: 4, passageSessions: 1, reviews: 5 },
  doneToday: { learningSteps: 0, reviews: 0 },
  startedToday: false,
  nextReviewAt: MONDAY_OCT_12_2026 + DAY_MS,
  hasAnythingMemorized: true,
  totalInMemory: 17,
  statusCounts: { learning: 9, memorized: 8, mastered: 0 },
  goals: [PASSAGE_GOAL, PACK_GOAL],
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

function HoldingHint() {
  const state = useFeatureHint(FEATURE_HINTS.STUDY_REVEAL_AFTER_NOTES, true);
  if (!state.pending) return null;
  return <p>{STUDY_HINT_TITLE}</p>;
}

function TodayHarness({
  hints = [],
  isLoading = false,
  withOnboarding = true,
  showToday = true,
  holdSlot = false,
}: {
  hints?: FeatureHintRecord[];
  isLoading?: boolean;
  withOnboarding?: boolean;
  showToday?: boolean;
  holdSlot?: boolean;
}) {
  const today = showToday ? (
    <TooltipProvider>
      <TodayPage />
    </TooltipProvider>
  ) : null;
  if (!withOnboarding) return today;
  return (
    <StagedOnboardingProvider
      milestones={milestones}
      hints={hints}
      isLoading={isLoading}
    >
      {holdSlot ? <HoldingHint /> : null}
      {today}
    </StagedOnboardingProvider>
  );
}

function expectBefore(earlier: HTMLElement, later: HTMLElement) {
  expect(
    earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
}

async function mountTodayWhileAnotherHintHoldsTheSlot() {
  mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
  const view = render(<TodayHarness showToday={false} holdSlot />);
  await waitFor(() => {
    expect(screen.getByText(STUDY_HINT_TITLE)).toBeInTheDocument();
  });
  vi.useFakeTimers();
  view.rerender(<TodayHarness showToday holdSlot />);
  act(() => {
    vi.advanceTimersByTime(999);
  });
  expect(screen.queryByText("Welcome to Memory")).not.toBeInTheDocument();
  expect(screen.getByText(STUDY_HINT_TITLE)).toBeInTheDocument();
  return view;
}

describe("Today welcome explainer", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.queryResults.clear();
    mocks.mutation.mockClear();
    mocks.queryResults.set("savedVerses.listNotMemorizing", []);
    mocks.queryResults.set("verseMemory.memorizeStatus", {
      state: "none",
      allHearted: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("explains Memory on a first visit when nothing is memorized yet", async () => {
    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    render(<TodayHarness />);

    const callout = await screen.findByRole("status");
    expect(within(callout).getByText("Welcome to Memory")).toBeInTheDocument();
    expect(within(callout).getByText(WELCOME_COPY)).toBeInTheDocument();
    expect(
      within(callout).getByRole("button", { name: "Dismiss" }),
    ).toBeInTheDocument();
    expect(within(callout).getAllByRole("button")).toHaveLength(1);
    expect(callout).toHaveClass(
      "px-4",
      "py-3",
      "text-sm",
      "sm:px-5",
      "mx-auto",
      "max-w-[920px]",
    );
    expect(callout).not.toHaveClass("sticky");
    expect(callout).not.toHaveClass("fixed");

    expect(screen.getByText("Start here")).toBeInTheDocument();
    expect(screen.getAllByText("Welcome to Memory")).toHaveLength(1);
    expect(
      screen.queryByRole("heading", { name: "Welcome to Memory" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Memory lives here")).not.toBeInTheDocument();
    expectBefore(
      callout,
      screen.getByRole("heading", {
        name: "What do you want to memorize first?",
      }),
    );
    expect(callout.closest("header")).toBeNull();
  });

  it("shows the explainer above Today when there is already work", async () => {
    mocks.queryResults.set("memoryHome.today", WORK_TODAY);
    render(<TodayHarness />);

    const callout = await screen.findByRole("status");
    expect(within(callout).getByText("Welcome to Memory")).toBeInTheDocument();
    expect(within(callout).getByText(WELCOME_COPY)).toBeInTheDocument();
    expect(
      within(callout).getByRole("button", { name: "Dismiss" }),
    ).toBeInTheDocument();
    expect(callout).toHaveClass("px-4", "py-3", "text-sm", "sm:px-5");
    expect(callout).not.toHaveClass("max-w-[920px]");
    expect(screen.queryByText("Memory lives here")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expectBefore(
      callout,
      screen.getByRole("heading", { name: "5 to learn · 5 to review" }),
    );
    expect(callout.closest("header")).toBeNull();
  });

  it("hides the explainer after Dismiss and on a later visit", async () => {
    const user = userEvent.setup();
    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    const view = render(<TodayHarness />);
    await screen.findByRole("button", { name: "Dismiss" });

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByText("Welcome to Memory")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    view.unmount();
    render(
      <TodayHarness
        hints={[{ hintId: "memory-first-open-explainer", dismissedAt: 1 }]}
      />,
    );
    await expect(
      screen.findByText("Welcome to Memory", undefined, { timeout: 300 }),
    ).rejects.toThrow();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the explainer again after feature hints are reset", async () => {
    const user = userEvent.setup();
    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    const view = render(<TodayHarness />);
    await user.click(await screen.findByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Welcome to Memory")).not.toBeInTheDocument();

    view.unmount();
    render(<TodayHarness hints={[]} />);

    expect(await screen.findByText("Welcome to Memory")).toBeInTheDocument();
    expect(screen.getByText(WELCOME_COPY)).toBeInTheDocument();
  });

  it("shows only the Memory explainer when another hint is also eligible", async () => {
    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    render(<TodayHarness holdSlot showToday />);

    expect(await screen.findByText("Welcome to Memory")).toBeInTheDocument();
    expect(screen.queryByText(STUDY_HINT_TITLE)).not.toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("shows the explainer when another hint frees the slot within a second", async () => {
    const view = await mountTodayWhileAnotherHintHoldsTheSlot();

    view.rerender(<TodayHarness showToday />);
    act(() => {
      vi.advanceTimersToNextTimer();
    });

    expect(screen.getByText("Welcome to Memory")).toBeInTheDocument();
    expect(screen.queryByText(STUDY_HINT_TITLE)).not.toBeInTheDocument();
  });

  it("does not pop the explainer in when the slot frees after a second", async () => {
    const view = await mountTodayWhileAnotherHintHoldsTheSlot();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText("Welcome to Memory")).not.toBeInTheDocument();

    view.rerender(<TodayHarness showToday />);
    act(() => {
      vi.advanceTimersToNextTimer();
    });

    expect(screen.queryByText("Welcome to Memory")).not.toBeInTheDocument();
    expect(screen.queryByText(STUDY_HINT_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not render the explainer over the Today skeleton", () => {
    const view = render(<TodayHarness />);
    expect(screen.getByLabelText("Loading Today")).toBeInTheDocument();
    expect(screen.queryByText("Welcome to Memory")).not.toBeInTheDocument();

    vi.useFakeTimers();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText("Welcome to Memory")).not.toBeInTheDocument();

    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    view.rerender(<TodayHarness />);
    act(() => {
      vi.advanceTimersToNextTimer();
    });

    expect(screen.queryByLabelText("Loading Today")).not.toBeInTheDocument();
    expect(screen.getByText("Welcome to Memory")).toBeInTheDocument();
  });

  it("hides the explainer while hint history is still loading", () => {
    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    const view = render(<TodayHarness isLoading />);
    expect(
      screen.getByRole("heading", {
        name: "What do you want to memorize first?",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Welcome to Memory")).not.toBeInTheDocument();

    vi.useFakeTimers();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText("Welcome to Memory")).not.toBeInTheDocument();

    view.rerender(<TodayHarness isLoading={false} />);
    act(() => {
      vi.advanceTimersToNextTimer();
    });

    expect(screen.getByText("Welcome to Memory")).toBeInTheDocument();
  });

  it("does not show the explainer when onboarding is unavailable", async () => {
    mocks.queryResults.set("memoryHome.today", FIRST_RUN_TODAY);
    render(<TodayHarness withOnboarding={false} />);

    expect(screen.getByText("Start here")).toBeInTheDocument();
    await expect(
      screen.findByText("Welcome to Memory", undefined, { timeout: 300 }),
    ).rejects.toThrow();
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
});

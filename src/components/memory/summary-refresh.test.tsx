import type { ReactNode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemorySessionRunner } from "@/components/memory/practice/memory-session-runner";
import {
  PracticeBoard,
  type PracticeVerse,
} from "@/components/memory/practice/practice-board";
import { TodaySessionSummary } from "@/components/memory/practice/today-session-summary";
import { ReviewSummary } from "@/components/memory/review-summary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSessionNow } from "@/hooks/use-live-now";
import { useSummaryRefreshExit } from "@/hooks/use-start-verse-refresh";
import {
  PRACTICE_ONLY_CLOSING,
  REFRESH_START_ERROR,
  SUMMARY_REFRESH_BACK_LABEL,
  refresherHeader,
} from "@/lib/memory-copy";
import { memoryPracticeSearch } from "@/lib/memory-practice-search";
import {
  averageReviewAccuracy,
  type ReviewSessionAttempt,
} from "@/lib/review-session-attempts";
import type { EsvChapterData } from "../../../shared/esv-api";

const { mutationMocks, getPassageMock, queryResults } = vi.hoisted(() => ({
  mutationMocks: new Map<string, ReturnType<typeof vi.fn>>(),
  getPassageMock: vi.fn(),
  queryResults: new Map<string, unknown>(),
}));

function mutationMock(name: string) {
  const existing = mutationMocks.get(name);
  if (existing) return existing;
  const created = vi.fn().mockResolvedValue(undefined);
  mutationMocks.set(name, created);
  return created;
}

vi.mock("convex/react", () => ({
  useMutation: (name: string) => mutationMock(name),
  useAction: () => getPassageMock,
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args?: unknown) =>
    args === "skip" ? undefined : queryResults.get(name),
}));

vi.mock("@/components/memory/packs/add-to-pack", () => ({
  AddToPack: () => null,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    esv: {
      getChaptersBatch: "esv.getChaptersBatch",
      getPassage: "esv.getPassage",
    },
    packs: { recordUnifiedReview: "packs.recordUnifiedReview" },
    passageMemory: { recordAttempt: "passageMemory.recordAttempt" },
    savedVerses: {
      listAll: "savedVerses.listAll",
      listRecordingIds: "savedVerses.listRecordingIds",
    },
    verseMemory: {
      recordAttempt: "verseMemory.recordAttempt",
      holdAttempt: "verseMemory.holdAttempt",
      applyHeldAttempt: "verseMemory.applyHeldAttempt",
    },
  },
}));

const VERSE_ONE = "The Lord is my shepherd; I shall not want.";
const psalm23: EsvChapterData = {
  canonical: "Psalm 23",
  copyright: "test",
  verses: [
    { number: 1, text: VERSE_ONE },
    { number: 2, text: "He makes me lie down in green pastures." },
    { number: 3, text: "He restores my soul." },
  ],
};

function ref(startVerse: number, book = "Psalms", chapter = 23) {
  return { book, chapter, startVerse, endVerse: startVerse };
}

const DAY = 24 * 60 * 60 * 1000;
function schedule(status: "reviewing" | "mastered" | "learning") {
  return {
    status,
    learnStage: status === "learning" ? 1 : 3,
    stageReps: 0,
    intervalDays: status === "mastered" ? 30 : 4,
    ease: 2.3,
    dueAt: getSessionNow() + 4 * DAY,
  };
}

/** A review run's rows, as the board records them (unhinted, counted). */
const attempts: ReviewSessionAttempt[] = [
  // 84% close miss, still Memorized: Refresh.
  { reference: ref(1), accuracy: 84, schedule: schedule("reviewing") },
  // 85%: no Refresh.
  { reference: ref(2), accuracy: 85, schedule: schedule("reviewing") },
  // Held miss, then a passing refresher: "78% → 100% · Refresher used".
  { reference: ref(3), accuracy: 78, offerPractice: true },
  {
    reference: ref(3),
    accuracy: 100,
    refresherUsed: true,
    schedule: schedule("reviewing"),
  },
  // Bad miss that dropped the verse to Learning: no Refresh.
  { reference: ref(4), accuracy: 40, schedule: schedule("learning") },
];

const reviewing: PracticeVerse = {
  verseRefId: "vr_ps23_1" as PracticeVerse["verseRefId"],
  reference: ref(1),
  learnStage: 3,
  stageReps: 0,
  status: "reviewing",
  dueAt: getSessionNow() + 4 * DAY,
  ease: 2.3,
  intervalDays: 4,
  consecutiveCorrect: 2,
  lapses: 0,
  earlyReviewApplied: false,
};

const onDone = vi.fn();
const onContinue = vi.fn();

/** Review and day summaries, and the refresher a summary Refresh opens. */
function renderApp(initial: "/memory/review" | "/memory/today") {
  const root = createRootRoute({
    component: () => (
      <TooltipProvider delayDuration={0}>
        <Outlet />
      </TooltipProvider>
    ),
  });
  const review = createRoute({
    getParentRoute: () => root,
    path: "/memory/review",
    // The live queue is empty on the way back; the first visit shows the
    // summary its run ended on.
    component: () => (
      <MemorySessionRunner
        kind="review"
        verses={[]}
        scopeLabel="All due today"
        onExit={onDone}
        backLabel="Back to Memory"
        returnTo="/memory"
        emptyState={
          <ReviewSummary
            attempts={attempts}
            averageAccuracy={averageReviewAccuracy(attempts)}
            remaining={2}
            onDone={onDone}
            onContinue={onContinue}
            returnTo="/memory"
          />
        }
      />
    ),
  });
  const today = createRoute({
    getParentRoute: () => root,
    path: "/memory/today",
    component: () => (
      <TodaySessionSummary
        title="Today"
        passages={[]}
        learned={[]}
        attempts={attempts}
        onDone={onDone}
        returnTo="/memory"
      />
    ),
  });
  const practice = createRoute({
    getParentRoute: () => root,
    path: "/memory/practice",
    component: function RefreshPage() {
      const exit = useSummaryRefreshExit();
      return (
        <PracticeBoard
          kind="practice"
          verses={[reviewing]}
          scopeLabel="Psalm 23:1"
          onExit={() => exit?.go()}
          backLabel={exit?.label}
          refresh
        />
      );
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([review, today, practice]),
    history: createMemoryHistory({ initialEntries: [initial] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

/** One summary on its own, inside a router. */
function renderSummary(element: ReactNode) {
  const root = createRootRoute({ component: () => <>{element}</> });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ["/memory/review"] }),
  });
  render(
    <TooltipProvider delayDuration={0}>
      <RouterProvider router={router} />
    </TooltipProvider>,
  );
}

function rows() {
  return screen.getAllByRole("listitem");
}

function rowsText() {
  return rows().map((row) => row.textContent);
}

function refreshButtons() {
  return screen.queryAllByRole("button", { name: /^Refresh / });
}

async function recite(text: string) {
  const answer = await screen.findByLabelText("Your recalled verse");
  await userEvent.click(answer);
  await userEvent.paste(text);
  await userEvent.click(screen.getByRole("button", { name: /Check answer/ }));
}

async function openRefresher() {
  await userEvent.click(
    await screen.findByRole("button", { name: "Refresh Psalm 23:1" }),
  );
  const header = await screen.findByText(refresherHeader(1));
  await waitFor(() => {
    expect(header).toBeVisible();
  });
}

function expectNothingSaved() {
  expect(mutationMock("verseMemory.recordAttempt")).not.toHaveBeenCalled();
  expect(mutationMock("verseMemory.holdAttempt")).not.toHaveBeenCalled();
  expect(mutationMock("verseMemory.applyHeldAttempt")).not.toHaveBeenCalled();
}

beforeEach(() => {
  mutationMocks.clear();
  queryResults.clear();
  queryResults.set("savedVerses.listRecordingIds", []);
  getPassageMock.mockReset();
  getPassageMock.mockResolvedValue(psalm23);
  onDone.mockReset();
  onContinue.mockReset();
  sessionStorage.clear();
});

describe("Summary Refresh (S9, R21)", () => {
  it.each(["/memory/review", "/memory/today"] as const)(
    "shows Refresh only on the still-Memorized verse whose last try was under 85% (%s)",
    async (path) => {
      renderApp(path);
      const row = (await screen.findByText("Psalm 23:1")).closest("li");
      expect(row).not.toBeNull();
      const refresh = within(row as HTMLElement).getByRole("button", {
        name: "Refresh Psalm 23:1",
      });
      // Immediately before Practice, as a quiet text link.
      expect(refresh.nextElementSibling).toHaveTextContent("Practice");
      expect(refresh).toHaveTextContent(/^Refresh$/);
      expect(refreshButtons()).toHaveLength(1);
      // 78% → 100% · Refresher used keeps its row and has no Refresh.
      expect(
        screen.getByText("78% → 100% · Refresher used"),
      ).toBeInTheDocument();
    },
  );

  it("keeps the summary and blocks a second start while the text loads, then shows the error and retries", async () => {
    let fail: (error: Error) => void = () => {};
    getPassageMock.mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    renderApp("/memory/review");
    const button = await screen.findByRole("button", {
      name: "Refresh Psalm 23:1",
    });
    const before = rowsText();
    await userEvent.click(button);
    await userEvent.click(button);
    expect(getPassageMock).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(rowsText()).toEqual(before);

    await act(async () => {
      fail(new Error("offline"));
      await Promise.resolve();
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(REFRESH_START_ERROR);
    // Under the affected row's actions, with the summary unchanged.
    expect(button.closest("li")).toContainElement(alert);
    expect(button).toBeEnabled();
    expect(
      rowsText().map((text) => text?.replace(REFRESH_START_ERROR, "")),
    ).toEqual(before);
    expectNothingSaved();

    await userEvent.click(button);
    expect(await screen.findByText(refresherHeader(1))).toBeInTheDocument();
  });

  it("cannot start without verse text", async () => {
    getPassageMock.mockResolvedValue({
      ...psalm23,
      verses: [{ number: 1, text: "  " }],
    });
    renderApp("/memory/review");
    await userEvent.click(
      await screen.findByRole("button", { name: "Refresh Psalm 23:1" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      REFRESH_START_ERROR,
    );
    expect(screen.queryByText(refresherHeader(1))).not.toBeInTheDocument();
  });

  it.each(["First letters", "From memory"] as const)(
    "Back at %s returns to the same Review summary and focuses its Refresh",
    async (step) => {
      renderApp("/memory/review");
      await screen.findByText("Psalm 23:1");
      const before = rowsText();
      await openRefresher();
      if (step === "From memory") {
        await recite(VERSE_ONE);
        await userEvent.click(
          await screen.findByRole("button", { name: /Continue/ }),
        );
        expect(await screen.findByText(refresherHeader(2))).toBeVisible();
      }
      await userEvent.click(
        screen.getByRole("button", { name: SUMMARY_REFRESH_BACK_LABEL }),
      );

      const refresh = await screen.findByRole("button", {
        name: "Refresh Psalm 23:1",
      });
      await waitFor(() => {
        expect(refresh).toHaveFocus();
      });
      expect(rowsText()).toEqual(before);
      expect(screen.getByText("Average accuracy")).toBeInTheDocument();
      expect(screen.getByText(/^77%$/)).toBeInTheDocument();
      expect(refreshButtons()).toHaveLength(1);
      expectNothingSaved();
    },
  );

  it.each([
    ["pass", VERSE_ONE],
    ["miss", "nope"],
  ] as const)(
    "Continue after a practice %s returns to the same Review summary, results and eligibility unchanged",
    async (_, answer) => {
      const router = renderApp("/memory/review");
      await screen.findByText("Psalm 23:1");
      const before = rowsText();
      await openRefresher();
      await recite(VERSE_ONE);
      await userEvent.click(
        await screen.findByRole("button", { name: /Continue/ }),
      );
      expect(await screen.findByText(refresherHeader(2))).toBeVisible();
      await recite(answer);
      expect(await screen.findByText(PRACTICE_ONLY_CLOSING)).toBeVisible();
      await userEvent.click(screen.getByRole("button", { name: /Continue/ }));

      const refresh = await screen.findByRole("button", {
        name: "Refresh Psalm 23:1",
      });
      await waitFor(() => {
        expect(refresh).toHaveFocus();
      });
      expect(router.state.location.pathname).toBe("/memory/review");
      // Same rows (scores, bars, next review), average and Refresh links.
      expect(rowsText()).toEqual(before);
      expect(screen.getByText(/^77%$/)).toBeInTheDocument();
      expect(refreshButtons()).toHaveLength(1);
      expect(screen.getByText("2 verses still due today.")).toBeVisible();
      // No mastery, schedule, credit or session row change.
      expectNothingSaved();

      // Keep reviewing and Done stay as they were.
      await userEvent.click(screen.getByRole("button", { name: "Done" }));
      expect(onDone).toHaveBeenCalledTimes(1);
    },
  );

  it("can Refresh again from the restored summary and still come back to it", async () => {
    renderApp("/memory/review");
    await screen.findByText("Psalm 23:1");
    const before = rowsText();
    for (let round = 0; round < 2; round += 1) {
      await openRefresher();
      await userEvent.click(
        screen.getByRole("button", { name: SUMMARY_REFRESH_BACK_LABEL }),
      );
      await screen.findByRole("button", { name: "Refresh Psalm 23:1" });
      expect(rowsText()).toEqual(before);
    }
  });

  it("Keep reviewing on the restored summary opens today's queue", async () => {
    const router = renderApp("/memory/review");
    await screen.findByText("Psalm 23:1");
    await openRefresher();
    await userEvent.click(
      screen.getByRole("button", { name: SUMMARY_REFRESH_BACK_LABEL }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Keep reviewing" }),
    );
    // Not a second copy of the summary: the (empty) live queue.
    await waitFor(() => {
      expect(router.state.location.state.sessionSummary).toBeUndefined();
    });
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("saves the day summary on its own entry for the way back", async () => {
    const router = renderApp("/memory/today");
    await openRefresher();
    expect(router.state.location.state.summaryRefresh).toBe(true);
    expect(router.state.location.search).toMatchObject({
      ...memoryPracticeSearch(ref(1)),
      return: "/memory",
    });
    await userEvent.click(
      screen.getByRole("button", { name: SUMMARY_REFRESH_BACK_LABEL }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/memory/today");
    });
    expect(router.state.location.state).toMatchObject({
      refreshedVerse: "Psalms|23|1|1",
      sessionSummary: {
        kind: "today",
        title: "Today",
        passages: [],
        learned: [],
        attempts,
      },
    });
    expectNothingSaved();
  });

  it("offers no Refresh on an empty summary", async () => {
    renderSummary(
      <ReviewSummary
        attempts={[]}
        averageAccuracy={null}
        remaining={0}
        onDone={onDone}
      />,
    );
    expect(
      await screen.findByText("No verses were graded in this session."),
    ).toBeInTheDocument();
    expect(refreshButtons()).toHaveLength(0);
  });

  it("names the full reference and lets a long row's actions wrap", async () => {
    const long: ReviewSessionAttempt = {
      reference: {
        book: "1 Thessalonians",
        chapter: 5,
        startVerse: 16,
        endVerse: 18,
      },
      accuracy: 60,
      schedule: schedule("mastered"),
    };
    renderSummary(
      <ReviewSummary
        attempts={[long]}
        averageAccuracy={60}
        remaining={0}
        onDone={onDone}
      />,
    );
    const refresh = await screen.findByRole("button", {
      name: /^Refresh 1 Thessalonians 5:16/,
    });
    expect(refresh.closest("li")).toHaveClass("flex-wrap");
    expect(refresh.parentElement).toHaveClass("flex-wrap");
  });
});

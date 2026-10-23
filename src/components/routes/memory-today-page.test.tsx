import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  dismissLearnPackForToday,
  learnDismissDayKey,
} from "@/lib/learn-dismissed-packs";

import { verseRefKey } from "../../../shared/verse-ref-key";
import { MemoryTodayPage } from "./memory-today-page";

const NOW = Date.UTC(2026, 9, 12, 18);

type TodaySearch = {
  packId?: string;
  only?: "learning" | "review";
  item?: string;
  return?: string;
};

type StubProgress =
  | { label: string }
  | ((run: { done: number; total: number }) => { label: string });

const { frozenResults, liveResults, search, onExit, navigate } = vi.hoisted(
  () => {
    const initial: TodaySearch = {};
    return {
      frozenResults: new Map<string, unknown>(),
      liveResults: new Map<string, unknown>(),
      search: { current: initial },
      onExit: vi.fn(),
      navigate: vi.fn(),
    };
  },
);

vi.mock("@/routes/memory/today", () => ({
  Route: { useSearch: () => search.current },
}));

vi.mock("@/hooks/use-memory-back", () => ({
  useMemoryExit: () => ({
    go: onExit,
    href: "/memory",
    label: "Back to Memory",
    name: "Memory",
  }),
}));

vi.mock("@/hooks/use-live-now", () => ({
  useLiveNow: () => NOW,
}));

vi.mock("@/hooks/use-frozen-query", () => ({
  useFrozenQuery: (name: string, args: unknown) =>
    args === "skip" ? undefined : frozenResults.get(name),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string) => liveResults.get(name),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/components/memory/passage/passage-session", () => ({
  PassageSession: ({
    packName,
    backLabel,
    progress,
    aside,
    onExit: exit,
    onDoneForToday,
  }: {
    packName: string;
    backLabel: string;
    progress?: { label: string } | ((todayShare: number) => { label: string });
    aside?: ReactNode;
    onExit: () => void;
    onDoneForToday?: () => void;
  }) => (
    <div data-testid="passage-session">
      <button type="button" onClick={exit}>
        {backLabel}
      </button>
      <h1>{packName}</h1>
      <p>
        {typeof progress === "function" ? progress(0).label : progress?.label}
      </p>
      <button type="button" onClick={onDoneForToday}>
        That&apos;s enough for today
      </button>
      {aside}
    </div>
  ),
}));

type StubVerse = {
  verseRefId?: string;
  reference: {
    book: string;
    chapter: number;
    startVerse: number;
    endVerse: number;
  };
  learnStage: number;
  status?: string;
};

vi.mock("@/components/memory/practice/memory-session-runner", () => ({
  MemorySessionRunner: ({
    kind,
    verses,
    progress,
    railHeader,
    onComplete,
    initialVerseId,
    runState,
    onRunStateChange,
    onCurrentVerseId,
  }: {
    kind: string;
    verses: StubVerse[];
    progress?: StubProgress;
    railHeader?: ReactNode;
    onComplete?: (result: unknown) => void;
    initialVerseId?: string;
    runState?: unknown;
    onRunStateChange?: (state: unknown, result: unknown) => void;
    onCurrentVerseId?: (id: string) => void;
  }) => {
    // Grade the first `count` cards past today's work (graduated, or
    // rescheduled days out) and report the run, as the board does.
    const spend = (count: number) => {
      const graded = verses.slice(0, count);
      const ids = graded.map((verse) => verseRefKey(verse.reference));
      onRunStateChange?.(
        {
          progress: Object.fromEntries(
            ids.map((id) => [
              id,
              {
                learnStage: 3,
                stageReps: 0,
                status: "reviewing",
                dueAt: NOW + 3 * 24 * 60 * 60 * 1000,
              },
            ]),
          ),
          attempts: [],
          graded: ids,
        },
        {
          verses: graded.map((verse) => ({
            id: verseRefKey(verse.reference),
            reference: verse.reference,
            learnStage: 2,
            status: "learning",
          })),
          attempts: [],
        },
      );
    };
    return (
      <div
        data-testid={`${kind}-session`}
        data-initial-verse={initialVerseId ?? ""}
        data-resumed={runState ? "true" : "false"}
      >
        <p>
          {typeof progress === "function"
            ? progress({ done: 1, total: verses.length }).label
            : progress?.label}
        </p>
        {railHeader}
        <ul>
          {verses.map((verse) => (
            <li key={verse.verseRefId}>{verse.verseRefId}</li>
          ))}
        </ul>
        <button type="button" onClick={() => spend(1)}>
          Spend the first {kind} card
        </button>
        <button type="button" onClick={() => spend(verses.length)}>
          Spend every {kind} card
        </button>
        <button
          type="button"
          onClick={() => {
            const next = verses[1];
            if (next) onCurrentVerseId?.(verseRefKey(next.reference));
          }}
        >
          Show the second {kind} card
        </button>
        <button
          type="button"
          onClick={() =>
            onComplete?.({
              verses: verses.map((verse) => ({
                id: verse.verseRefId,
                reference: verse.reference,
                learnStage: kind === "learning" ? 2 : verse.learnStage,
                status: verse.status,
              })),
              attempts:
                kind === "review"
                  ? verses.map((verse) => ({
                      reference: verse.reference,
                      accuracy: 100,
                    }))
                  : [],
            })
          }
        >
          Finish {kind}
        </button>
      </div>
    );
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    packs: {
      get: "packs.get",
      resolveMembers: "packs.resolveMembers",
    },
    verseMemory: {
      learnQueue: "verseMemory.learnQueue",
      dueQueue: "verseMemory.dueQueue",
      memoryStats: "verseMemory.memoryStats",
    },
    passageMemory: {
      dueForLearning: "passageMemory.dueForLearning",
      getForPack: "passageMemory.getForPack",
    },
  },
}));

const STATS = {
  new: 0,
  learning: 2,
  reviewing: 4,
  mastered: 0,
  total: 6,
  due: 1,
  learningDue: 2,
};

function inMemory(id: string, verse: number, status: "new" | "learning") {
  return {
    verseRefId: id,
    book: "John",
    chapter: 15,
    startVerse: verse,
    endVerse: verse,
    memory: {
      status,
      learnStage: status === "new" ? 0 : 1,
      stageReps: 0,
      ease: 2.3,
      intervalDays: 0,
      dueAt: NOW,
      consecutiveCorrect: 0,
      lapses: 0,
    },
    packIds: [],
  };
}

function dueVerse(id: string, verse: number) {
  return {
    kind: "verse" as const,
    verseRefId: id,
    book: "Luke",
    chapter: 9,
    startVerse: verse,
    endVerse: verse,
    learnStage: 3,
    status: "reviewing" as const,
    dueAt: NOW - 1000,
  };
}

const PSALM_16 = { packId: "psalm16", packName: "Psalm 16", dueAt: NOW - 10 };
const PSALM_23 = { packId: "psalm23", packName: "Psalm 23", dueAt: NOW };

function setToday({
  passages = [PSALM_16],
  learning = [inMemory("jn15_1", 1, "learning"), inMemory("jn15_2", 2, "new")],
  due = [dueVerse("lk9_23", 23)],
  stats = STATS,
}: {
  passages?: unknown[];
  learning?: unknown[];
  due?: unknown[];
  stats?: typeof STATS;
} = {}) {
  frozenResults.set("passageMemory.dueForLearning", passages);
  frozenResults.set("verseMemory.learnQueue", learning);
  frozenResults.set("verseMemory.dueQueue", due);
  frozenResults.set("verseMemory.memoryStats", stats);
}

/** A row in the Today's queue rail inside `container`. */
function queueRow(container: HTMLElement, label: string): HTMLElement {
  const rail = within(container).getByRole("region", { name: "Today's queue" });
  const row = within(rail).getByText(label).closest("li");
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

function renderToday() {
  return render(
    <TooltipProvider delayDuration={0}>
      <MemoryTodayPage />
    </TooltipProvider>,
  );
}

describe("MemoryTodayPage", () => {
  beforeEach(() => {
    frozenResults.clear();
    liveResults.clear();
    localStorage.clear();
    onExit.mockReset();
    navigate.mockReset();
    search.current = { return: "/memory" };
    liveResults.set("passageMemory.getForPack", { _id: "passage_1" });
  });

  it("runs passages, then learning, then reviews, with a pause between each", async () => {
    setToday();
    renderToday();

    const passage = screen.getByTestId("passage-session");
    expect(
      within(passage).getByRole("heading", { name: "Psalm 16" }),
    ).toBeInTheDocument();
    expect(within(passage).getByText("Today · 0 of 4")).toBeInTheDocument();
    expect(
      within(passage).getByRole("button", { name: "Back to Memory" }),
    ).toBeInTheDocument();
    expect(queueRow(passage, "Psalm 16")).toHaveAttribute(
      "data-state",
      "current",
    );
    expect(queueRow(passage, "John 15:1")).toHaveAttribute(
      "data-state",
      "upcoming",
    );
    expect(queueRow(passage, "Luke 9:23")).toHaveAttribute(
      "data-state",
      "upcoming",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );
    expect(localStorage.getItem("berean:learn-dismissed-packs")).toContain(
      "psalm16",
    );

    expect(
      screen.getByRole("heading", { name: "Next up: 2 verses to learn" }),
    ).toBeInTheDocument();
    expect(screen.getByText("About 6 min")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", {
        name: "Session progress: Today · 1 of 4",
      }),
    ).toBeInTheDocument();
    expect(queueRow(document.body, "Psalm 16")).toHaveAttribute(
      "data-state",
      "done",
    );
    expect(queueRow(document.body, "John 15:2")).toHaveAttribute(
      "data-state",
      "upcoming",
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const learning = screen.getByTestId("learning-session");
    expect(within(learning).getByText("Today · 2 of 4")).toBeInTheDocument();
    const overview = within(learning).getByRole("region", { name: "Today" });
    expect(
      within(overview)
        .getAllByRole("listitem")
        .map((part) => part.dataset.state),
    ).toEqual(["done", "current", "upcoming"]);
    expect(within(learning).getByText("jn15_1")).toBeInTheDocument();
    expect(within(learning).getByText("jn15_2")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Finish learning" }),
    );

    expect(
      screen.getByRole("heading", { name: "Next up: 1 review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("About 1 min")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const review = screen.getByTestId("review-session");
    expect(within(review).getByText("Today · 4 of 4")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Finish review" }),
    );

    expect(
      screen.getByRole("heading", { name: "That's today's step." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Psalm 16, 2 learning steps and 1 review done today\./),
    ).toBeInTheDocument();
    expect(screen.getByText("John 15:1")).toBeInTheDocument();
    expect(screen.getByText("Luke 9:23")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Extra practice" }),
    ).toHaveAttribute("href", "/memory/practice?return=%2Fmemory");
    expect(
      screen.getByRole("progressbar", { name: "Session progress: All done" }),
    ).toHaveAttribute("aria-valuenow", "100");

    expect(onExit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("reopens the queue item named in the URL after a remount", async () => {
    setToday({ passages: [PSALM_16, PSALM_23] });
    const { unmount } = renderToday();

    expect(
      screen.getByRole("heading", { name: "Psalm 16" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Go to Psalm 23" }),
    );
    expect(
      screen.getByRole("heading", { name: "Psalm 23" }),
    ).toBeInTheDocument();
    expect(navigate).toHaveBeenCalledWith({
      to: "/memory/today",
      search: { return: "/memory", item: "psalm23" },
      replace: true,
    });

    unmount();
    search.current = { return: "/memory", item: "psalm23" };
    renderToday();

    expect(
      screen.getByRole("heading", { name: "Psalm 23" }),
    ).toBeInTheDocument();
    expect(queueRow(document.body, "Psalm 23")).toHaveAttribute(
      "data-state",
      "current",
    );
    expect(queueRow(document.body, "Psalm 16")).toHaveAttribute(
      "data-state",
      "upcoming",
    );
  });

  it("reopens a verse card named in the URL", () => {
    setToday();
    const item = verseRefKey({
      book: "John",
      chapter: 15,
      startVerse: 2,
      endVerse: 2,
    });
    search.current = { return: "/memory", item };
    renderToday();

    expect(screen.getByTestId("learning-session")).toHaveAttribute(
      "data-initial-verse",
      item,
    );
  });

  it("reopens the card the runner was showing after a remount", async () => {
    setToday({ passages: [] });
    const first = verseRefKey({
      book: "John",
      chapter: 15,
      startVerse: 1,
      endVerse: 1,
    });
    const second = verseRefKey({
      book: "John",
      chapter: 15,
      startVerse: 2,
      endVerse: 2,
    });
    search.current = { return: "/memory", item: first };
    const { unmount } = renderToday();

    expect(screen.getByTestId("learning-session")).toHaveAttribute(
      "data-initial-verse",
      first,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Show the second learning card" }),
    );
    expect(navigate).toHaveBeenCalledWith({
      to: "/memory/today",
      search: { return: "/memory", item: second },
      replace: true,
    });

    unmount();
    search.current = { return: "/memory", item: second };
    renderToday();

    expect(screen.getByTestId("learning-session")).toHaveAttribute(
      "data-initial-verse",
      second,
    );
  });

  it("falls back to the first item when the URL names an unknown item", () => {
    setToday({ passages: [PSALM_16, PSALM_23] });
    search.current = { return: "/memory", item: "nope" };
    renderToday();

    expect(
      screen.getByRole("heading", { name: "Psalm 16" }),
    ).toBeInTheDocument();
  });

  it("jumps to another passage from the queue, moving the current marker", async () => {
    setToday({ passages: [PSALM_16, PSALM_23] });
    renderToday();

    expect(
      screen.getByRole("heading", { name: "Psalm 16" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Go to Psalm 23" }),
    );

    expect(
      screen.getByRole("heading", { name: "Psalm 23" }),
    ).toBeInTheDocument();
    expect(queueRow(document.body, "Psalm 23")).toHaveAttribute(
      "data-state",
      "current",
    );
    expect(queueRow(document.body, "Psalm 23")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(queueRow(document.body, "Psalm 16")).toHaveAttribute(
      "data-state",
      "upcoming",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );
    // On through the plan, coming back to the skipped passage at the end.
    expect(
      screen.getByRole("heading", { name: "Next up: 2 verses to learn" }),
    ).toBeInTheDocument();
    expect(queueRow(document.body, "Psalm 23")).toHaveAttribute(
      "data-state",
      "done",
    );
    expect(
      screen.getByRole("button", { name: "Psalm 23, done for today" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: "Go to Psalm 16" }),
    ).toBeInTheDocument();
  });

  it("jumps straight to a verse to learn or a review, from a passage or a pause", async () => {
    setToday();
    renderToday();

    await userEvent.click(
      screen.getByRole("button", { name: "Go to John 15:2" }),
    );
    const learning = screen.getByTestId("learning-session");
    expect(learning).toHaveAttribute(
      "data-initial-verse",
      verseRefKey({ book: "John", chapter: 15, startVerse: 2, endVerse: 2 }),
    );
    const overview = within(learning).getByRole("region", { name: "Today" });
    expect(
      within(overview)
        .getAllByRole("listitem")
        .map((part) => part.dataset.state),
    ).toEqual(["upcoming", "current", "upcoming"]);

    await userEvent.click(
      within(overview).getByRole("button", { name: "Go to Passages" }),
    );
    expect(
      screen.getByRole("heading", { name: "Psalm 16" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );
    expect(
      screen.getByRole("heading", { name: "Next up: 2 verses to learn" }),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Go to Luke 9:23" }),
    );
    expect(screen.getByTestId("review-session")).toHaveAttribute(
      "data-initial-verse",
      verseRefKey({ book: "Luke", chapter: 9, startVerse: 23, endVerse: 23 }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Finish review" }),
    );
    expect(
      screen.getByRole("heading", { name: "Next up: 2 verses to learn" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Finish learning" }),
    );
    expect(
      screen.getByText(/Psalm 16, 2 learning steps and 1 review done today\./),
    ).toBeInTheDocument();
  });

  it("keeps a verse run's progress when leaving it and coming back", async () => {
    setToday();
    renderToday();

    await userEvent.click(
      screen.getByRole("button", { name: "Go to John 15:1" }),
    );
    expect(screen.getByTestId("learning-session")).toHaveAttribute(
      "data-resumed",
      "false",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Spend the first learning card" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Go to Passages" }),
    );

    expect(screen.getByText("Today · 1 of 4")).toBeInTheDocument();
    expect(queueRow(document.body, "John 15:1")).toHaveAttribute(
      "data-state",
      "done",
    );
    expect(
      screen.getByRole("button", { name: "John 15:1, done for today" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(queueRow(document.body, "John 15:2")).toHaveAttribute(
      "data-state",
      "upcoming",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const learning = screen.getByTestId("learning-session");
    expect(learning).toHaveAttribute("data-resumed", "true");
    expect(learning).toHaveAttribute(
      "data-initial-verse",
      verseRefKey({ book: "John", chapter: 15, startVerse: 2, endVerse: 2 }),
    );
  });

  it("counts a verse part as done once every card is spent, even when left mid-result", async () => {
    setToday();
    renderToday();

    await userEvent.click(
      screen.getByRole("button", { name: "Go to John 15:1" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Spend every learning card" }),
    );
    // Leave before the last result is dismissed, so the run never finishes.
    await userEvent.click(
      screen.getByRole("button", { name: "Go to Reviews" }),
    );
    const overview = within(screen.getByTestId("review-session")).getByRole(
      "region",
      { name: "Today" },
    );
    expect(
      within(overview)
        .getAllByRole("listitem")
        .map((part) => part.dataset.state),
    ).toEqual(["upcoming", "done", "current"]);
    expect(
      within(overview).queryByRole("button", { name: "Go to Verses to learn" }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Finish review" }),
    );
    // Straight on to the passage that's left, not back into spent learning.
    expect(
      screen.getByRole("heading", { name: "Next up: Psalm 16" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "John 15:2, done for today" }),
    ).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );

    expect(
      screen.getByText(/Psalm 16, 2 learning steps and 1 review done today\./),
    ).toBeInTheDocument();
  });

  it("keeps a finished passage closed once its work today is done", async () => {
    setToday();
    renderToday();
    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );

    const finished = screen.getByRole("button", {
      name: "Psalm 16, done for today",
    });
    expect(finished).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(finished);
    expect(
      screen.getByRole("heading", { name: "Next up: 2 verses to learn" }),
    ).toBeInTheDocument();
  });

  it("reopens a finished passage that still has work today", async () => {
    liveResults.set("passageMemory.dueForLearning", [PSALM_16]);
    setToday();
    renderToday();
    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Go back to Psalm 16" }),
    );
    expect(
      screen.getByRole("heading", { name: "Psalm 16" }),
    ).toBeInTheDocument();
    expect(queueRow(document.body, "Psalm 16")).toHaveAttribute(
      "data-state",
      "current",
    );
  });

  it("stops for today from the pause between parts", async () => {
    setToday({ passages: [] });
    renderToday();

    await userEvent.click(
      screen.getByRole("button", { name: "Finish learning" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Stop for today" }),
    );

    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("skips empty parts and goes straight to the summary after the last", async () => {
    setToday({ passages: [], learning: [] });
    renderToday();

    expect(screen.queryByTestId("learning-session")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Finish review" }),
    );

    expect(screen.queryByText(/^Next up/)).not.toBeInTheDocument();
    expect(
      screen.getByText("1 review done today.", { exact: false }),
    ).toBeInTheDocument();
  });

  it("runs only passages and new verses for only learning", async () => {
    search.current = { only: "learning", return: "/memory" };
    setToday();
    renderToday();

    expect(screen.getByTestId("passage-session")).toBeInTheDocument();
    expect(screen.getByText("Today · 0 of 3")).toBeInTheDocument();
    const rail = screen.getByRole("region", { name: "Today's queue" });
    expect(within(rail).queryByText("Reviews")).not.toBeInTheDocument();
    expect(within(rail).queryByText("Luke 9:23")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );

    expect(screen.getByText("New learning")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Finish learning" }),
    );

    expect(screen.queryByTestId("review-session")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Psalm 16 and 2 learning steps done today\./),
    ).toBeInTheDocument();
  });

  it("runs just the reviews for only reviews", async () => {
    search.current = { only: "review", return: "/memory" };
    setToday();
    renderToday();

    expect(screen.queryByTestId("passage-session")).not.toBeInTheDocument();
    expect(screen.queryByTestId("learning-session")).not.toBeInTheDocument();
    const review = screen.getByTestId("review-session");
    expect(within(review).getByText("lk9_23")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Finish review" }),
    );

    expect(screen.getByText("Reviews")).toBeInTheDocument();
    expect(
      screen.getByText("1 review done today.", { exact: false }),
    ).toBeInTheDocument();
  });

  it("skips a passage set aside earlier today", () => {
    dismissLearnPackForToday("psalm16", learnDismissDayKey(NOW));
    setToday();
    renderToday();

    expect(screen.queryByTestId("passage-session")).not.toBeInTheDocument();
    expect(screen.getByTestId("learning-session")).toBeInTheDocument();
  });

  it("hides Extra practice when nothing is memorized", async () => {
    setToday({
      passages: [],
      due: [],
      stats: { ...STATS, reviewing: 0, mastered: 0 },
    });
    renderToday();

    await userEvent.click(
      screen.getByRole("button", { name: "Finish learning" }),
    );

    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Extra practice" }),
    ).not.toBeInTheDocument();
  });

  it("says all caught up when there is nothing to do", async () => {
    setToday({ passages: [], learning: [], due: [] });
    renderToday();

    expect(
      screen.getByRole("heading", { name: "All caught up" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("runs one pack's paced learning, then its due reviews", async () => {
    search.current = { packId: "merced", return: "/memory?panel=pack:merced" };
    setToday();
    frozenResults.set("packs.get", {
      _id: "merced",
      name: "Merced Team",
      kind: "custom",
      createdAt: 0,
      lastOpenedAt: 0,
    });
    frozenResults.set("passageMemory.getForPack", null);
    frozenResults.set("packs.resolveMembers", [
      ...["a", "b", "c", "d", "e"].map((id, index) => ({
        verseRefId: id,
        book: "Romans",
        chapter: 8,
        startVerse: index + 1,
        endVerse: index + 1,
        status: "new",
        learnStage: 0,
        stageReps: 0,
        ease: 2.3,
        intervalDays: 0,
        consecutiveCorrect: 0,
        lapses: 0,
        dueAt: NOW,
        isDue: false,
      })),
      {
        verseRefId: "due",
        book: "Romans",
        chapter: 12,
        startVerse: 2,
        endVerse: 2,
        status: "reviewing",
        learnStage: 3,
        stageReps: 0,
        ease: 2.3,
        intervalDays: 4,
        consecutiveCorrect: 2,
        lapses: 0,
        dueAt: NOW - 1000,
        isDue: true,
      },
    ]);
    renderToday();

    expect(screen.queryByTestId("passage-session")).not.toBeInTheDocument();
    const learning = screen.getByTestId("learning-session");
    expect(within(learning).getByText("Today · 1 of 4")).toBeInTheDocument();
    expect(
      within(learning).getByRole("region", { name: "Today" }),
    ).toHaveTextContent("Verses to learn(now)Reviews1");
    expect(within(learning).queryByText("d")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Finish learning" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const review = screen.getByTestId("review-session");
    expect(within(review).getByText("due")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Finish review" }),
    );
    expect(
      screen.getByRole("link", { name: "Extra practice" }),
    ).toHaveAttribute(
      "href",
      "/memory/practice?return=%2Fmemory%3Fpanel%3Dpack%3Amerced",
    );
  });

  it("picks the day's count and summary back up after leaving and coming back", async () => {
    setToday();
    const first = renderToday();
    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );
    first.unmount();

    setToday({ passages: [] });
    renderToday();
    expect(screen.getByText("Today · 2 of 4")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Finish learning" }),
    );
    expect(
      screen.getByRole("progressbar", {
        name: "Session progress: Today · 3 of 4",
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Finish review" }),
    );

    expect(screen.getByText("Psalm 16")).toBeInTheDocument();
    expect(screen.getByText("John 15:1")).toBeInTheDocument();
  });

  it("shows the day's summary when everything was finished on an earlier visit", async () => {
    setToday({ passages: [], due: [] });
    const first = renderToday();
    await userEvent.click(
      screen.getByRole("button", { name: "Finish learning" }),
    );
    first.unmount();

    setToday({ passages: [], learning: [], due: [] });
    renderToday();
    expect(screen.queryByText("All caught up")).not.toBeInTheDocument();
    expect(screen.getByText("John 15:2")).toBeInTheDocument();
  });

  it("runs only a passage pack's passage", () => {
    search.current = { packId: "psalm16", return: "/memory" };
    setToday();
    frozenResults.set("packs.get", {
      _id: "psalm16",
      name: "Psalm 16",
      kind: "scope",
      createdAt: 0,
      lastOpenedAt: 0,
    });
    frozenResults.set("passageMemory.getForPack", { _id: "passage_1" });
    frozenResults.set("packs.resolveMembers", []);
    renderToday();

    expect(screen.getByTestId("passage-session")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Today's queue" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Next up/)).not.toBeInTheDocument();
  });
});

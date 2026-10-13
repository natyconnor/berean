import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import {
  dismissLearnPackForToday,
  learnDismissDayKey,
} from "@/lib/learn-dismissed-packs";

import { MemoryTodayPage } from "./memory-today-page";

const NOW = Date.UTC(2026, 9, 12, 18);

type TodaySearch = { packId?: string; return?: string };

const { frozenResults, liveResults, search, onExit } = vi.hoisted(() => {
  const initial: TodaySearch = {};
  return {
    frozenResults: new Map<string, unknown>(),
    liveResults: new Map<string, unknown>(),
    search: { current: initial },
    onExit: vi.fn(),
  };
});

vi.mock("@/routes/memory/today", () => ({
  Route: { useSearch: () => search.current },
}));

vi.mock("@/hooks/use-memory-back", () => ({
  useMemoryExit: () => onExit,
  useMemoryExitLabel: () => "Back to Today",
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
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/memory/passage/passage-session", () => ({
  PassageSession: ({
    packName,
    backLabel,
    progress,
    onExit: exit,
    onDoneForToday,
  }: {
    packName: string;
    backLabel: string;
    progress?: { label: string };
    onExit: () => void;
    onDoneForToday?: () => void;
  }) => (
    <div data-testid="passage-session">
      <button type="button" onClick={exit}>
        {backLabel}
      </button>
      <h1>{packName}</h1>
      <p>{progress?.label}</p>
      <button type="button" onClick={onDoneForToday}>
        That&apos;s enough for today
      </button>
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
    onComplete,
  }: {
    kind: string;
    verses: StubVerse[];
    progress?: { label: string };
    onComplete?: (result: unknown) => void;
  }) => (
    <div data-testid={`${kind}-session`}>
      <p>{progress?.label}</p>
      <ul>
        {verses.map((verse) => (
          <li key={verse.verseRefId}>{verse.verseRefId}</li>
        ))}
      </ul>
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
  ),
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
    search.current = { return: "/memory" };
    liveResults.set("passageMemory.getForPack", { _id: "passage_1" });
  });

  it("runs passages, then learning, then reviews, with a pause between each", async () => {
    setToday();
    renderToday();

    const passage = screen.getByTestId("passage-session");
    expect(within(passage).getByText("Psalm 16")).toBeInTheDocument();
    expect(
      within(passage).getByText("Psalm 16 · new verses"),
    ).toBeInTheDocument();
    expect(
      within(passage).getByRole("button", { name: "Back to Today" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "That's enough for today" }),
    );
    expect(localStorage.getItem("berean:learn-dismissed-packs")).toContain(
      "psalm16",
    );

    expect(
      screen.getByText("Nice. Next: 2 learning steps · about 6 min"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const learning = screen.getByTestId("learning-session");
    expect(
      within(learning).getByText("Learning · 2 verses"),
    ).toBeInTheDocument();
    expect(within(learning).getByText("jn15_1")).toBeInTheDocument();
    expect(within(learning).getByText("jn15_2")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Finish learning" }),
    );

    expect(
      screen.getByText("Nice. Next: 1 review · about 1 min"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const review = screen.getByTestId("review-session");
    expect(within(review).getByText("Review · 1")).toBeInTheDocument();
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

    expect(screen.queryByText(/^Nice\. Next/)).not.toBeInTheDocument();
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
    expect(
      within(learning).getByText("Learning · 3 verses"),
    ).toBeInTheDocument();
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
    expect(screen.queryByText(/^Nice\. Next/)).not.toBeInTheDocument();
  });
});

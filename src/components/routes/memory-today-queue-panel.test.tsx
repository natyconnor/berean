import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { verseRefKey } from "../../../shared/verse-ref-key";
import type { EsvChapterData } from "../../../shared/esv-api";

import { MemoryTodayPage } from "./memory-today-page";

const NOW = Date.UTC(2026, 9, 12, 18);

type TodaySearch = {
  item?: string;
  return?: string;
};

const {
  frozenResults,
  liveResults,
  search,
  navigate,
  queryResults,
  getPassageMock,
} = vi.hoisted(() => {
  const search: { current: TodaySearch } = { current: { return: "/memory" } };
  return {
    frozenResults: new Map<string, unknown>(),
    liveResults: new Map<string, unknown>(),
    search,
    navigate: vi.fn(),
    queryResults: new Map<string, unknown>(),
    getPassageMock: vi.fn(),
  };
});

vi.mock("@/routes/memory/today", () => ({
  Route: { useSearch: () => search.current },
}));

vi.mock("@/hooks/use-memory-back", () => ({
  useMemoryExit: () => ({
    go: vi.fn(),
    href: "/memory",
    label: "Back to Memory",
    name: "Memory",
  }),
}));

vi.mock("@/hooks/use-live-now", () => ({
  useLiveNow: () => NOW,
  getSessionNow: () => NOW,
}));

vi.mock("@/hooks/use-frozen-query", () => ({
  useFrozenQuery: (name: string, args: unknown) =>
    args === "skip" ? undefined : frozenResults.get(name),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (name: string, args?: unknown) =>
    args === "skip"
      ? undefined
      : (liveResults.get(name) ?? queryResults.get(name)),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useAction: (name: string) =>
    name === "esv.getPassage" ? getPassageMock : vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
}));

vi.mock("@/components/memory/passage/passage-session", () => ({
  PassageSession: ({
    packName,
    aside,
  }: {
    packName: string;
    aside?: ReactNode;
  }) => (
    <div data-testid="passage-session">
      <h1>{packName}</h1>
      {aside}
    </div>
  ),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    esv: {
      getChaptersBatch: "esv.getChaptersBatch",
      getPassage: "esv.getPassage",
    },
    packs: {
      get: "packs.get",
      resolveMembers: "packs.resolveMembers",
      recordUnifiedReview: "packs.recordUnifiedReview",
      acceptRetryHold: "packs.acceptRetryHold",
    },
    verseMemory: {
      learnQueue: "verseMemory.learnQueue",
      dueQueue: "verseMemory.dueQueue",
      memoryStats: "verseMemory.memoryStats",
      recordAttempt: "verseMemory.recordAttempt",
      acceptRetryHold: "verseMemory.acceptRetryHold",
    },
    passageMemory: {
      dueForLearning: "passageMemory.dueForLearning",
      getForPack: "passageMemory.getForPack",
      recordAttempt: "passageMemory.recordAttempt",
      acceptRetryHold: "passageMemory.acceptRetryHold",
    },
    savedVerses: {
      listAll: "savedVerses.listAll",
      listRecordingIds: "savedVerses.listRecordingIds",
    },
  },
}));

function chapter(
  canonical: string,
  number: number,
  text: string,
): EsvChapterData {
  return { canonical, copyright: "test", verses: [{ number, text }] };
}

function inMemory(id: string, book: string, chapterNo: number, verse: number) {
  return {
    verseRefId: id,
    book,
    chapter: chapterNo,
    startVerse: verse,
    endVerse: verse,
    memory: {
      status: "learning" as const,
      learnStage: 1,
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

function dueVerse(id: string, book: string, chapterNo: number, verse: number) {
  return {
    kind: "verse" as const,
    verseRefId: id,
    book,
    chapter: chapterNo,
    startVerse: verse,
    endVerse: verse,
    learnStage: 3,
    status: "reviewing" as const,
    dueAt: NOW - 1000,
  };
}

function queueRow(label: string): HTMLElement {
  const rail = screen.getByRole("region", { name: "Today's queue" });
  const row = within(rail).getByText(label).closest("li");
  expect(row).not.toBeNull();
  return row as HTMLElement;
}

function railRefs(pattern: RegExp): string[] {
  const rail = screen.getByRole("region", { name: "Today's queue" });
  return [...rail.querySelectorAll("li")]
    .map((row) => row.textContent?.match(pattern)?.[0])
    .filter((text): text is string => text !== undefined);
}

function setToday() {
  frozenResults.set("passageMemory.dueForLearning", [
    { packId: "psalm16", packName: "Psalm 16", dueAt: NOW - 10 },
  ]);
  frozenResults.set("verseMemory.learnQueue", [
    inMemory("gen1_1", "Genesis", 1, 1),
    inMemory("ps8_2", "Psalms", 8, 2),
    inMemory("lk9_23", "Luke", 9, 23),
  ]);
  frozenResults.set("verseMemory.dueQueue", [
    dueVerse("is40_31", "Isaiah", 40, 31),
    dueVerse("mt6_33", "Matthew", 6, 33),
    dueVerse("jn11_35", "John", 11, 35),
  ]);
  frozenResults.set("verseMemory.memoryStats", {
    new: 0,
    learning: 3,
    reviewing: 3,
    mastered: 0,
    total: 6,
    due: 3,
    learningDue: 3,
  });
  liveResults.set("passageMemory.getForPack", { _id: "passage_1" });
  liveResults.set("passageMemory.dueForLearning", [
    { packId: "psalm16", packName: "Psalm 16", dueAt: NOW - 10 },
  ]);
  queryResults.set("savedVerses.listRecordingIds", []);
}

describe("Memory Today queue panel", () => {
  beforeEach(() => {
    frozenResults.clear();
    liveResults.clear();
    queryResults.clear();
    localStorage.clear();
    navigate.mockReset();
    search.current = { return: "/memory" };
    getPassageMock.mockReset();
    getPassageMock.mockImplementation(({ query }: { query: string }) =>
      Promise.resolve(
        query === "Genesis 1"
          ? chapter("Genesis 1", 1, "In the beginning, God created.")
          : query === "Psalm 8"
            ? chapter("Psalm 8", 2, "Out of the mouth of babies.")
            : query === "Luke 9"
              ? chapter("Luke 9", 23, "If anyone would come after me.")
              : query === "Isaiah 40"
                ? chapter("Isaiah 40", 31, "They who wait for the Lord.")
                : query === "Matthew 6"
                  ? chapter("Matthew 6", 33, "Seek first the kingdom.")
                  : chapter("John 11", 35, "Jesus wept."),
      ),
    );
    setToday();
  });

  it("keeps the grouped Today queue when a verse opens from the queue", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <MemoryTodayPage />
      </TooltipProvider>,
    );

    expect(screen.getByTestId("passage-session")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Go to Genesis 1:1" }),
    );

    await waitFor(() => {
      expect(screen.getByText("Learning")).toBeInTheDocument();
      expect(queueRow("Genesis 1:1")).toHaveAttribute("data-state", "current");
    });

    const rail = screen.getByRole("region", { name: "Today's queue" });
    expect(within(rail).getByText("Passages")).toBeInTheDocument();
    expect(within(rail).getByText("Verses to learn")).toBeInTheDocument();
    expect(within(rail).getByText("Reviews")).toBeInTheDocument();
    expect(
      screen.getByRole("radiogroup", { name: "Order" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "In order" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.queryByRole("region", { name: "Today" })).toBeNull();
    expect(screen.queryByRole("group", { name: /learning order/ })).toBeNull();
    expect(screen.queryByText("Progress")).toBeNull();
    expect(
      screen.queryByText(
        "Scripture order. Verses from the same chapter stay together.",
      ),
    ).toBeNull();
  });

  it("keeps Reviews in Scripture order and the switch on the session's per-group setting", async () => {
    search.current = {
      return: "/memory",
      item: verseRefKey({
        book: "Psalms",
        chapter: 8,
        startVerse: 2,
        endVerse: 2,
      }),
    };
    render(
      <TooltipProvider delayDuration={0}>
        <MemoryTodayPage />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Learning")).toBeInTheDocument();
      expect(queueRow("Psalm 8:2")).toHaveAttribute("data-state", "current");
    });

    await userEvent.click(screen.getByRole("radio", { name: "Shuffle" }));
    expect(railRefs(/Genesis 1:1|Psalm 8:2|Luke 9:23/)[0]).toBe("Psalm 8:2");
    expect(railRefs(/Genesis 1:1|Psalm 8:2|Luke 9:23/).join()).not.toBe(
      "Genesis 1:1,Psalm 8:2,Luke 9:23",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Go to Reviews" }),
    );
    await waitFor(() => {
      expect(screen.getByText("Review")).toBeInTheDocument();
      expect(queueRow("Isaiah 40:31")).toHaveAttribute("data-state", "current");
    });
    expect(railRefs(/Isaiah 40:31|Matthew 6:33|John 11:35/)).toEqual([
      "Isaiah 40:31",
      "Matthew 6:33",
      "John 11:35",
    ]);
    expect(screen.getByRole("radio", { name: "In order" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Go to Verses to learn" }),
    );
    await waitFor(() => {
      expect(screen.getByText("Learning")).toBeInTheDocument();
      expect(queueRow("Psalm 8:2")).toHaveAttribute("data-state", "current");
    });
    expect(screen.getByRole("radio", { name: "Shuffle" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(railRefs(/Genesis 1:1|Psalm 8:2|Luke 9:23/)[0]).toBe("Psalm 8:2");
  });
});

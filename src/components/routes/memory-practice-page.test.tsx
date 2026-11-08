import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SUMMARY_REFRESH_BACK_LABEL } from "@/lib/memory-copy";

import { MemoryAllSessionPage } from "./memory-practice-page";
import type { Id } from "../../../convex/_generated/dataModel";

const { frozenArgs, frozenResults, exitGo, exitGoWith, history } = vi.hoisted(
  () => ({
    frozenArgs: new Map<string, unknown>(),
    frozenResults: new Map<string, unknown>(),
    exitGo: vi.fn(),
    exitGoWith: vi.fn(),
    history: { state: {}, back: vi.fn() },
  }),
);

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useLocation: ({ select }: { select: (location: object) => unknown }) =>
    select({ href: "/memory/practice", state: history.state }),
  useRouter: () => ({ history: { back: history.back } }),
}));

vi.mock("@/hooks/use-frozen-query", () => ({
  useFrozenQuery: (query: string, args: unknown) => {
    frozenArgs.set(query, args);
    if (args === "skip") return undefined;
    return frozenResults.get(query);
  },
}));

vi.mock("@/hooks/use-memory-back", () => ({
  useMemoryExit: () => ({
    go: exitGo,
    goWith: exitGoWith,
    href: "/memory",
    label: "Back to Memory",
    name: "Memory",
  }),
}));

vi.mock("@/hooks/use-live-now", () => ({
  useLiveNow: () => 1_700_000_000_000,
}));

vi.mock("@/components/memory/practice/memory-session-runner", () => ({
  MemorySessionRunner: ({
    verses,
    scopeLabel,
    onExit,
    backLabel,
  }: {
    onExit: () => void;
    backLabel: string;
    verses: ReadonlyArray<{
      reference: {
        book: string;
        chapter: number;
        startVerse: number;
        endVerse: number;
      };
    }>;
    scopeLabel: string;
  }) => (
    <div>
      <h1>{scopeLabel}</h1>
      <p>{verses.length} verses</p>
      <p>{backLabel}</p>
      <button type="button" onClick={() => onExit()}>
        Leave
      </button>
    </div>
  ),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    verseMemory: {
      listInMemory: "verseMemory.listInMemory",
      getInMemory: "verseMemory.getInMemory",
    },
  },
}));

const psalm46 = {
  verseRefId: "vr_ps46" as Id<"verseRefs">,
  book: "Psalms",
  chapter: 46,
  startVerse: 10,
  endVerse: 10,
  memory: {
    status: "reviewing" as const,
    learnStage: 3,
    stageReps: 0,
    ease: 2.3,
    intervalDays: 1,
    dueAt: 1,
    consecutiveCorrect: 2,
    lapses: 0,
  },
  packIds: [],
};

const john316 = {
  ...psalm46,
  verseRefId: "vr_jn316" as Id<"verseRefs">,
  book: "John",
  chapter: 3,
  startVerse: 16,
  endVerse: 16,
};

const romans828 = {
  ...psalm46,
  verseRefId: "vr_ro828" as Id<"verseRefs">,
  book: "Romans",
  chapter: 8,
  startVerse: 28,
  endVerse: 28,
  memory: { ...psalm46.memory, status: "learning" as const, learnStage: 1 },
};

const exodus19 = {
  ...psalm46,
  verseRefId: "vr_ex19" as Id<"verseRefs">,
  book: "Exodus",
  chapter: 19,
  startVerse: 4,
  endVerse: 6,
  memory: {
    ...psalm46.memory,
    status: "new" as const,
    learnStage: 0,
    intervalDays: 0,
  },
};

describe("MemoryAllSessionPage", () => {
  beforeEach(() => {
    frozenArgs.clear();
    frozenResults.clear();
    frozenResults.set("verseMemory.listInMemory", [psalm46, john316]);
    frozenResults.set("verseMemory.getInMemory", psalm46);
  });

  it("loads one in-Memory verse for a scoped practice URL", () => {
    render(
      <MemoryAllSessionPage
        kind="practice"
        search={{
          book: "Psalms",
          chapter: 46,
          startVerse: 10,
          endVerse: 10,
        }}
      />,
    );

    expect(frozenArgs.get("verseMemory.listInMemory")).toBe("skip");
    expect(frozenArgs.get("verseMemory.getInMemory")).toEqual({
      book: "Psalms",
      chapter: 46,
      startVerse: 10,
      endVerse: 10,
    });
    expect(screen.getByText("Psalm 46:10")).toBeInTheDocument();
    expect(screen.getByText("1 verses")).toBeInTheDocument();
  });

  it("starts an Up-next verse from a scoped learn URL", () => {
    frozenResults.set("verseMemory.getInMemory", exodus19);

    render(
      <MemoryAllSessionPage
        kind="learning"
        search={{
          book: "Exodus",
          chapter: 19,
          startVerse: 4,
          endVerse: 6,
        }}
      />,
    );

    expect(frozenArgs.get("verseMemory.listInMemory")).toBe("skip");
    expect(frozenArgs.get("verseMemory.getInMemory")).toEqual({
      book: "Exodus",
      chapter: 19,
      startVerse: 4,
      endVerse: 6,
    });
    expect(screen.getByText("Exodus 19:4-6")).toBeInTheDocument();
    expect(screen.getByText("1 verses")).toBeInTheDocument();
  });

  it("shows nothing for a scoped URL whose verse is not in Memory", () => {
    frozenResults.set("verseMemory.getInMemory", null);

    render(
      <MemoryAllSessionPage
        kind="practice"
        search={{
          book: "Psalms",
          chapter: 46,
          startVerse: 10,
          endVerse: 10,
        }}
      />,
    );

    expect(screen.getByText("0 verses")).toBeInTheDocument();
  });

  it("snapshots the in-Memory verses for unscoped practice", () => {
    frozenResults.set("verseMemory.listInMemory", [
      psalm46,
      john316,
      romans828,
    ]);
    render(<MemoryAllSessionPage kind="practice" search={{}} />);

    expect(frozenArgs.get("verseMemory.getInMemory")).toBe("skip");
    expect(frozenArgs.get("verseMemory.listInMemory")).toEqual({});
    expect(screen.getByText("All learned verses")).toBeInTheDocument();
    expect(screen.getByText("2 verses")).toBeInTheDocument();
  });
});

describe("MemoryAllSessionPage ••• Refresh return", () => {
  beforeEach(() => {
    frozenArgs.clear();
    frozenResults.clear();
    exitGo.mockReset();
    exitGoWith.mockReset();
    history.back.mockReset();
    history.state = {};
    frozenResults.set("verseMemory.getInMemory", psalm46);
  });

  const scope = { book: "Psalms", chapter: 46, startVerse: 10, endVerse: 10 };

  it("leaves a refresh naming its verse, so the origin ••• gets focus", () => {
    render(
      <MemoryAllSessionPage
        kind="practice"
        search={{ ...scope, refresh: true }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(exitGoWith).toHaveBeenCalledWith({
      refreshedVerse: "Psalms|46|10|10",
    });
    expect(exitGo).not.toHaveBeenCalled();
  });

  it("leaves an ordinary session plainly", () => {
    render(<MemoryAllSessionPage kind="practice" search={scope} />);
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(exitGo).toHaveBeenCalledTimes(1);
    expect(exitGoWith).not.toHaveBeenCalled();
  });

  it("goes back to the summary a summary Refresh started from (S9)", () => {
    history.state = { summaryRefresh: true };
    render(
      <MemoryAllSessionPage
        kind="practice"
        search={{ ...scope, refresh: true }}
      />,
    );
    expect(screen.getByText(SUMMARY_REFRESH_BACK_LABEL)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(history.back).toHaveBeenCalledTimes(1);
    expect(exitGoWith).not.toHaveBeenCalled();
    expect(exitGo).not.toHaveBeenCalled();
  });

  it("ignores the summary flag outside a Refresh", () => {
    history.state = { summaryRefresh: true };
    render(<MemoryAllSessionPage kind="practice" search={scope} />);
    expect(screen.getByText("Back to Memory")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leave" }));
    expect(exitGo).toHaveBeenCalledTimes(1);
    expect(history.back).not.toHaveBeenCalled();
  });
});

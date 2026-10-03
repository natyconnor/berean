import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryAllSessionPage } from "./memory-practice-page";
import type { Id } from "../../../convex/_generated/dataModel";

const { frozenArgs, frozenResults } = vi.hoisted(() => ({
  frozenArgs: new Map<string, unknown>(),
  frozenResults: new Map<string, unknown>(),
}));

vi.mock("@/hooks/use-frozen-query", () => ({
  useFrozenQuery: (query: string, args: unknown) => {
    frozenArgs.set(query, args);
    if (args === "skip") return undefined;
    return frozenResults.get(query);
  },
}));

vi.mock("@/hooks/use-memory-back", () => ({
  useMemoryBack: () => vi.fn(),
}));

vi.mock("@/hooks/use-live-now", () => ({
  useLiveNow: () => 1_700_000_000_000,
}));

vi.mock("@/components/memory/practice/memory-session-runner", () => ({
  MemorySessionRunner: ({
    verses,
    scopeLabel,
  }: {
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
    </div>
  ),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    savedVerses: {
      listAll: "savedVerses.listAll",
      getHearted: "savedVerses.getHearted",
    },
  },
}));

const psalm46 = {
  _id: "sv_ps46" as Id<"savedVerses">,
  verseRefId: "vr_ps46" as Id<"verseRefs">,
  book: "Psalms",
  chapter: 46,
  startVerse: 10,
  endVerse: 10,
  createdAt: 1,
  memory: {
    status: "reviewing" as const,
    learnStage: 3,
    stageReps: 0,
    intervalDays: 1,
    dueAt: 1,
  },
};

const john316 = {
  ...psalm46,
  _id: "sv_jn316" as Id<"savedVerses">,
  verseRefId: "vr_jn316" as Id<"verseRefs">,
  book: "John",
  chapter: 3,
  startVerse: 16,
  endVerse: 16,
};

const exodus19 = {
  ...psalm46,
  _id: "sv_ex19" as Id<"savedVerses">,
  verseRefId: "vr_ex19" as Id<"verseRefs">,
  book: "Exodus",
  chapter: 19,
  startVerse: 4,
  endVerse: 6,
  memory: {
    status: "new" as const,
    learnStage: 0,
    stageReps: 0,
    intervalDays: 0,
    dueAt: 1,
  },
};

describe("MemoryAllSessionPage", () => {
  beforeEach(() => {
    frozenArgs.clear();
    frozenResults.clear();
    frozenResults.set("savedVerses.listAll", [psalm46, john316]);
    frozenResults.set("savedVerses.getHearted", psalm46);
  });

  it("loads one hearted verse for a scoped practice URL", () => {
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

    expect(frozenArgs.get("savedVerses.listAll")).toBe("skip");
    expect(frozenArgs.get("savedVerses.getHearted")).toEqual({
      book: "Psalms",
      chapter: 46,
      startVerse: 10,
      endVerse: 10,
    });
    expect(screen.getByText("Psalm 46:10")).toBeInTheDocument();
    expect(screen.getByText("1 verses")).toBeInTheDocument();
  });

  it("loads one hearted verse for a scoped learn URL", () => {
    frozenResults.set("savedVerses.getHearted", exodus19);

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

    expect(frozenArgs.get("savedVerses.listAll")).toBe("skip");
    expect(frozenArgs.get("savedVerses.getHearted")).toEqual({
      book: "Exodus",
      chapter: 19,
      startVerse: 4,
      endVerse: 6,
    });
    expect(screen.getByText("Exodus 19:4-6")).toBeInTheDocument();
    expect(screen.getByText("1 verses")).toBeInTheDocument();
  });

  it("snapshots the hearted library for unscoped practice", () => {
    render(<MemoryAllSessionPage kind="practice" search={{}} />);

    expect(frozenArgs.get("savedVerses.getHearted")).toBe("skip");
    expect(frozenArgs.get("savedVerses.listAll")).toEqual({});
    expect(screen.getByText("All learned verses")).toBeInTheDocument();
    expect(screen.getByText("2 verses")).toBeInTheDocument();
  });
});

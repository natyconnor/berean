import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryReviewPage } from "./memory-review-page";
import type { Id } from "../../../convex/_generated/dataModel";

const { queryResults, useQueryMock } = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  useQueryMock: vi.fn(),
}));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: (query: string, args: unknown) => {
    useQueryMock(query, args);
    if (args === "skip") return undefined;
    return queryResults.get(query);
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (query: string, args: unknown) => {
    useQueryMock(query, args);
    if (args === "skip") return undefined;
    return queryResults.get(query);
  },
  useMutation: () => vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useCanGoBack: () => false,
}));

vi.mock("@/routes/memory/review", () => ({
  Route: { useSearch: () => ({}) },
}));

vi.mock("@/components/memory/practice/memory-session-runner", () => ({
  MemorySessionRunner: ({
    remainingDue,
    verses,
  }: {
    remainingDue?: number;
    verses: ReadonlyArray<{ verseRefId?: string }>;
  }) => (
    <div>
      <span data-testid="remaining-due">{remainingDue}</span>
      <span data-testid="verse-count">{verses.length}</span>
      <span data-testid="verse-ref-id">{verses[0]?.verseRefId ?? ""}</span>
    </div>
  ),
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    verseMemory: {
      dueQueue: "verseMemory.dueQueue",
      dueForVerse: "verseMemory.dueForVerse",
      memoryStats: "verseMemory.memoryStats",
    },
  },
}));

function dueVerse(startVerse: number) {
  return {
    kind: "verse" as const,
    verseRefId: `vr_${startVerse}` as Id<"verseRefs">,
    book: "Psalms",
    chapter: 23,
    startVerse,
    endVerse: startVerse,
    learnStage: 3,
    status: "reviewing" as const,
    dueAt: 1,
  };
}

describe("MemoryReviewPage", () => {
  beforeEach(() => {
    queryResults.clear();
    useQueryMock.mockClear();
    queryResults.set("verseMemory.dueQueue", [dueVerse(1), dueVerse(2)]);
    queryResults.set("verseMemory.memoryStats", {
      new: 0,
      learning: 0,
      reviewing: 10,
      mastered: 0,
      total: 10,
      due: 80,
      learningDue: 0,
    });
  });

  it("freezes dueQueue and memoryStats then skips them", () => {
    render(<MemoryReviewPage />);

    expect(screen.getByTestId("verse-count")).toHaveTextContent("2");
    expect(screen.getByTestId("remaining-due")).toHaveTextContent("78");
    expect(screen.getByTestId("verse-ref-id")).toHaveTextContent("vr_1");

    const skipped = useQueryMock.mock.calls.filter(
      (call) => call[1] === "skip",
    );
    expect(skipped).toEqual(
      expect.arrayContaining([
        ["verseMemory.dueQueue", "skip"],
        ["verseMemory.memoryStats", "skip"],
      ]),
    );
  });
});

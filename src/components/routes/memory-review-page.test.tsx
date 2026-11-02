import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetApplyLeftoverHeldAttemptsForTests } from "@/hooks/use-apply-leftover-held-attempts";
import { MemoryReviewPage } from "./memory-review-page";
import type { Id } from "../../../convex/_generated/dataModel";

const { queryResults, useQueryMock, leftoverApply } = vi.hoisted(() => ({
  queryResults: new Map<string, unknown>(),
  useQueryMock: vi.fn(),
  leftoverApply: vi.fn(() => Promise.resolve({ applied: 0 })),
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
  useMutation: () => leftoverApply,
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
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
    packs: { get: "packs.get" },
    verseMemory: {
      dueQueue: "verseMemory.dueQueue",
      dueForVerse: "verseMemory.dueForVerse",
      memoryStats: "verseMemory.memoryStats",
      verseDetail: "verseMemory.verseDetail",
      applyLeftoverHeldAttempts: "verseMemory.applyLeftoverHeldAttempts",
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
    resetApplyLeftoverHeldAttemptsForTests();
    leftoverApply.mockReset();
    leftoverApply.mockResolvedValue({ applied: 0 });
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

  it("freezes dueQueue and memoryStats then skips them", async () => {
    render(<MemoryReviewPage />);

    await waitFor(() => {
      expect(screen.getByTestId("verse-count")).toHaveTextContent("2");
    });
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

  it("after a held-card reload, waits for leftover apply then omits the counted verse from due", async () => {
    let release: (value: { applied: number }) => void = () => {};
    leftoverApply.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    render(<MemoryReviewPage />);
    expect(screen.queryByTestId("verse-count")).not.toBeInTheDocument();
    expect(useQueryMock).toHaveBeenCalledWith("verseMemory.dueQueue", "skip");
    expect(leftoverApply).toHaveBeenCalledWith({});

    queryResults.set("verseMemory.dueQueue", [dueVerse(2)]);
    queryResults.set("verseMemory.memoryStats", {
      new: 0,
      learning: 0,
      reviewing: 10,
      mastered: 0,
      total: 10,
      due: 79,
      learningDue: 0,
    });
    release({ applied: 1 });

    await waitFor(() => {
      expect(screen.getByTestId("verse-count")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("verse-ref-id")).toHaveTextContent("vr_2");
    expect(screen.queryByTestId("verse-ref-id")).not.toHaveTextContent("vr_1");
  });

  it("after a mid-step-2 reload, waits for leftover apply then omits the counted verse from due", async () => {
    let release: (value: { applied: number }) => void = () => {};
    leftoverApply.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    render(<MemoryReviewPage />);
    expect(screen.queryByTestId("verse-count")).not.toBeInTheDocument();

    queryResults.set("verseMemory.dueQueue", [dueVerse(2)]);
    release({ applied: 1 });

    await waitFor(() => {
      expect(screen.getByTestId("verse-count")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("verse-ref-id")).toHaveTextContent("vr_2");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryDashboard } from "./dashboard";

const { ensureReviewActivityDaysMock, ensurePassageDueBackfillMock } =
  vi.hoisted(() => ({
    ensureReviewActivityDaysMock: vi.fn(() => Promise.resolve(null)),
    ensurePassageDueBackfillMock: vi.fn(() => Promise.resolve(null)),
  }));

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => undefined,
}));

vi.mock("convex/react", () => ({
  useMutation: (fn: unknown) => {
    if (fn === "passageMemory.ensureDueBackfill") {
      return ensurePassageDueBackfillMock;
    }
    return ensureReviewActivityDaysMock;
  },
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    verseMemory: {
      memoryStats: "verseMemory.memoryStats",
      memoryStatus: "verseMemory.memoryStatus",
      reviewActivity: "verseMemory.reviewActivity",
      reviewForecast: "verseMemory.reviewForecast",
      ensureReviewActivityDays: "verseMemory.ensureReviewActivityDays",
    },
    passageMemory: {
      ensureDueBackfill: "passageMemory.ensureDueBackfill",
    },
  },
}));

vi.mock("@/lib/viewer-timezone", () => ({
  getViewerTimeZone: () => "UTC",
}));

const status = {
  new: 2,
  learning: 3,
  reviewing: 4,
  mastered: 1,
  total: 10,
};

describe("MemoryDashboard query split", () => {
  it("paints Mastery and in-memory from status while Today still waits on due stats", () => {
    render(
      <MemoryDashboard
        now={0}
        stats={undefined}
        status={status}
        onStartReview={() => undefined}
        onStartLearning={() => undefined}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Mastery distribution: 3 learning, 4 reviewing, 1 mastered.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("8 started")).toBeInTheDocument();
    expect(screen.getByText("In memory")).toBeInTheDocument();

    expect(
      screen.getByLabelText("Loading today's memory work"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review" }),
    ).not.toBeInTheDocument();
  });

  it("asks Convex to backfill heatmap days and skinny passage due rows", () => {
    ensureReviewActivityDaysMock.mockClear();
    ensurePassageDueBackfillMock.mockClear();
    render(
      <MemoryDashboard
        now={1_700_000_000_000}
        stats={undefined}
        status={status}
        onStartReview={() => undefined}
        onStartLearning={() => undefined}
      />,
    );

    expect(ensureReviewActivityDaysMock).toHaveBeenCalledWith({
      now: 1_700_000_000_000,
      timeZone: "UTC",
    });
    expect(ensurePassageDueBackfillMock).toHaveBeenCalledWith({
      now: 1_700_000_000_000,
    });
  });
});

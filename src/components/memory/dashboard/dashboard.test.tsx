import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MemoryDashboard } from "./dashboard";

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => undefined,
}));

vi.mock("convex/react", () => ({
  useMutation: () => () => Promise.resolve(null),
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
});

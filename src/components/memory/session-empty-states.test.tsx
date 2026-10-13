import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DAY_MS } from "@/lib/memory-scheduler";

import {
  LearnEmptyState,
  PracticeEmptyState,
  ReviewEmptyState,
} from "./session-empty-states";

// Tue Oct 13 2026, 09:00 in Los Angeles.
const NOW = Date.UTC(2026, 9, 13, 16, 0);

const mocks = vi.hoisted(() => {
  const state: { inMemory: unknown } = { inMemory: undefined };
  return state;
});

vi.mock("convex-helpers/react/cache", () => ({
  useQuery: () => mocks.inMemory,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: { verseMemory: { listInMemory: "verseMemory.listInMemory" } },
}));

vi.mock("@/lib/viewer-timezone", () => ({
  getViewerTimeZone: () => "America/Los_Angeles",
}));

function memorized(dueAt: number) {
  return {
    memory: { status: "reviewing", learnStage: 3, dueAt },
  };
}

describe("ReviewEmptyState", () => {
  beforeEach(() => {
    mocks.inMemory = undefined;
  });

  it("names the next review day and goes back to Today", async () => {
    mocks.inMemory = [memorized(NOW + 3 * DAY_MS), memorized(NOW + 2 * DAY_MS)];
    const onExit = vi.fn();
    render(
      <ReviewEmptyState now={NOW} onExit={onExit} backLabel="Back to Today" />,
    );

    expect(
      screen.getByRole("heading", { name: "All caught up" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Your next review is Thursday."),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Back to Today" }),
    );
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("link", { name: "Go to Today" }),
    ).not.toBeInTheDocument();
  });

  it("offers Today beside Back when Back leaves Memory", async () => {
    mocks.inMemory = [memorized(NOW + 2 * DAY_MS)];
    const onExit = vi.fn();
    render(<ReviewEmptyState now={NOW} onExit={onExit} backLabel="Back" />);

    expect(screen.getByRole("link", { name: "Go to Today" })).toHaveAttribute(
      "href",
      "/memory",
    );
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("says there is nothing to review before anything is memorized", () => {
    mocks.inMemory = [];
    render(
      <ReviewEmptyState now={NOW} onExit={vi.fn()} backLabel="Back to Today" />,
    );

    expect(
      screen.getByRole("heading", { name: "Nothing to review yet" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Your next review/)).not.toBeInTheDocument();
  });
});

describe("PracticeEmptyState", () => {
  it("explains when practice opens", () => {
    render(<PracticeEmptyState onExit={vi.fn()} backLabel="Back to Today" />);

    expect(
      screen.getByRole("heading", { name: "Nothing to practice yet" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Practice opens once you've memorized your first verse.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Back to Today" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Go to Today" }),
    ).not.toBeInTheDocument();
  });

  it("offers Today beside Back when Back leaves Memory", () => {
    render(<PracticeEmptyState onExit={vi.fn()} backLabel="Back" />);

    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Today" })).toHaveAttribute(
      "href",
      "/memory",
    );
  });
});

describe("LearnEmptyState", () => {
  it("offers Today beside Back after a verse opened from the reader", () => {
    render(
      <LearnEmptyState
        verses={[
          {
            status: "learning",
            learnStage: 1,
            dueAt: NOW + DAY_MS,
            lastReviewedAt: NOW,
          },
        ]}
        now={NOW}
        onExit={vi.fn()}
        backLabel="Back"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Nothing new today" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Today" })).toHaveAttribute(
      "href",
      "/memory",
    );
  });

  it("lets Start something new stand in for Today", () => {
    render(
      <LearnEmptyState
        verses={[]}
        now={NOW}
        onExit={vi.fn()}
        backLabel="Back"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Start something new" }),
    ).toHaveAttribute("href", "/memory");
    expect(
      screen.queryByRole("link", { name: "Go to Today" }),
    ).not.toBeInTheDocument();
  });
});

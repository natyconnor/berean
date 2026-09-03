import type { HTMLAttributes, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FROM_MEMORY_CLOSE_MESSAGE } from "./from-memory-messages";
import { VerseMemoryFeedback } from "./verse-memory-feedback";

vi.mock("framer-motion", () => ({
  useReducedMotion: () => true,
  motion: {
    div: ({
      children,
      ...props
    }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) => (
      <div {...props}>{children}</div>
    ),
    span: ({
      children,
      ...props
    }: HTMLAttributes<HTMLSpanElement> & { children?: ReactNode }) => (
      <span {...props}>{children}</span>
    ),
  },
}));

describe("VerseMemoryFeedback", () => {
  it("celebrates a near-miss on bands that still accept close recalls", () => {
    render(<VerseMemoryFeedback quality="close" attemptKey="guided-close" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Good job — really close!",
    );
  });

  it("explains that From Memory needs 100% before the verse can advance", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        attemptKey="memory-close"
        requireExactToAdvance
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      FROM_MEMORY_CLOSE_MESSAGE,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("really close");
  });

  it("keeps the exact celebration unchanged on From Memory", () => {
    render(
      <VerseMemoryFeedback
        quality="exact"
        attemptKey="memory-exact"
        requireExactToAdvance
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Exactly right!");
  });

  it("tells Review to retry at 80%+ so the interval can still stretch", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={82}
        attemptKey="review-retry"
        showScheduleOutcome
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Almost — try again to earn a longer wait.",
    );
  });

  it("keeps the current gap on a 60–79% Review recall", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={70}
        attemptKey="review-hold"
        showScheduleOutcome
        nextSchedule={{
          status: "reviewing",
          learnStage: 3,
          stageReps: 0,
          ease: 2.3,
          intervalDays: 2,
          dueAt: 1_700_000_000_000 + 2 * 24 * 60 * 60 * 1000,
          consecutiveCorrect: 3,
          lapses: 0,
          earlyReviewApplied: false,
        }}
        now={1_700_000_000_000}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /Not bad, but some mistakes — next review/,
    );
  });

  it("explains a daily-review lapse back to Challenge", () => {
    render(
      <VerseMemoryFeedback
        quality="off"
        accuracy={40}
        attemptKey="review-lapse-challenge"
        showScheduleOutcome
        nextSchedule={{
          status: "learning",
          learnStage: 2,
          stageReps: 0,
          ease: 2.1,
          intervalDays: 0,
          dueAt: 1_700_000_000_000,
          consecutiveCorrect: 0,
          lapses: 1,
          earlyReviewApplied: false,
        }}
        now={1_700_000_000_000}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Needs practice — back to Challenge.",
    );
  });

  it("explains a one-step review lapse that stays in the queue", () => {
    render(
      <VerseMemoryFeedback
        quality="off"
        accuracy={40}
        attemptKey="review-lapse-daily"
        showScheduleOutcome
        nextSchedule={{
          status: "reviewing",
          learnStage: 3,
          stageReps: 0,
          ease: 2.1,
          intervalDays: 1,
          dueAt: 1_700_000_000_000 + 24 * 60 * 60 * 1000,
          consecutiveCorrect: 0,
          lapses: 1,
          earlyReviewApplied: false,
        }}
        now={1_700_000_000_000}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /Needs practice — next review/,
    );
  });
});

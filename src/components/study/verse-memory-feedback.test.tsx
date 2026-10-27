import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FROM_MEMORY_CLOSE_MESSAGE,
  FROM_MEMORY_HINT_PASS_MESSAGE,
} from "./from-memory-messages";
import { VerseMemoryFeedback } from "./verse-memory-feedback";

const { useReducedMotion } = vi.hoisted(() => ({
  useReducedMotion: vi.fn(() => true),
}));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => useReducedMotion() };
});

const NOW = 1_700_000_000_000;

const reviewingSchedule = {
  status: "reviewing" as const,
  learnStage: 3,
  stageReps: 3,
  ease: 2.3,
  intervalDays: 2,
  dueAt: NOW + 3 * 24 * 60 * 60 * 1000,
  consecutiveCorrect: 4,
  lapses: 0,
  earlyReviewApplied: false,
};

describe("VerseMemoryFeedback", () => {
  beforeEach(() => {
    useReducedMotion.mockReturnValue(true);
  });

  it("celebrates an exact recall in one banner: emoji, headline, praise, percentage, and schedule", () => {
    useReducedMotion.mockReturnValue(false);
    render(
      <VerseMemoryFeedback
        quality="exact"
        accuracy={100}
        attemptKey="review-exact"
        showScheduleOutcome
        nextSchedule={reviewingSchedule}
        now={NOW}
      />,
    );
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("data-tone", "exact");
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("🎉");
    expect(screen.getByText("Word for word.")).toBeInTheDocument();
    expect(screen.getByText("Nailed it!")).toBeInTheDocument();
    expect(screen.getByText("100% recalled")).toBeInTheDocument();
    expect(screen.getByText("Next review in 3 days.")).toBeInTheDocument();
    expect(screen.getByTestId("confetti-burst")).toBeInTheDocument();
  });

  it("keeps the emoji but skips the particle burst when motion is reduced", () => {
    render(
      <VerseMemoryFeedback
        quality="exact"
        accuracy={100}
        attemptKey="review-exact-reduced"
        showScheduleOutcome
        nextSchedule={reviewingSchedule}
        now={NOW}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Word for word.");
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("🎉");
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
  });

  it("celebrates an exact learning recall too", () => {
    useReducedMotion.mockReturnValue(false);
    render(
      <VerseMemoryFeedback
        quality="exact"
        accuracy={100}
        attemptKey="learn-exact"
        requireExactToAdvance
      />,
    );
    expect(screen.getByText("Word for word.")).toBeInTheDocument();
    expect(screen.getByText("Nailed it!")).toBeInTheDocument();
    expect(screen.getByText("100% recalled")).toBeInTheDocument();
    expect(screen.getByTestId("confetti-burst")).toBeInTheDocument();
  });

  it("saves the confetti for word-for-word recalls", () => {
    useReducedMotion.mockReturnValue(false);
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={91}
        errors={{
          matches: 10,
          typos: 0,
          mismatches: 1,
          missing: 0,
          extra: 0,
        }}
        attemptKey="learn-close"
      />,
    );
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("data-tone", "nearly");
    expect(banner).toHaveTextContent("Nearly there.");
    expect(banner).toHaveTextContent("Oh so close! Just one word off.");
    expect(banner).toHaveTextContent("91% recalled");
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("🙌");
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
  });

  it("stays encouraging, with calmer emoji, on lower recalls", () => {
    const { unmount } = render(
      <VerseMemoryFeedback quality="close" accuracy={70} attemptKey="mid" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Good progress. The highlighted words are worth another look.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mostly there, but it needs some work.",
    );
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("🌱");
    unmount();

    render(
      <VerseMemoryFeedback quality="off" accuracy={40} attemptKey="low" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "This one needs another pass.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "A handful of words came back.",
    );
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("📖");
  });

  it("trails the percentage with a note", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={72}
        attemptKey="passage-miss"
        note="Pass at 85%"
      />,
    );
    expect(screen.getByText("72% recalled · Pass at 85%")).toBeInTheDocument();
  });

  it("explains that the last From Memory recall needs 100% to graduate", () => {
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
  });

  it("replaces the 100% graduation line when a hinted pass can be retried", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={92}
        attemptKey="hinted-retry"
        requireExactToAdvance
        praiseLine={FROM_MEMORY_HINT_PASS_MESSAGE}
      />,
    );
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(FROM_MEMORY_HINT_PASS_MESSAGE);
    expect(banner).not.toHaveTextContent(FROM_MEMORY_CLOSE_MESSAGE);
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
    expect(screen.getByRole("status")).toHaveTextContent("Almost there.");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Try again to extend your review interval.",
    );
  });

  it("calls out a single wrong word on Review retry", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={91}
        errors={{
          matches: 10,
          typos: 0,
          mismatches: 1,
          missing: 0,
          extra: 0,
        }}
        attemptKey="review-one-word"
        showScheduleOutcome
        nextSchedule={{
          ...reviewingSchedule,
          intervalDays: 1,
          dueAt: NOW,
          consecutiveCorrect: 3,
        }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Oh so close! Just one word off.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Try again to extend your review interval from 1 day to 2 days.",
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
          ...reviewingSchedule,
          stageReps: 0,
          dueAt: NOW + 2 * 24 * 60 * 60 * 1000,
          consecutiveCorrect: 3,
        }}
        now={NOW}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mostly there, but it needs some work.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Next review in/);
  });

  it("explains a daily-review lapse back to the blanks step", () => {
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
          dueAt: NOW,
          consecutiveCorrect: 0,
          lapses: 1,
          earlyReviewApplied: false,
        }}
        now={NOW}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "A handful of words came back.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Back to fill in the blanks.",
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
          ...reviewingSchedule,
          stageReps: 0,
          ease: 2.1,
          intervalDays: 1,
          dueAt: NOW + 24 * 60 * 60 * 1000,
          consecutiveCorrect: 0,
          lapses: 1,
        }}
        now={NOW}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Next review/);
  });

  it("leaves the schedule line off until the next review is known", () => {
    render(
      <VerseMemoryFeedback
        quality="exact"
        accuracy={100}
        attemptKey="review-pending"
        showScheduleOutcome
      />,
    );
    expect(screen.getByText("Nailed it!")).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent(/review/i);
  });

  it("keeps Need a refresher on the score row and out of the live region", () => {
    render(
      <VerseMemoryFeedback
        quality="off"
        accuracy={0}
        attemptKey="after-miss"
        showScheduleOutcome
        nextSchedule={{
          status: "learning",
          learnStage: 2,
          stageReps: 0,
          ease: 2.1,
          intervalDays: 0,
          dueAt: NOW,
          consecutiveCorrect: 0,
          lapses: 1,
          earlyReviewApplied: false,
        }}
        now={NOW}
        refresherOffer={<button type="button">Need a refresher?</button>}
      />,
    );
    const offer = screen.getByRole("button", { name: "Need a refresher?" });
    expect(offer).toBeVisible();
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "Need a refresher?",
    );
    expect(screen.getByText("0% recalled").compareDocumentPosition(offer)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});

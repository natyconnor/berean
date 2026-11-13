import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRACTICE_ONLY_CLOSING,
  PRACTICE_PASS_EMOJI,
  PRACTICE_PASS_LINE,
} from "@/lib/memory-copy";

import { FROM_MEMORY_CLOSE_MESSAGE } from "./from-memory-messages";
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

/** The banner's lines, in order. */
function bannerLines(): string[] {
  return Array.from(screen.getByRole("status").querySelectorAll("p")).map(
    (line) => line.textContent ?? "",
  );
}

describe("VerseMemoryFeedback", () => {
  beforeEach(() => {
    useReducedMotion.mockReturnValue(true);
  });

  it("celebrates a perfect attempt in one banner: emoji, one line, percentage, and schedule", () => {
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
    expect(bannerLines()).toEqual([
      "Perfect!",
      "100% correct",
      "Next review in 3 days.",
    ]);
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
    expect(screen.getByRole("status")).toHaveTextContent("Perfect!");
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("🎉");
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
  });

  it("celebrates a perfect learning attempt too", () => {
    useReducedMotion.mockReturnValue(false);
    render(
      <VerseMemoryFeedback
        quality="exact"
        accuracy={100}
        attemptKey="learn-exact"
        requireExactToAdvance
      />,
    );
    expect(bannerLines()).toEqual(["Perfect!", "100% correct"]);
    expect(screen.getByTestId("confetti-burst")).toBeInTheDocument();
  });

  it("says a perfect attempt with a typo is basically perfect, once", () => {
    render(
      <VerseMemoryFeedback
        quality="exact"
        accuracy={97}
        errors={{ matches: 9, typos: 1, mismatches: 0, missing: 0, extra: 0 }}
        attemptKey="learn-typo"
      />,
    );
    expect(bannerLines()).toEqual([
      "Basically perfect, just one typo!",
      "97% correct",
    ]);
  });

  it("saves the confetti for perfect attempts", () => {
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
    expect(banner).toHaveAttribute("data-tone", "pass");
    expect(bannerLines()).toEqual([
      "So close! Just one word off.",
      "91% correct",
    ]);
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("🙌");
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
  });

  it("stays encouraging, with calmer emoji, on lower scores", () => {
    const { unmount } = render(
      <VerseMemoryFeedback quality="close" accuracy={70} attemptKey="mid" />,
    );
    expect(bannerLines()).toEqual([
      "Mostly there, but it needs some work.",
      "70% correct",
    ]);
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("🌱");
    unmount();

    render(
      <VerseMemoryFeedback quality="off" accuracy={40} attemptKey="low" />,
    );
    expect(bannerLines()).toEqual([
      "You still need some work on this one.",
      "40% correct",
    ]);
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("📖");
  });

  it("trails the percentage with a note", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={72}
        attemptKey="passage-miss"
        note="you need 85% to pass"
      />,
    );
    expect(
      screen.getByText("72% correct · you need 85% to pass"),
    ).toBeInTheDocument();
  });

  it("explains that the last From Memory step needs 100% to graduate", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        attemptKey="memory-close"
        requireExactToAdvance
      />,
    );
    expect(bannerLines()).toEqual([FROM_MEMORY_CLOSE_MESSAGE, "70% correct"]);
  });

  it("shows an 85–99% Review pass with the next-review line", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={90}
        attemptKey="review-pass"
        showScheduleOutcome
        nextSchedule={{
          ...reviewingSchedule,
          intervalDays: 1,
          dueAt: NOW + 24 * 60 * 60 * 1000,
        }}
        now={NOW}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("data-tone", "pass");
    expect(bannerLines()).toEqual([
      "A few slips, but you know it.",
      "90% correct",
      "Next review tomorrow.",
    ]);
  });

  it("calls out a single wrong word on an 85–99% Review pass", () => {
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
          dueAt: NOW + 24 * 60 * 60 * 1000,
          consecutiveCorrect: 3,
        }}
        now={NOW}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "So close! Just one word off.",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/Next review/);
  });

  it("steps a 60–84% Review attempt back with a next-review line", () => {
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

  it("says a daily-review lapse will be learned again from the blanks step", () => {
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
    expect(bannerLines()).toEqual([
      "You still need some work on this one.",
      "40% correct",
      "We'll learn it again, starting with fill in the blanks.",
    ]);
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

  it("says a Review miss comes back sooner until its date is known", () => {
    render(
      <VerseMemoryFeedback
        quality="off"
        accuracy={40}
        attemptKey="review-miss-pending"
        showScheduleOutcome
      />,
    );
    expect(bannerLines()).toEqual([
      "You still need some work on this one.",
      "40% correct",
      "We'll review it again sooner.",
    ]);
  });

  it("promises nothing about the schedule on a learning miss", () => {
    render(
      <VerseMemoryFeedback
        quality="off"
        accuracy={40}
        attemptKey="learn-miss"
      />,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(/review/i);
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
    expect(screen.getByText("Perfect!")).toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent(/review/i);
  });

  it("holds a First letters miss without a next-review line", () => {
    useReducedMotion.mockReturnValue(false);
    render(
      <VerseMemoryFeedback
        quality="off"
        accuracy={40}
        attemptKey="refresh-step1"
        showScheduleOutcome
        scheduleHeld
        skipCelebrate
        nextSchedule={reviewingSchedule}
        now={NOW}
      />,
    );
    expect(bannerLines()).toEqual([
      "You still need some work on this one.",
      "40% correct",
    ]);
  });

  it("skips the celebration pop on a held 100%", () => {
    useReducedMotion.mockReturnValue(false);
    render(
      <VerseMemoryFeedback
        quality="exact"
        accuracy={100}
        attemptKey="refresh-step1-exact"
        showScheduleOutcome
        scheduleHeld
        skipCelebrate
        nextSchedule={reviewingSchedule}
        now={NOW}
      />,
    );
    expect(screen.getByText("Perfect!")).toBeInTheDocument();
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).not.toHaveTextContent(/Next review/);
  });

  it("uses the practice pass line at 100% instead of Perfect", () => {
    useReducedMotion.mockReturnValue(false);
    render(
      <VerseMemoryFeedback
        quality="exact"
        accuracy={100}
        attemptKey="practice-pass-100"
        showScheduleOutcome
        scheduleHeld
        practiceOnly
        nextSchedule={reviewingSchedule}
        now={NOW}
        closingLine={PRACTICE_ONLY_CLOSING}
      />,
    );
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("data-tone", "pass");
    expect(screen.getByTestId("result-emoji")).toHaveTextContent(
      PRACTICE_PASS_EMOJI,
    );
    expect(bannerLines()).toEqual([
      PRACTICE_PASS_LINE,
      "100% correct",
      PRACTICE_ONLY_CLOSING,
    ]);
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
  });

  it("uses the practice pass line at 90%", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={90}
        attemptKey="practice-pass-90"
        showScheduleOutcome
        scheduleHeld
        practiceOnly
        nextSchedule={reviewingSchedule}
        now={NOW}
        closingLine={PRACTICE_ONLY_CLOSING}
      />,
    );
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("data-tone", "pass");
    expect(screen.getByTestId("result-emoji")).toHaveTextContent(
      PRACTICE_PASS_EMOJI,
    );
    expect(bannerLines()).toEqual([
      PRACTICE_PASS_LINE,
      "90% correct",
      PRACTICE_ONLY_CLOSING,
    ]);
  });

  it("keeps the score line on a practice-only 70%", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={70}
        attemptKey="practice-miss-70"
        showScheduleOutcome
        scheduleHeld
        practiceOnly
        nextSchedule={reviewingSchedule}
        now={NOW}
        closingLine={PRACTICE_ONLY_CLOSING}
      />,
    );
    expect(bannerLines()).toEqual([
      "Mostly there, but it needs some work.",
      "70% correct",
      PRACTICE_ONLY_CLOSING,
    ]);
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("🌱");
  });

  it("puts a practice-only closing line where Next review would sit", () => {
    render(
      <VerseMemoryFeedback
        quality="close"
        accuracy={70}
        attemptKey="practice-round"
        showScheduleOutcome
        scheduleHeld
        nextSchedule={reviewingSchedule}
        now={NOW}
        bannerId="result-banner"
        closingLine={PRACTICE_ONLY_CLOSING}
      />,
    );
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("id", "result-banner");
    expect(banner).toHaveTextContent(PRACTICE_ONLY_CLOSING);
    expect(banner).not.toHaveTextContent(/Next review/);
  });
});

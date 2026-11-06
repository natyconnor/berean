import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MASTERED_INTERVAL_DAYS,
  requiredRepsFor,
} from "@/lib/memory-scheduler";

import { LearningJourneyBar } from "./learning-journey-bar";

const { useReducedMotion } = vi.hoisted(() => ({
  useReducedMotion: vi.fn(() => false),
}));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return { ...actual, useReducedMotion: () => useReducedMotion() };
});

function percentLabel(label: HTMLElement): number {
  return Number(label.getAttribute("aria-label")?.match(/(\d+)%/)?.[1]);
}

describe("LearningJourneyBar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fills the learning bar past halfway and keeps From Memory amber", () => {
    const { container } = render(
      <LearningJourneyBar learnStage={3} stageReps={0} status="learning" />,
    );

    const label = screen.getByLabelText(/Learning journey: From memory/);
    const prior = requiredRepsFor(0) + requiredRepsFor(1) + requiredRepsFor(2);
    const total = prior + requiredRepsFor(3);
    const pct = Math.round((prior / total) * 100);
    expect(percentLabel(label)).toBe(pct);
    expect(pct).toBeGreaterThan(50);

    const fill = container.querySelector(".h-full");
    expect(fill?.className).toContain("bg-amber-500");
    expect(fill).toHaveStyle({ width: `${pct}%` });
  });

  it("reaches 100% learned when the last learning reps are banked", () => {
    render(
      <LearningJourneyBar
        learnStage={3}
        stageReps={requiredRepsFor(3)}
        status="learning"
      />,
    );

    expect(
      screen.getByLabelText(/Learning journey: From memory · 100%/),
    ).toBeInTheDocument();
  });

  it("starts a separate sky mastery bar after graduation", () => {
    const { container } = render(
      <LearningJourneyBar
        learnStage={3}
        stageReps={0}
        status="reviewing"
        intervalDays={0}
      />,
    );

    expect(
      screen.getByLabelText(/Progress to mastered: Memorized · 0%/),
    ).toBeInTheDocument();
    const fill = container.querySelector(".h-full");
    expect(fill?.className).toContain("bg-sky-500");
    expect(fill).toHaveStyle({ width: "0%", minWidth: "0.375rem" });
    expect(screen.getByText("0% to mastered")).toBeInTheDocument();
  });

  it("keeps one mastery track when Mastered recolors to Memorized", () => {
    const { container, rerender } = render(
      <LearningJourneyBar
        learnStage={3}
        status="mastered"
        intervalDays={MASTERED_INTERVAL_DAYS}
      />,
    );
    const track = container.querySelector("[data-journey-track=mastery]");
    expect(track).toBeTruthy();

    rerender(
      <LearningJourneyBar
        learnStage={3}
        status="reviewing"
        intervalDays={MASTERED_INTERVAL_DAYS}
        stageReps={0}
        from={{
          learnStage: 3,
          status: "mastered",
          intervalDays: MASTERED_INTERVAL_DAYS,
        }}
      />,
    );
    expect(container.querySelector("[data-journey-track=mastery]")).toBe(track);
    expect(
      screen
        .getByLabelText(/Progress to mastered/)
        .getAttribute("data-journey-motion"),
    ).toBe("slide");
  });

  it("fades between Memorized and Fill in the blanks without a width slide", () => {
    const { container } = render(
      <LearningJourneyBar
        learnStage={2}
        stageReps={0}
        status="learning"
        from={{
          learnStage: 3,
          stageReps: 0,
          status: "reviewing",
          intervalDays: 1,
        }}
      />,
    );
    expect(
      screen.getByLabelText(/Learning journey: Fill in the blanks/),
    ).toHaveAttribute("data-journey-motion", "fade");
    const fills = container.querySelectorAll(".h-full");
    for (const fill of fills) {
      expect(fill.className).not.toContain("duration-500");
    }
  });

  it("pulses the sky dot once when fading back up to Memorized", () => {
    vi.useFakeTimers();
    const { container } = render(
      <LearningJourneyBar
        learnStage={3}
        stageReps={0}
        status="reviewing"
        intervalDays={1}
        from={{
          learnStage: 2,
          stageReps: 0,
          status: "learning",
        }}
      />,
    );
    expect(screen.getByLabelText(/Progress to mastered/)).toHaveAttribute(
      "data-journey-motion",
      "fade",
    );
    act(() => {
      vi.advanceTimersByTime(520);
    });
    expect(screen.getByLabelText(/Progress to mastered/)).toHaveAttribute(
      "data-journey-motion",
      "pulse",
    );
    expect(container.querySelector(".animate-journey-dot-pulse")).toBeTruthy();
  });

  it("fills the mastery bar when a daily reviewing streak banks a rep", () => {
    const { rerender } = render(
      <LearningJourneyBar
        learnStage={3}
        stageReps={0}
        status="reviewing"
        intervalDays={1}
      />,
    );

    expect(
      screen.getByLabelText(/Progress to mastered: Memorized · 0%/),
    ).toBeInTheDocument();

    rerender(
      <LearningJourneyBar
        learnStage={3}
        stageReps={1}
        status="reviewing"
        intervalDays={1}
      />,
    );

    const after = screen.getByLabelText(/Progress to mastered: Memorized/);
    const pct = Number(after.getAttribute("aria-label")?.match(/(\d+)%/)?.[1]);
    expect(pct).toBeGreaterThan(0);
  });

  it("says what each bar is working toward", () => {
    const { rerender } = render(
      <LearningJourneyBar learnStage={0} stageReps={0} status="learning" />,
    );
    expect(screen.getByText("0% learned")).toBeInTheDocument();

    rerender(
      <LearningJourneyBar
        learnStage={3}
        stageReps={0}
        status="reviewing"
        intervalDays={1}
      />,
    );
    expect(screen.getByText("0% to mastered")).toBeInTheDocument();

    rerender(
      <LearningJourneyBar
        learnStage={3}
        status="mastered"
        intervalDays={MASTERED_INTERVAL_DAYS}
      />,
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("jumps to the new fill with no transition when motion is reduced", () => {
    useReducedMotion.mockReturnValue(true);
    const { container } = render(
      <LearningJourneyBar
        learnStage={3}
        stageReps={0}
        status="reviewing"
        intervalDays={1}
        from={{
          learnStage: 2,
          stageReps: 0,
          status: "learning",
        }}
      />,
    );
    const fill = container.querySelector(".h-full");
    expect(fill).toHaveStyle({ width: "0%" });
    expect(fill?.className).toContain("motion-reduce:transition-none");
    expect(screen.getByLabelText(/Progress to mastered/)).toHaveAttribute(
      "data-journey-motion",
      "none",
    );
    useReducedMotion.mockReturnValue(false);
  });

  it("shows the Memorized label and the dropped percent in the same paint", () => {
    vi.useFakeTimers();
    const { container } = render(
      <LearningJourneyBar
        learnStage={3}
        stageReps={0}
        status="reviewing"
        intervalDays={1}
        from={{
          learnStage: 3,
          status: "mastered",
          intervalDays: MASTERED_INTERVAL_DAYS,
        }}
      />,
    );

    const bar = screen.getByLabelText(/Progress to mastered: Memorized/);
    const pct = percentLabel(bar);
    expect(pct).toBeLessThan(100);
    expect(screen.getByText("Memorized")).toBeInTheDocument();
    expect(screen.queryByText("Mastered")).not.toBeInTheDocument();
    expect(screen.getByText(`${pct}% to mastered`)).toBeInTheDocument();
    expect(screen.queryByText("100% to mastered")).not.toBeInTheDocument();

    const fill = container.querySelector(".h-full");
    expect(fill).toHaveStyle({ width: "100%" });

    act(() => {
      vi.advanceTimersByTime(219);
    });
    expect(fill).toHaveStyle({ width: "100%" });
    expect(screen.getByText(`${pct}% to mastered`)).toBeInTheDocument();
    expect(screen.queryByText("100% to mastered")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(fill).toHaveStyle({ width: `${pct}%` });
    expect(screen.getByText("Memorized")).toBeInTheDocument();
    expect(screen.getByText(`${pct}% to mastered`)).toBeInTheDocument();
  });
});

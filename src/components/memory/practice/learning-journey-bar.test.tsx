import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  MASTERED_INTERVAL_DAYS,
  requiredRepsFor,
} from "@/lib/memory-scheduler";

import { LearningJourneyBar } from "./learning-journey-bar";

function percentLabel(label: HTMLElement): number {
  return Number(label.getAttribute("aria-label")?.match(/(\d+)%/)?.[1]);
}

describe("LearningJourneyBar", () => {
  it("fills the learning bar past halfway and keeps From Memory amber", () => {
    const { container } = render(
      <LearningJourneyBar learnStage={3} stageReps={0} status="learning" />,
    );

    const label = screen.getByLabelText(/Learning journey: From Memory/);
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
      screen.getByLabelText(/Learning journey: From Memory · 100%/),
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
      screen.getByLabelText(/Progress to mastered: Reviewing · 0%/),
    ).toBeInTheDocument();
    const fill = container.querySelector(".h-full");
    expect(fill?.className).toContain("bg-sky-500");
    expect(fill).toHaveStyle({ width: "0%" });
  });

  it("fills the mastery bar from the review interval alone", () => {
    render(
      <LearningJourneyBar
        learnStage={3}
        stageReps={requiredRepsFor(3)}
        status="reviewing"
        intervalDays={MASTERED_INTERVAL_DAYS / 2}
      />,
    );

    expect(
      screen.getByLabelText(/Progress to mastered: Reviewing · 50%/),
    ).toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PassageRecallCard } from "./passage-recall-card";

vi.mock("framer-motion", async () => {
  const actual =
    await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

describe("PassageRecallCard footer", () => {
  it("keeps the action footer transparent so it matches the stage-tinted card", () => {
    const { container } = render(
      <PassageRecallCard
        mode="frontier"
        phaseLabel="Read"
        title="Psalm 16:1"
        promptLine="Read it through, then continue"
        versePlainText="Preserve me, O God, for in you I take refuge."
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "text", text: "Preserve me, O God", label: "Hint" }}
        learnStage={0}
        stageReps={0}
        status="learning"
        readContinue
        onSubmit={() => Promise.resolve(true)}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Continue/i }),
    ).toBeInTheDocument();

    const footer = container.querySelector('[data-slot="card-footer"]');
    expect(footer).not.toBeNull();
    const className = footer?.className ?? "";
    expect(className).not.toMatch(/\bbg-card\b/);
    expect(className).not.toMatch(/\bsticky\b/);
    expect(className).toMatch(/\bborder-t\b/);
  });
});

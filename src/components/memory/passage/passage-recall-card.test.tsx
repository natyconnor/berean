import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("PassageRecallCard step label and focus", () => {
  it("shows the current Guided step, not completed count", () => {
    render(
      <PassageRecallCard
        mode="frontier"
        phaseLabel="Guided"
        title="Psalm 16:1"
        promptLine="Type what you remember"
        versePlainText="Preserve me, O God, for in you I take refuge."
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{
          type: "tokens",
          tokens: [{ text: "P", word: true, masked: false }],
        }}
        learnStage={1}
        stageReps={0}
        status="learning"
        showJourneyBar
        onSubmit={() => Promise.resolve(true)}
      />,
    );

    expect(screen.getByText(/Guided · 1 of \d+ today/)).toBeInTheDocument();
    expect(screen.queryByText(/Guided · 0 of/)).not.toBeInTheDocument();
  });

  it("focuses the answer box after Read Continue", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => Promise.resolve(true));

    const { rerender } = render(
      <PassageRecallCard
        mode="frontier"
        phaseLabel="Read"
        title="Psalm 16:1"
        promptLine="Read it through, then continue"
        versePlainText="Preserve me, O God, for in you I take refuge."
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{
          type: "text",
          text: "Preserve me, O God, for in you I take refuge.",
          label: "Hint",
        }}
        learnStage={0}
        stageReps={0}
        status="learning"
        showJourneyBar
        readContinue
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Continue/i }));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });

    // Parent adopts the next band and flips readContinue off — mirror that.
    rerender(
      <PassageRecallCard
        mode="frontier"
        phaseLabel="Guided"
        title="Psalm 16:1"
        promptLine="Type what you remember"
        versePlainText="Preserve me, O God, for in you I take refuge."
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{
          type: "tokens",
          tokens: [{ text: "P", word: true, masked: false }],
        }}
        learnStage={1}
        stageReps={0}
        status="learning"
        showJourneyBar
        readContinue={false}
        onSubmit={onSubmit}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Your recalled verse")).toHaveFocus();
    });
  });
});

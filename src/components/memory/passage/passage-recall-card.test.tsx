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

describe("PassageRecallCard result banner", () => {
  const VERSE = "Preserve me, O God, for in you I take refuge.";

  function renderTypingCard() {
    return render(
      <PassageRecallCard
        mode="frontier"
        phaseLabel="First letters"
        title="Psalm 16:1"
        promptLine="Type what you remember"
        versePlainText={VERSE}
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
        onSubmit={() => Promise.resolve(true)}
      />,
    );
  }

  it("celebrates a word-for-word recall with emoji and praise, and no particles under reduced motion", async () => {
    const user = userEvent.setup();
    renderTypingCard();

    await user.click(screen.getByLabelText("Your recalled verse"));
    await user.paste(VERSE);
    await user.click(screen.getByRole("button", { name: /Check answer/ }));

    const banner = await screen.findByRole("status");
    expect(banner).toHaveAttribute("data-tone", "exact");
    expect(screen.getByTestId("result-emoji")).toHaveTextContent("🎉");
    expect(screen.getByText("Word for word.")).toBeVisible();
    expect(screen.getByText("Nailed it!")).toBeVisible();
    expect(screen.getByText("100% recalled")).toBeVisible();
    expect(screen.queryByTestId("confetti-burst")).not.toBeInTheDocument();
  });

  it("keeps the pass mark in the same banner on a miss", async () => {
    const user = userEvent.setup();
    renderTypingCard();

    await user.click(screen.getByLabelText("Your recalled verse"));
    await user.paste("Preserve me, O God, for in you I hide.");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));

    const banner = await screen.findByRole("status");
    expect(banner).not.toHaveAttribute("data-tone", "exact");
    expect(banner).toHaveTextContent(/\d+% recalled · Pass at 85%/);
    expect(screen.getByTestId("result-emoji")).not.toHaveTextContent("🎉");
  });
});

describe("PassageRecallCard step label and focus", () => {
  it("shows the current First letters step, not completed count", () => {
    render(
      <PassageRecallCard
        mode="frontier"
        phaseLabel="First letters"
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

    expect(
      screen.getByText(/First letters · 1 of \d+ today/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/First letters · 0 of/)).not.toBeInTheDocument();
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
        phaseLabel="First letters"
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

  it("labels the check button Saving... while the grade is saving", async () => {
    const user = userEvent.setup();
    let resolveSubmit!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      resolveSubmit = resolve;
    });

    render(
      <PassageRecallCard
        mode="frontier"
        phaseLabel="First letters"
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
        onSubmit={() => pending}
      />,
    );

    const answer = screen.getByLabelText("Your recalled verse");
    await user.click(answer);
    await user.paste("not the verse");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));

    const saving = await screen.findByRole("button", { name: "Saving..." });
    expect(saving).toBeDisabled();
    expect(saving).toHaveAttribute("aria-busy", "true");
    expect(saving.querySelector("[data-icon=spinner]")).not.toBeNull();
    expect(
      screen.queryByRole("button", { name: /Check answer|Try again/ }),
    ).not.toBeInTheDocument();

    resolveSubmit(true);

    const tryAgain = await screen.findByRole("button", { name: /Try again/ });
    await waitFor(() => {
      expect(tryAgain).toBeEnabled();
      expect(tryAgain).not.toHaveAttribute("aria-busy");
    });
    expect(
      screen.queryByRole("button", { name: "Saving..." }),
    ).not.toBeInTheDocument();
  });
});

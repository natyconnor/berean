import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PassageRecallCard } from "./passage-recall-card";

const scrollMocks = vi.hoisted(() => ({
  scrollResultBannerIntoView: vi.fn(),
  scrollBelowSessionHeader: vi.fn(),
  scrollClearOfModeDock: vi.fn(),
}));

vi.mock("@/components/memory/scroll-result-banner", () => ({
  scrollResultBannerIntoView: scrollMocks.scrollResultBannerIntoView,
  scrollBelowSessionHeader: scrollMocks.scrollBelowSessionHeader,
  scrollClearOfModeDock: scrollMocks.scrollClearOfModeDock,
}));

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
    expect(
      screen.queryByRole("button", { name: "Need a refresher?" }),
    ).not.toBeInTheDocument();
  });

  it("offers Need a refresher on the review banner after a miss", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <PassageRecallCard
        mode="review"
        phaseLabel="From memory"
        title="Psalm 23"
        promptLine="Type the passage from memory"
        versePlainText={VERSE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="reviewing"
        onSubmit={() => Promise.resolve(true)}
      />,
    );

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste("nope");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));

    const offer = await screen.findByRole("button", {
      name: "Need a refresher?",
    });
    expect(offer).toBeVisible();
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "Need a refresher?",
    );
    expect(
      screen.getAllByRole("button", { name: "Need a refresher?" }),
    ).toHaveLength(1);
    const footer = container.querySelector('[data-slot="card-footer"]');
    expect(footer).not.toBeNull();
    expect(footer?.textContent?.includes("Need a refresher?")).toBe(false);
    expect(screen.getByRole("button", { name: /Continue/ })).toBeVisible();
  });

  it("shows Need a refresher in the empty from-memory hint box", () => {
    render(
      <PassageRecallCard
        mode="review"
        phaseLabel="From memory"
        title="Psalm 23"
        promptLine="Type the passage from memory"
        versePlainText={VERSE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="reviewing"
        onSubmit={() => Promise.resolve(true)}
      />,
    );

    expect(
      screen.getByText(
        "Type it as you remember it. Verse numbers aren't needed.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Need a refresher?" }),
    ).toBeInTheDocument();
  });

  it("tabs How you did only while that region overflows", async () => {
    const observers: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback);
        }
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );

    try {
      const user = userEvent.setup();
      const { container } = render(
        <PassageRecallCard
          mode="review"
          phaseLabel="From memory"
          title="Psalm 23"
          promptLine="Type the passage from memory"
          versePlainText={VERSE}
          loading={false}
          error={null}
          retry={() => undefined}
          hint={{ type: "hidden", message: "No hint text." }}
          learnStage={3}
          stageReps={0}
          status="reviewing"
          onSubmit={() => Promise.resolve(true)}
        />,
      );

      await user.click(screen.getByLabelText("Your recited passage"));
      await user.paste("nope");
      await user.click(screen.getByRole("button", { name: /Check answer/ }));
      const offer = await screen.findByRole("button", {
        name: "Need a refresher?",
      });
      const region = screen
        .getByText("How you did")
        .closest("[data-result-scroll='how-you-did']");
      if (!(region instanceof HTMLElement)) {
        throw new Error("Expected a How you did scroll region");
      }

      Object.defineProperties(region, {
        clientHeight: { configurable: true, value: 200 },
        scrollHeight: { configurable: true, value: 200 },
        clientWidth: { configurable: true, value: 320 },
        scrollWidth: { configurable: true, value: 320 },
      });
      act(() => {
        for (const callback of observers) {
          callback([], {} as ResizeObserver);
        }
      });
      expect(region).not.toHaveAttribute("tabindex");

      Object.defineProperties(region, {
        clientHeight: { configurable: true, value: 80 },
        scrollHeight: { configurable: true, value: 360 },
      });
      act(() => {
        for (const callback of observers) {
          callback([], {} as ResizeObserver);
        }
      });
      expect(region).toHaveAttribute("tabindex", "0");
      expect(offer.compareDocumentPosition(region)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      expect(
        region.compareDocumentPosition(
          screen.getByRole("button", { name: /Continue/ }),
        ),
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(container.querySelector("[data-result-scroll='full-text']")).toBe(
        null,
      );

      Object.defineProperties(region, {
        clientHeight: { configurable: true, value: 200 },
        scrollHeight: { configurable: true, value: 200 },
      });
      act(() => {
        for (const callback of observers) {
          callback([], {} as ResizeObserver);
        }
      });
      const continueButton = screen.getByRole("button", { name: /Continue/ });
      continueButton.focus();
      await user.tab({ shift: true });
      expect(offer).toHaveFocus();

      Object.defineProperties(region, {
        clientHeight: { configurable: true, value: 80 },
        scrollHeight: { configurable: true, value: 360 },
      });
      act(() => {
        for (const callback of observers) {
          callback([], {} as ResizeObserver);
        }
      });
      continueButton.focus();
      await user.tab({ shift: true });
      expect(region).toHaveFocus();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("opens First letters from the banner offer after a miss", async () => {
    const user = userEvent.setup();
    render(
      <PassageRecallCard
        mode="review"
        phaseLabel="From memory"
        title="Psalm 23"
        promptLine="Type the passage from memory"
        versePlainText={VERSE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="reviewing"
        onSubmit={() => Promise.resolve(true)}
      />,
    );

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste("nope");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    await user.click(
      await screen.findByRole("button", { name: "Need a refresher?" }),
    );

    expect(screen.getByText("First letters")).toBeInTheDocument();
    expect(screen.getByLabelText("Your recited passage")).toHaveFocus();
  });

  it("hides Need a refresher on a 60% or better recall", async () => {
    const user = userEvent.setup();
    render(
      <PassageRecallCard
        mode="review"
        phaseLabel="From memory"
        title="Psalm 16:1"
        promptLine="Type the passage from memory"
        versePlainText={VERSE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="reviewing"
        onSubmit={() => Promise.resolve(true)}
      />,
    );

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste("Preserve me, O God, for in you I hide.");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Need a refresher?" }),
    ).not.toBeInTheDocument();
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

  it("focuses Continue after Check answer once saving finishes", async () => {
    const user = userEvent.setup();
    let resolveSubmit!: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      resolveSubmit = resolve;
    });

    render(
      <PassageRecallCard
        mode="review"
        phaseLabel="From memory"
        title="Psalm 23"
        promptLine="Type the passage from memory"
        versePlainText="The Lord is my shepherd; I shall not want."
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="reviewing"
        onSubmit={() => pending}
      />,
    );

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste("zzz qqq xxx");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));

    expect(
      await screen.findByRole("button", { name: "Saving..." }),
    ).toBeDisabled();

    resolveSubmit(true);

    const continueButton = await screen.findByRole("button", {
      name: /Continue/,
    });
    await waitFor(() => {
      expect(continueButton).toBeEnabled();
      expect(continueButton).toHaveFocus();
    });
  });
});

describe("PassageRecallCard Refresh and skip", () => {
  const VERSE = "Preserve me, O God, for in you I take refuge.";

  it("hints First letters one verse per line", () => {
    render(
      <PassageRecallCard
        mode="review"
        phaseLabel="Refresh"
        title="Psalm 23"
        promptLine="Type it with first letters"
        versePlainText="The Lord is my shepherd. He makes me lie down."
        hintPlainText={"The Lord is my shepherd.\nHe makes me lie down."}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={1}
        stageReps={0}
        status="reviewing"
        refreshSitting
        onSubmit={() => Promise.resolve(true)}
      />,
    );

    const hint = screen.getByText("First letters").closest("div");
    const lineBox = hint?.querySelector("p.whitespace-pre-wrap");
    expect(lineBox?.textContent).toContain("\n");
    expect(hint?.parentElement).toHaveClass("max-h-[45vh]");
    expect(
      screen.getByRole("textbox", { name: "Your recited passage" }),
    ).toBeInTheDocument();
  });

  it("scrolls the typing box after the first-letters hint loads", async () => {
    const props = {
      mode: "review" as const,
      phaseLabel: "Refresh",
      title: "Psalm 23",
      promptLine: "Type it with first letters",
      error: null,
      retry: () => undefined,
      hint: { type: "hidden" as const, message: "" },
      learnStage: 1,
      stageReps: 0,
      status: "reviewing" as const,
      refreshSitting: true,
      onSubmit: () => Promise.resolve(true),
    };
    const { rerender } = render(
      <PassageRecallCard {...props} versePlainText="" loading />,
    );

    scrollMocks.scrollClearOfModeDock.mockClear();
    rerender(
      <PassageRecallCard
        {...props}
        versePlainText="The Lord is my shepherd; I shall not want."
        loading={false}
      />,
    );

    await waitFor(() => {
      expect(scrollMocks.scrollClearOfModeDock).toHaveBeenCalled();
    });
    expect(scrollMocks.scrollClearOfModeDock).toHaveBeenCalledWith(
      screen.getByLabelText("Your recited passage"),
    );
  });

  it("shows Skip warm-up on a held rope miss", async () => {
    const user = userEvent.setup();
    const onSkipWarmup = vi.fn();
    render(
      <PassageRecallCard
        mode="rope"
        phaseLabel="Warm up"
        title="Psalm 23:1–2"
        promptLine="Warm up with what you know"
        versePlainText={VERSE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="learning"
        onSubmit={() => Promise.resolve(true)}
        onSkipWarmup={onSkipWarmup}
      />,
    );

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste("nope");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    await user.click(
      await screen.findByRole("button", { name: "Skip warm-up" }),
    );
    expect(onSkipWarmup).toHaveBeenCalledTimes(1);
  });

  it("uses Skip for now and Refresh these verses on a failed join", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    const onRescue = vi.fn();
    render(
      <PassageRecallCard
        mode="rope"
        phaseLabel="Join verses"
        title="Jude 1:3–4"
        promptLine="Type both verses together"
        versePlainText={VERSE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="learning"
        onSubmit={() => Promise.resolve(true)}
        onSkipWarmup={onSkip}
        skipLabel="Skip for now"
        hideAfterMissOffer
        refreshTheseVerses
        onAfterMissRescueFinished={onRescue}
      />,
    );

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste("nope");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(
      screen.queryByRole("button", { name: "Need a refresher?" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Skip warm-up" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Refresh these verses" }),
    ).toBeInTheDocument();
    await user.click(
      await screen.findByRole("button", { name: "Skip for now" }),
    );
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("runs First letters then From memory after Refresh these verses", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => Promise.resolve(true));
    const onRescue = vi.fn();
    const onContinue = vi.fn();
    render(
      <PassageRecallCard
        mode="rope"
        phaseLabel="Join verses"
        title="3 John 1:3–4"
        promptLine="Type both verses together"
        versePlainText={VERSE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="learning"
        onSubmit={onSubmit}
        onContinueAfterResult={onContinue}
        onSkipWarmup={() => undefined}
        skipLabel="Skip for now"
        hideAfterMissOffer
        refreshTheseVerses
        onAfterMissRescueFinished={onRescue}
      />,
    );

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste("nope");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    await user.click(
      await screen.findByRole("button", { name: "Refresh these verses" }),
    );

    expect(screen.getByText("Refresh · First letters")).toBeInTheDocument();
    expect(screen.getByText("First letters · 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste(VERSE);
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText(/recalled/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Continue/ }));

    expect(screen.getByText("Refresh · From memory")).toBeInTheDocument();
    expect(screen.getByText("From memory · 2 of 2")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Now try it without the hints. Verse numbers aren't needed.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("First letters")).not.toBeInTheDocument();
    expect(onRescue).not.toHaveBeenCalled();
    expect(onContinue).not.toHaveBeenCalled();

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste(VERSE);
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(await screen.findByText("Back on track.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Continue/ }));

    expect(onRescue).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("hides the starting hint on the result", async () => {
    const user = userEvent.setup();
    render(
      <PassageRecallCard
        mode="rope"
        phaseLabel="Join verses"
        title="Jude 1:3–4"
        promptLine="Type both verses together"
        versePlainText={VERSE}
        stallCue="P"
        stallCueLabel="Starting hint"
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="learning"
        onSubmit={() => Promise.resolve(true)}
      />,
    );

    expect(screen.getByLabelText("Starting hint")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste("nope");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(
      await screen.findByRole("button", { name: /Continue/ }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Starting hint")).not.toBeInTheDocument();
  });

  it("heads a sitting From memory step as Refresh and drops the refresher link", () => {
    render(
      <PassageRecallCard
        mode="review"
        phaseLabel="Recite it all"
        title="Psalm 23"
        promptLine="Recall the passage from memory"
        versePlainText={VERSE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="reviewing"
        refreshSitting
        onSubmit={() => Promise.resolve(true)}
      />,
    );

    expect(screen.getByText("Refresh · From memory")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Now try it without the hints. Verse numbers aren't needed.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Need a refresher?" }),
    ).not.toBeInTheDocument();
  });

  it("lets a weak From memory Refresh finish on Continue", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(
      <PassageRecallCard
        mode="review"
        phaseLabel="Refresh"
        title="Psalm 23"
        promptLine="Recall the passage from memory"
        versePlainText={VERSE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{ type: "hidden", message: "No hint text." }}
        learnStage={3}
        stageReps={0}
        status="reviewing"
        refreshSitting
        onSubmit={() => Promise.resolve(true)}
        onContinueAfterResult={onContinue}
      />,
    );

    await user.click(screen.getByLabelText("Your recited passage"));
    await user.paste("nope");
    await user.click(screen.getByRole("button", { name: /Check answer/ }));
    expect(
      await screen.findByRole("button", { name: /Try again/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Continue/ }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

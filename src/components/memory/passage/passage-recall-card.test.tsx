import { type ComponentProps } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PassageRecallCard } from "./passage-recall-card";

vi.mock("framer-motion", async () => {
  const actual =
    await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

const PASSAGE = "The Lord is my shepherd; I shall not want.";

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  grammars: unknown = undefined;
  onresult:
    ((event: { results: unknown; resultIndex: number }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  start(): void {}
  stop(): void {
    this.onend?.();
  }
  abort(): void {
    this.onend?.();
  }
  emit(items: Array<{ transcript: string; isFinal: boolean }>): void {
    const results = items.map((item) => {
      const alternative = { transcript: item.transcript, confidence: 1 };
      return Object.assign([alternative], {
        isFinal: item.isFinal,
        item: () => alternative,
      });
    });
    this.onresult?.({
      resultIndex: 0,
      results: Object.assign(results, {
        item: (index: number) => results[index],
      }),
    });
  }
}

const speechInstances: MockSpeechRecognition[] = [];

function installSpeechMock() {
  const speechWindow = window as Window & {
    SpeechRecognition?: new () => MockSpeechRecognition;
  };
  speechWindow.SpeechRecognition = class extends MockSpeechRecognition {
    constructor() {
      super();
      speechInstances.push(this);
    }
  };
}

function lastSpeech(): MockSpeechRecognition {
  const recognition = speechInstances.at(-1);
  if (!recognition) throw new Error("expected SpeechRecognition");
  return recognition;
}

function renderPassageRecall(
  overrides: Partial<ComponentProps<typeof PassageRecallCard>> = {},
) {
  const onSubmit = overrides.onSubmit ?? vi.fn().mockResolvedValue(true);
  return {
    onSubmit,
    ...render(
      <PassageRecallCard
        mode="review"
        phaseLabel="Review"
        title="Psalm 23"
        promptLine="Recite the whole passage from memory"
        versePlainText={PASSAGE}
        loading={false}
        error={null}
        retry={() => undefined}
        hint={{
          type: "hidden",
          message: "Recite the passage from memory.",
        }}
        learnStage={3}
        stageReps={0}
        status="reviewing"
        onSubmit={onSubmit}
        {...overrides}
      />,
    ),
  };
}

describe("PassageRecallCard footer", () => {
  it("keeps the action footer transparent so it matches the stage-tinted card", () => {
    const { container } = renderPassageRecall({
      mode: "frontier",
      phaseLabel: "Read",
      title: "Psalm 16:1",
      promptLine: "Read it through, then continue",
      versePlainText: "Preserve me, O God, for in you I take refuge.",
      hint: { type: "text", text: "Preserve me, O God", label: "Hint" },
      learnStage: 0,
      stageReps: 0,
      status: "learning",
      readContinue: true,
    });

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

describe("PassageRecallCard Web Speech dictation", () => {
  beforeEach(() => {
    speechInstances.length = 0;
    window.localStorage.removeItem("berean:hideSpeech");
    window.localStorage.removeItem("berean:mockSpeech");
  });

  afterEach(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };
    delete speechWindow.SpeechRecognition;
    delete speechWindow.webkitSpeechRecognition;
  });

  it("hides the mic when the Web Speech API is missing", () => {
    renderPassageRecall();
    expect(screen.getByLabelText("Your recited passage")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dictate verse" }),
    ).not.toBeInTheDocument();
  });

  it("places a prominent mic under the passage box and streams words into it", async () => {
    installSpeechMock();
    const user = userEvent.setup();
    const { onSubmit } = renderPassageRecall();
    const answer = screen.getByLabelText("Your recited passage");
    const mic = screen.getByRole("button", { name: "Dictate verse" });
    expect(
      mic.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();

    await user.click(mic);
    expect(
      screen.getByRole("button", { name: "Stop dictation" }),
    ).toBeVisible();
    expect(
      document.querySelector('[data-slot="dictation-waveform"]'),
    ).not.toBeNull();

    act(() => {
      lastSpeech().emit([{ transcript: PASSAGE, isFinal: false }]);
    });
    expect(answer).toHaveValue(PASSAGE);
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Stop dictation" }));
    const check = screen.getByRole("button", { name: /Check answer/ });
    await waitFor(() => {
      expect(check).toBeEnabled();
    });
    await user.click(check);
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("100% recalled.")).toBeVisible();
  });

  it("DEV insert sample fills the passage box without auto-Check", async () => {
    window.localStorage.setItem("berean:mockSpeech", "1");
    const user = userEvent.setup();
    const { onSubmit } = renderPassageRecall();
    const answer = screen.getByLabelText("Your recited passage");
    await user.click(screen.getByRole("button", { name: "Dictate verse" }));
    await user.click(
      screen.getByRole("button", { name: "Insert spoken sample" }),
    );
    expect(answer).toHaveValue("The Lord is my shepherd; I shall not want");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Check answer/ })).toBeEnabled();
  });

  it("toggles the mic with Space when the box is empty, and inserts a space once it has text", async () => {
    installSpeechMock();
    const user = userEvent.setup();
    renderPassageRecall();
    const answer = screen.getByLabelText("Your recited passage");
    await user.click(answer);
    await user.keyboard(" ");
    expect(answer).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Stop dictation" }),
    ).toBeVisible();
    expect(speechInstances).toHaveLength(1);

    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Dictate verse" })).toBeVisible();

    await user.type(answer, "hello");
    await user.keyboard(" ");
    expect(answer).toHaveValue("hello ");
    expect(speechInstances).toHaveLength(1);
  });

  it("does not show the mic on Read prime cards", () => {
    installSpeechMock();
    renderPassageRecall({
      mode: "frontier",
      phaseLabel: "Read",
      title: "Psalm 16:1",
      promptLine: "Read it through, then continue",
      versePlainText: "Preserve me, O God, for in you I take refuge.",
      hint: { type: "text", text: "Preserve me, O God", label: "Hint" },
      learnStage: 0,
      status: "learning",
      readContinue: true,
    });
    expect(screen.getByText("Read it through, then continue")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Dictate verse" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recalled verse"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Your recited passage"),
    ).not.toBeInTheDocument();
  });

  it("shows the same mic on rope recitation", () => {
    installSpeechMock();
    renderPassageRecall({
      mode: "rope",
      phaseLabel: "Connect",
      title: "Psalm 23:1–2",
      promptLine: "Recite this stretch from memory",
      status: "learning",
      learnStage: 3,
    });
    const answer = screen.getByLabelText("Your recited passage");
    const mic = screen.getByRole("button", { name: "Dictate verse" });
    expect(
      mic.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });
});

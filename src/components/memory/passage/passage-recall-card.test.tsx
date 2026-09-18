import { type ComponentProps } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitDevMockSpeech } from "@/lib/web-speech";

import { PassageRecallCard } from "./passage-recall-card";

const { transcribeAudioMock } = vi.hoisted(() => ({
  transcribeAudioMock: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useAction: () => transcribeAudioMock,
}));

vi.mock("../../../../convex/_generated/api", () => ({
  api: { transcribe: { transcribeAudio: "transcribe.transcribeAudio" } },
}));

vi.mock("framer-motion", async () => {
  const actual =
    await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: () => true,
  };
});

const PASSAGE = "The Lord is my shepherd; I shall not want.";

function installDictationSupport() {
  const stopTrack = vi.fn();
  const stream = {
    getAudioTracks: () => [
      { kind: "audio", readyState: "live", stop: stopTrack },
    ],
    getTracks: () => [{ kind: "audio", readyState: "live", stop: stopTrack }],
    clone() {
      return this;
    },
  } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported() {
        return true;
      }
      mimeType = "audio/webm";
      state = "inactive";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    },
  );
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

describe("PassageRecallCard Groq Whisper dictation", () => {
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    window.localStorage.removeItem("berean:hideSpeech");
    window.localStorage.removeItem("berean:mockSpeech");
    transcribeAudioMock.mockReset();
    transcribeAudioMock.mockResolvedValue({ text: "" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it("hides the mic when getUserMedia or MediaRecorder is missing", () => {
    renderPassageRecall();
    expect(screen.getByLabelText("Your recited passage")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Dictate verse" }),
    ).not.toBeInTheDocument();
  });

  it("places a prominent mic under the passage box and streams words into it", async () => {
    installDictationSupport();
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
      emitDevMockSpeech(PASSAGE);
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
    installDictationSupport();
    const user = userEvent.setup();
    renderPassageRecall();
    const answer = screen.getByLabelText("Your recited passage");
    await user.click(answer);
    await user.keyboard(" ");
    expect(answer).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Stop dictation" }),
    ).toBeVisible();

    await user.keyboard(" ");
    expect(screen.getByRole("button", { name: "Dictate verse" })).toBeVisible();

    await user.type(answer, "hello");
    await user.keyboard(" ");
    expect(answer).toHaveValue("hello ");
    expect(screen.getByRole("button", { name: "Dictate verse" })).toBeVisible();
  });

  it("does not show the mic on Read prime cards", () => {
    installDictationSupport();
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
    installDictationSupport();
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

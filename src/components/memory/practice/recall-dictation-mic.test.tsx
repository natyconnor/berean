import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WAVE_BAR_COUNT, WAVE_MIN_HEIGHT_PX } from "./mic-amplitude";
import { RecallDictationMic } from "./recall-dictation-mic";

type MicHarness = {
  analyser: {
    fftSize: number;
    smoothingTimeConstant: number;
    getByteTimeDomainData: ReturnType<typeof vi.fn>;
  };
  frames: FrameRequestCallback[];
  getUserMedia: ReturnType<typeof vi.fn>;
  stopTrack: ReturnType<typeof vi.fn>;
  stream: MediaStream;
  timeDomain: Uint8Array;
};

function installMicMocks(): MicHarness {
  const stopTrack = vi.fn();
  const stream = {
    getTracks: () => [{ stop: stopTrack, kind: "audio", readyState: "live" }],
    getAudioTracks: () => [
      { stop: stopTrack, kind: "audio", readyState: "live" },
    ],
    clone: () => ({
      getTracks: () => [{ stop: vi.fn(), kind: "audio", readyState: "live" }],
      getAudioTracks: () => [
        { stop: vi.fn(), kind: "audio", readyState: "live" },
      ],
    }),
  } as unknown as MediaStream;
  const timeDomain = new Uint8Array(1024).fill(128);
  const analyser = {
    fftSize: 1024,
    smoothingTimeConstant: 0,
    getByteTimeDomainData: vi.fn((buffer: Uint8Array) => {
      const n = Math.min(buffer.length, timeDomain.length);
      for (let i = 0; i < n; i += 1) {
        buffer[i] = timeDomain[i] ?? 128;
      }
    }),
  };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const context = {
    state: "running",
    createMediaStreamSource: vi.fn(() => source),
    createAnalyser: vi.fn(() => analyser),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const getUserMedia = vi.fn().mockResolvedValue(stream);

  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
  vi.stubGlobal(
    "AudioContext",
    vi.fn(function AudioContext() {
      return context;
    }),
  );

  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    frames.push(cb);
    return frames.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

  return { analyser, frames, getUserMedia, stopTrack, stream, timeDomain };
}

function barHeights(): number[] {
  return [
    ...document.querySelectorAll('[data-slot="dictation-waveform"] span'),
  ].map((bar) => Number.parseInt((bar as HTMLElement).style.height, 10));
}

describe("RecallDictationMic live waveform", () => {
  const originalMedia = navigator.mediaDevices;

  beforeEach(() => {
    window.localStorage.removeItem("berean:mockSpeech");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMedia,
    });
  });

  it("keeps the idle Speak control and does not open the mic", () => {
    const onToggle = vi.fn();
    const { getUserMedia } = installMicMocks();
    render(<RecallDictationMic listening={false} onToggle={onToggle} />);

    expect(
      screen.getByRole("button", { name: "Dictate verse" }),
    ).toHaveTextContent("Speak the verse");
    expect(
      document.querySelector('[data-slot="dictation-waveform"]'),
    ).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("does not call getUserMedia; the hook owns the shared stream", () => {
    const { getUserMedia } = installMicMocks();
    render(<RecallDictationMic listening onToggle={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Stop dictation" }),
    ).toHaveTextContent("Stop listening");
    expect(
      document.querySelector('[data-slot="dictation-waveform"]'),
    ).not.toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("follows analyser amplitude from the shared stream without stopping tracks", () => {
    const { frames, getUserMedia, stopTrack, stream, timeDomain } =
      installMicMocks();
    const { rerender } = render(
      <RecallDictationMic listening micStream={stream} onToggle={() => {}} />,
    );

    const stop = screen.getByRole("button", { name: "Stop dictation" });
    expect(stop).toHaveTextContent("Stop listening");
    expect(stop).toHaveClass("bg-red-600");
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(document.querySelector('[data-mic="live"]')).not.toBeNull();
    expect(barHeights()).toHaveLength(WAVE_BAR_COUNT);

    timeDomain.fill(0);
    act(() => {
      frames.at(-1)?.(0);
    });
    expect(Math.max(...barHeights())).toBeGreaterThan(WAVE_MIN_HEIGHT_PX);

    timeDomain.fill(128);
    act(() => {
      frames.at(-1)?.(0);
    });
    expect(barHeights().every((h) => h === WAVE_MIN_HEIGHT_PX)).toBe(true);

    rerender(
      <RecallDictationMic
        listening={false}
        micStream={null}
        onToggle={() => {}}
      />,
    );
    expect(stopTrack).not.toHaveBeenCalled();
    expect(
      document.querySelector('[data-slot="dictation-waveform"]'),
    ).toBeNull();
  });

  it("still shows listening chrome without a stream", () => {
    installMicMocks();
    render(<RecallDictationMic listening onToggle={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Stop dictation" }),
    ).toBeVisible();
    expect(document.querySelector('[data-mic="live"]')).toBeNull();
  });

  it("toggles via the stop button", async () => {
    const onToggle = vi.fn();
    installMicMocks();
    const user = userEvent.setup();
    render(<RecallDictationMic listening onToggle={onToggle} />);
    await user.click(screen.getByRole("button", { name: "Stop dictation" }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
